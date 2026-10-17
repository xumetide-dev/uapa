// 一个宿主在插件目录中的文件表（构建产物「写出与比对」的放置顺序）：宿主模块生成的文件、
// 复制的组件（components.ts）、共用文件（F-03-17），最后是覆盖文件（F-03-12）。前三者中任意
// 两者同路径时为来源冲突，写入该目录的全部目标失败；覆盖文件可以替换其中任何一个。
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PluginDir } from '../config/layout.ts'
import { displayPath } from '../config/paths.ts'
import type { HostName } from '../config/targets.ts'
import { OVERRIDES_DIR } from '../source/overrides.ts'
import { SHARED_DIR } from '../source/shared.ts'
import type { OutputFile } from '../targets/types.ts'
import type { PlannedFile } from './outputs.ts'
import type { BuildInput, TargetState } from './state.ts'

// 一个宿主在该目录中的文件；覆盖生成文件时继承其 conflictHint 与 merge
export interface HostFile extends PlannedFile {
  readonly conflictHint?: string
  readonly merge?: 'json-extensions'
}

// 插件目录中与宿主无关的文件。目录是源项目根目录时组件不复制，copied 为空，inPlace 为原位的
// 组件文件路径，只参与同路径检查
export interface DirLayers {
  readonly copied: readonly PlannedFile[]
  readonly inPlace: readonly string[]
  readonly shared: readonly PlannedFile[]
}

export interface PlacedFiles {
  readonly files: ReadonlyMap<string, HostFile>
  readonly conflicts: readonly string[] // 生成的文件与组件文件或共用文件同路径时的错误
}

// files/ 中的文件，路径相对 files/；写出时复制以保留文件权限
export async function sharedFiles(
  root: string,
  paths: readonly string[],
): Promise<PlannedFile[]> {
  const files: PlannedFile[] = []
  for (const path of paths) {
    const from = join(root, SHARED_DIR, ...path.split('/'))
    files.push({ path, content: await readFile(from), copyFrom: from })
  }
  return files
}

// 复制的组件与共用文件同路径时的错误；与宿主无关，每个目录检查一次
export function sharedComponentConflicts(
  root: string,
  dir: PluginDir,
  layers: DirLayers,
): string[] {
  const componentPaths = new Set(layers.copied.map(file => file.path))
  const overrides = dir.hosts.map(host => `${OVERRIDES_DIR}/${host}/`).join(' 或 ')
  return layers.shared
    .filter(file => componentPaths.has(file.path))
    .map(
      file =>
        `同路径冲突：${shownIn(root, dir, file.path)} 既是复制的组件文件，又是共用文件 ` +
        `${SHARED_DIR}/${file.path}；替换组件文件改用 ${overrides}`,
    )
}

// 生成的文件在前，再放复制的组件与共用文件，最后用覆盖文件替换或新增；覆盖文件记入该宿主各
// 目标的 overridden
export async function hostView(
  build: BuildInput,
  dir: PluginDir,
  host: HostName,
  generated: readonly OutputFile[],
  layers: DirLayers,
  own: readonly TargetState[],
): Promise<PlacedFiles> {
  const view = new Map<string, HostFile>()
  for (const file of generated) view.set(file.path, generatedFile(file))
  const conflicts = generatedConflicts(build.root, dir, host, view, layers)
  for (const file of layers.copied) view.set(file.path, file)
  for (const file of layers.shared) view.set(file.path, file)
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
  return { files: view, conflicts }
}

// 生成的文件与组件文件（复制的或原位的）、共用文件同路径时各记一条；生成该文件的宿主模块给出
// conflictHint 时附在其后
function generatedConflicts(
  root: string,
  dir: PluginDir,
  host: HostName,
  generated: ReadonlyMap<string, HostFile>,
  layers: DirLayers,
): string[] {
  const components: [string, string][] = [
    ...layers.copied.map(({ path }): [string, string] => [path, '复制的组件文件']),
    ...layers.inPlace.map((path): [string, string] => [path, '源项目中的组件文件']),
  ]
  const conflicts: string[] = []
  for (const [path, what] of components) {
    const file = generated.get(path)
    if (file === undefined) continue
    const hint = file.conflictHint === undefined ? '' : `；${file.conflictHint}`
    conflicts.push(
      `同路径冲突：${shownIn(root, dir, path)} 既由 ${host} 生成，又是${what}${hint}`,
    )
  }
  for (const { path } of layers.shared) {
    if (!generated.has(path)) continue
    conflicts.push(
      `同路径冲突：${shownIn(root, dir, path)} 既由 ${host} 生成，又是共用文件 ` +
        `${SHARED_DIR}/${path}；替换生成文件改用 ${OVERRIDES_DIR}/${host}/`,
    )
  }
  return conflicts
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

export function shownIn(root: string, dir: PluginDir, path: string): string {
  return displayPath(root, join(dir.path, ...path.split('/')))
}
