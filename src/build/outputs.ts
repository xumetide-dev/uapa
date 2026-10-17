// 计划写出的文件集合（构建产物「写出与比对」）：写出（F-03-05、F-03-06）与比对（F-03-08）都从
// 它得出。每个插件目录汇总各宿主模块生成的文件、构建编排放置的 skills、agents 与 commands
// （components.ts）、共用文件（F-03-17）与覆盖文件（F-03-12），各宿主的文件表见 placement.ts。
// 合并布局中同名文件内容不同时，标为可合并的 JSON 文件按命名空间合并（F-03-07，merge.ts），
// 其余为冲突：写入该目录的全部目标失败，该目录不进入集合。
import { type PluginDir, resolvePluginDirs } from '../config/layout.ts'
import { displayPath } from '../config/paths.ts'
import { type HostName, hostOf } from '../config/targets.ts'
import { compare } from '../source/files.ts'
import { SHARED_DIR } from '../source/shared.ts'
import type { OutputFile } from '../targets/types.ts'
import {
  componentFiles,
  componentPaths,
  componentUnion,
  recordComponentRisks,
} from './components.ts'
import { mergeJsonExtensions } from './merge.ts'
import {
  type DirLayers,
  type HostFile,
  hostView,
  sharedComponentConflicts,
  sharedFiles,
  shownIn,
} from './placement.ts'
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
  const shared = await sharedFiles(build.root, build.source.files)
  const outputs: DirOutput[] = []
  for (const dir of resolvePluginDirs(build.config, build.root)) {
    const output = await planDir(build, dir, states, hostFiles, shared)
    if (output !== null) outputs.push(output)
  }
  return outputs
}

// 该目录的目标全部失败，或有来源冲突、合并布局冲突时返回 null：该目录不写入也不比对
async function planDir(
  build: BuildInput,
  dir: PluginDir,
  states: readonly TargetState[],
  hostFiles: ReadonlyMap<HostName, readonly OutputFile[]>,
  shared: readonly PlannedFile[],
): Promise<DirOutput | null> {
  const targets = states.filter(
    s => dir.hosts.includes(hostOf(s.target)) && succeeded(s),
  )
  if (targets.length === 0) return null
  // 合并布局的目录就是源项目根目录时，组件已在原位，不复制，宿主加载源项目中的全部组件；
  // 共用文件不复制到源项目根目录，files/ 非空时该目录的目标失败
  const atRoot = dir.path === build.root
  if (atRoot && shared.length > 0) {
    for (const state of targets) state.errors.push(sharedAtRootMessage(build.root, dir))
    return null
  }
  const present = atRoot ? build.source : componentUnion(targets)
  const layers: DirLayers = {
    copied: atRoot ? [] : await componentFiles(build.root, present),
    inPlace: atRoot ? componentPaths(present) : [],
    shared,
  }
  const { views, messages } = await placeHosts(build, dir, targets, hostFiles, layers)
  const { files, conflicts } = mergeViews(views)
  messages.push(...conflicts.map(c => conflictMessage(build.root, dir, c)))
  if (messages.length > 0) {
    for (const state of targets) state.errors.push(...messages)
    return null
  }
  recordComponentRisks(targets, present)
  return { dir, merged: dir.hosts.length > 1, files, targets }
}

// 各宿主在该目录中的文件表，以及组件、共用文件与生成文件之间的来源冲突
async function placeHosts(
  build: BuildInput,
  dir: PluginDir,
  targets: readonly TargetState[],
  hostFiles: ReadonlyMap<HostName, readonly OutputFile[]>,
  layers: DirLayers,
): Promise<{ views: HostView[]; messages: string[] }> {
  const messages = sharedComponentConflicts(build.root, dir, layers)
  const views: HostView[] = []
  for (const host of dir.hosts) {
    const generated = hostFiles.get(host)
    if (generated === undefined) continue
    const own = targets.filter(s => hostOf(s.target) === host)
    const view = await hostView(build, dir, host, generated, layers, own)
    views.push([host, view.files])
    messages.push(...view.conflicts)
  }
  return { views, messages }
}

function sharedAtRootMessage(root: string, dir: PluginDir): string {
  return (
    `共用文件：插件目录 ${displayPath(root, dir.path)} 是源项目根目录，${SHARED_DIR}/ 中的文件` +
    '不复制到这里；把共用文件直接放在根目录，或改用默认布局'
  )
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
  const shown = shownIn(root, dir, conflict.path)
  const hosts = conflict.hosts.join('、')
  const hints = conflict.hints.map(hint => `；${hint}`).join('')
  return `合并布局冲突：${shown} 由 ${hosts} 生成，内容不同${hints}`
}

function byPath(a: { readonly path: string }, b: { readonly path: string }): number {
  return compare(a.path, b.path)
}
