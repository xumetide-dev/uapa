// 计划写出的文件集合（模块接口 §8）：写出（F-03-05、F-03-06）与比对（F-03-08）都从它得出。
// 每个插件目录汇总各宿主模块生成的文件、构建编排放置的 skills、agents 与 commands
// （components.ts）与覆盖文件（F-03-12）。合并布局中同名文件内容不同时，标为可合并的 JSON 文件
// 按命名空间合并（F-03-07，merge.ts），其余为冲突：写入该目录的全部目标失败，该目录不进入集合。
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type PluginDir, resolvePluginDirs } from '../config/layout.ts'
import { displayPath } from '../config/paths.ts'
import { type HostName, hostOf } from '../config/targets.ts'
import { compare } from '../source/files.ts'
import { OVERRIDES_DIR } from '../source/overrides.ts'
import type { OutputFile } from '../targets/types.ts'
import { componentFiles, componentUnion, recordComponentRisks } from './components.ts'
import { mergeJsonExtensions } from './merge.ts'
import { type BuildInput, succeeded, type TargetState } from './state.ts'

export interface PlannedFile {
  readonly path: string // 相对插件目录，POSIX 分隔
  readonly content: Buffer
  // 复制的源文件（skills、agents、commands、覆盖文件）的绝对路径，写出时复制以保留文件权限；
  // 生成与合并的文件为 null
  readonly copyFrom: string | null
}

export interface DirOutput {
  readonly dir: PluginDir
  readonly merged: boolean // 两个以上宿主写入该目录：不清空、不列出 removed
  readonly files: readonly PlannedFile[] // 按路径排序
  readonly targets: readonly TargetState[] // 写入该目录的成功目标
}

// 一个宿主在该目录中的文件；覆盖生成文件时继承其 conflictHint 与 merge
interface HostFile extends PlannedFile {
  readonly conflictHint?: string
  readonly merge?: 'json-extensions'
}

type HostView = readonly [HostName, ReadonlyMap<string, HostFile>]

interface Conflict {
  readonly path: string
  readonly hosts: readonly HostName[]
  readonly hints: readonly string[]
}

export async function planOutputs(
  build: BuildInput,
  states: readonly TargetState[],
  hostFiles: ReadonlyMap<HostName, readonly OutputFile[]>,
): Promise<DirOutput[]> {
  const outputs: DirOutput[] = []
  for (const dir of resolvePluginDirs(build.config, build.root)) {
    const output = await planDir(build, dir, states, hostFiles)
    if (output !== null) outputs.push(output)
  }
  return outputs
}

// 该目录的目标全部失败，或合并布局有冲突时返回 null：该目录不写入也不比对
async function planDir(
  build: BuildInput,
  dir: PluginDir,
  states: readonly TargetState[],
  hostFiles: ReadonlyMap<HostName, readonly OutputFile[]>,
): Promise<DirOutput | null> {
  const targets = states.filter(
    s => dir.hosts.includes(hostOf(s.target)) && succeeded(s),
  )
  if (targets.length === 0) return null
  // 合并布局的目录就是源项目根目录时，组件已在原位，不复制，宿主加载源项目中的全部组件
  const atRoot = dir.path === build.root
  const present = atRoot ? build.source : componentUnion(targets)
  const copied = atRoot ? [] : await componentFiles(build.root, present)
  const views: HostView[] = []
  for (const host of dir.hosts) {
    const generated = hostFiles.get(host)
    if (generated === undefined) continue
    const own = targets.filter(s => hostOf(s.target) === host)
    views.push([host, await hostView(build, host, generated, copied, own)])
  }
  const { files, conflicts } = mergeViews(views)
  if (conflicts.length > 0) {
    const messages = conflicts.map(c => conflictMessage(build.root, dir, c))
    for (const state of targets) state.errors.push(...messages)
    return null
  }
  recordComponentRisks(targets, present)
  return { dir, merged: dir.hosts.length > 1, files, targets }
}

