// 计划写出的文件集合（模块接口 §8）：写出（F-03-05、F-03-06）与比对（F-03-08）都从它得出。
// 每个插件目录汇总各宿主模块生成的文件、skills（F-03-04）与覆盖文件（F-03-12）；合并布局中
// 同名文件内容不同时，写入该目录的全部目标失败，该目录不进入集合。
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type PluginDir, resolvePluginDirs } from '../config/layout.ts'
import { displayPath } from '../config/paths.ts'
import { type HostName, hostOf } from '../config/targets.ts'
import { compare } from '../source/files.ts'
import { OVERRIDES_DIR } from '../source/overrides.ts'
import type { Skill } from '../source/types.ts'
import type { OutputFile } from '../targets/types.ts'
import { type BuildInput, succeeded, type TargetState } from './state.ts'

export interface PlannedFile {
  readonly path: string // 相对插件目录，POSIX 分隔
  readonly content: Buffer
  // 复制的源文件（skills、覆盖文件）的绝对路径，写出时复制以保留文件权限；生成的文件为 null
  readonly copyFrom: string | null
}

export interface DirOutput {
  readonly dir: PluginDir
  readonly merged: boolean // 两个以上宿主写入该目录：不清空、不列出 removed
  readonly files: readonly PlannedFile[] // 按路径排序
  readonly targets: readonly TargetState[] // 写入该目录的成功目标
}

// 一个宿主在该目录中的文件；覆盖生成文件时继承其 conflictHint
interface HostFile extends PlannedFile {
  readonly conflictHint?: string
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
  // 合并布局的目录就是源项目根目录时，skills 已在原位，不复制
  const atRoot = dir.path === build.root
  const skills = atRoot ? [] : await skillFiles(build.root, skillUnion(targets))
  const views: HostView[] = []
  for (const host of dir.hosts) {
    const generated = hostFiles.get(host)
    if (generated === undefined) continue
    const own = targets.filter(s => hostOf(s.target) === host)
    views.push([host, await hostView(build, host, generated, skills, own)])
  }
  const { files, conflicts } = mergeViews(views)
  if (conflicts.length > 0) {
    const messages = conflicts.map(c => conflictMessage(build.root, dir, c))
    for (const state of targets) state.errors.push(...messages)
    return null
  }
  const present = atRoot ? build.source.skills : skillUnion(targets)
  recordSkillRisks(targets, present)
  return { dir, merged: dir.hosts.length > 1, files, targets }
}

// 生成的文件在前，再放 skills，最后用覆盖文件替换或新增；覆盖文件记入该宿主各目标的 overridden
async function hostView(
  build: BuildInput,
  host: HostName,
  generated: readonly OutputFile[],
  skills: readonly PlannedFile[],
  own: readonly TargetState[],
): Promise<Map<string, HostFile>> {
  const view = new Map<string, HostFile>()
  for (const file of generated) view.set(file.path, generatedFile(file))
  for (const file of skills) view.set(file.path, file)
  for (const path of build.source.overrides[host] ?? []) {
    const from = join(build.root, OVERRIDES_DIR, host, ...path.split('/'))
    const hint = view.get(path)?.conflictHint
    const content = await readFile(from)
    view.set(path, {
      path,
      content,
      copyFrom: from,
      ...(hint === undefined ? {} : { conflictHint: hint }),
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
  }
}

// 各宿主的同名文件内容一致时只写一次；不一致时记为冲突，列出写入该文件的全部宿主
function mergeViews(views: readonly HostView[]): {
  files: PlannedFile[]
  conflicts: Conflict[]
} {
  const entries = new Map<
    string,
    { file: HostFile; hosts: HostName[]; hints: string[]; differs: boolean }
  >()
  for (const [host, view] of views) {
    for (const file of view.values()) {
      const entry = entries.get(file.path)
      const hint = file.conflictHint
      if (entry === undefined) {
        const hints = hint === undefined ? [] : [hint]
        entries.set(file.path, { file, hosts: [host], hints, differs: false })
        continue
      }
      entry.hosts.push(host)
      if (hint !== undefined && !entry.hints.includes(hint)) entry.hints.push(hint)
      if (!entry.file.content.equals(file.content)) entry.differs = true
    }
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

// 写入该目录的成功目标所适用 skill 的并集，按名称排序
function skillUnion(targets: readonly TargetState[]): Skill[] {
  const union = new Map<string, Skill>()
  for (const state of targets) {
    for (const skill of state.plan?.skills ?? []) union.set(skill.name, skill)
  }
  return [...union.values()].sort(byName)
}

async function skillFiles(
  root: string,
  skills: readonly Skill[],
): Promise<PlannedFile[]> {
  const files: PlannedFile[] = []
  for (const skill of skills) {
    for (const file of skill.files) {
      const from = join(root, skill.dir, ...file.split('/'))
      const path = `skills/${skill.name}/${file}`
      files.push({ path, content: await readFile(from), copyFrom: from })
    }
  }
  return files
}

// 宿主按目录加载 skills：目录中有而不适用于某目标的 skill 记为该目标的残余风险（模块接口 §5）
function recordSkillRisks(
  targets: readonly TargetState[],
  present: readonly Skill[],
): void {
  for (const state of targets) {
    const own = new Set(state.plan?.skills.map(skill => skill.name))
    for (const skill of present.filter(s => !own.has(s.name))) {
      state.sharedSkillRisks.push(
        `skill ${skill.name} 不适用于本目标，但与其他目标共用插件目录，宿主仍会加载`,
      )
    }
  }
}

function byPath(a: { readonly path: string }, b: { readonly path: string }): number {
  return compare(a.path, b.path)
}

function byName(a: Skill, b: Skill): number {
  return compare(a.name, b.name)
}