// 生成的文件在前，再放复制的组件，最后用覆盖文件替换或新增；覆盖文件记入该宿主各目标的
// overridden
async function hostView(
  build: BuildInput,
  host: HostName,
  generated: readonly OutputFile[],
  copied: readonly PlannedFile[],
  own: readonly TargetState[],
): Promise<Map<string, HostFile>> {
  const view = new Map<string, HostFile>()
  for (const file of generated) view.set(file.path, generatedFile(file))
  for (const file of copied) view.set(file.path, file)
  for (const path of build.source.overrides[host] ?? []) {
    const from = join(build.root, OVERRIDES_DIR, host, ...path.split('/'))
    const replaced = view.get(path)
    const hint = replaced?.conflictHint
    const merge = replaced?.merge
    const content = await readFile(from)
    view.set(path, {
      path,
      content,
      copyFrom: from,
      ...(hint === undefined ? {} : { conflictHint: hint }),
      ...(merge === undefined ? {} : { merge }),
    })
    for (const state of own) state.overridden.push(path)
  }
  return view
}

function generatedFile(file: OutputFile): HostFile {
  const segments = file.path.split('/')
  const valid =
    file.path !== '' &&
    !file.path.startsWith('/') &&
    !file.path.includes('\\') &&
    !segments.includes('..')
  if (!valid) throw new Error(`宿主模块返回了无效的文件路径：${file.path}`)
  const content =
    typeof file.content === 'string'
      ? Buffer.from(file.content, 'utf8')
      : Buffer.from(file.content)
  const hint = file.conflictHint
  return {
    path: file.path,
    content,
    copyFrom: null,
    ...(hint === undefined ? {} : { conflictHint: hint }),
    ...(file.merge === undefined ? {} : { merge: file.merge }),
  }
}

interface PathEntry {
  file: HostFile // 写出的文件：第一个宿主的文件，或合并结果
  readonly versions: HostFile[] // 各宿主的文件，按宿主顺序
  readonly hosts: HostName[]
  readonly hints: string[]
  differs: boolean
}

// 各宿主的同名文件内容一致时只写一次；不一致而都标为可合并时按命名空间合并，合并结果作为生成
// 的文件；否则记为冲突，列出写入该文件的全部宿主
function mergeViews(views: readonly HostView[]): {
  files: PlannedFile[]
  conflicts: Conflict[]
} {
  const entries = new Map<string, PathEntry>()
  for (const [host, view] of views) {
    for (const file of view.values()) {
      const entry = entries.get(file.path)
      const hint = file.conflictHint
      if (entry === undefined) {
        const hints = hint === undefined ? [] : [hint]
        entries.set(file.path, {
          file,
          versions: [file],
          hosts: [host],
          hints,
          differs: false,
        })
        continue
      }
      entry.versions.push(file)
      entry.hosts.push(host)
      if (hint !== undefined && !entry.hints.includes(hint)) entry.hints.push(hint)
      if (!entry.file.content.equals(file.content)) entry.differs = true
    }
  }
  for (const entry of entries.values()) {
    if (!entry.differs) continue
    const merged = mergeJsonExtensions(entry.versions)
    if (merged === null) continue
    entry.file = { path: entry.file.path, content: merged, copyFrom: null }
    entry.differs = false
  }
  const sorted = [...entries.values()].sort((a, b) => byPath(a.file, b.file))
  const files = sorted.map(({ file }) => ({
    path: file.path,
    content: file.content,
    copyFrom: file.copyFrom,
  }))
  const conflicts = sorted
    .filter(entry => entry.differs)
    .map(({ file, hosts, hints }) => ({ path: file.path, hosts, hints }))
  return { files, conflicts }
}

function conflictMessage(root: string, dir: PluginDir, conflict: Conflict): string {
  const shown = displayPath(root, join(dir.path, ...conflict.path.split('/')))
  const hosts = conflict.hosts.join('、')
  const hints = conflict.hints.map(hint => `；${hint}`).join('')
  return `合并布局冲突：${shown} 由 ${hosts} 生成，内容不同${hints}`
}

function byPath(a: { readonly path: string }, b: { readonly path: string }): number {
  return compare(a.path, b.path)
}
