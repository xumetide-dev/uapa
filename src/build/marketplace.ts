// marketplace 文件的冲突检查与写出（F-03-18，SD-41）：在插件目录计划之后检查与插件目录文件的
// 同路径冲突；在宿主校验之后只为仍有成功目标的宿主写出，不清空所在目录。
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { marketplaceDirOf } from '../config/marketplace.ts'
import { displayPath } from '../config/paths.ts'
import { type HostName, hostOf } from '../config/targets.ts'
import type { OutputFile } from '../targets/types.ts'
import type { GeneratedHosts } from './generate.ts'
import { type DirOutput, planOutputs } from './outputs.ts'
import { type BuildInput, succeeded, type TargetState } from './state.ts'

export interface PlannedMarketplace {
  readonly host: HostName
  readonly targetPath: string // 绝对路径
  readonly shownPath: string // displayPath(root, targetPath)
  readonly content: Buffer
}

export async function planMarketplaces(
  build: BuildInput,
  states: readonly TargetState[],
  generated: GeneratedHosts,
  initialOutputs: readonly DirOutput[],
): Promise<{ outputs: readonly DirOutput[]; marketplaces: PlannedMarketplace[] }> {
  const dir = marketplaceDirOf(build.config, build.root)
  if (dir === null || generated.marketplaceFiles.size === 0) {
    return { outputs: initialOutputs, marketplaces: [] }
  }
  const pluginPaths = collectPluginPaths(initialOutputs)
  const failedHosts = new Set<HostName>()
  const marketplaces: PlannedMarketplace[] = []
  for (const [host, files] of generated.marketplaceFiles) {
    if (!hasSucceededTarget(states, host)) continue
    const items = toPlanned(build.root, dir, host, files)
    const collisions = items.filter(item => pluginPaths.has(item.targetPath))
    if (collisions.length > 0) {
      failHostTargets(states, host, collisions)
      failedHosts.add(host)
    } else marketplaces.push(...items)
  }
  if (failedHosts.size === 0) return { outputs: initialOutputs, marketplaces }
  return replanWithoutFailed(build, states, generated, marketplaces, failedHosts)
}

async function replanWithoutFailed(
  build: BuildInput,
  states: readonly TargetState[],
  generated: GeneratedHosts,
  marketplaces: PlannedMarketplace[],
  failedHosts: ReadonlySet<HostName>,
): Promise<{ outputs: readonly DirOutput[]; marketplaces: PlannedMarketplace[] }> {
  for (const host of failedHosts) generated.hostFiles.delete(host)
  for (const state of states) {
    state.overridden.length = 0
    state.sharedRisks.length = 0
  }
  const outputs = await planOutputs(build, states, generated.hostFiles)
  return { outputs, marketplaces }
}

function collectPluginPaths(outputs: readonly DirOutput[]): Set<string> {
  const paths = new Set<string>()
  for (const output of outputs) {
    for (const file of output.files) {
      paths.add(join(output.dir.path, ...file.path.split('/')))
    }
  }
  return paths
}

function toPlanned(
  root: string,
  dir: string,
  host: HostName,
  files: readonly OutputFile[],
): PlannedMarketplace[] {
  return files.map(file => {
    const targetPath = join(dir, ...file.path.split('/'))
    const content =
      typeof file.content === 'string'
        ? Buffer.from(file.content, 'utf8')
        : Buffer.from(file.content)
    return { host, targetPath, shownPath: displayPath(root, targetPath), content }
  })
}

function failHostTargets(
  states: readonly TargetState[],
  host: HostName,
  collisions: readonly PlannedMarketplace[],
): void {
  const messages = collisions.map(
    item => `marketplace 文件 ${item.shownPath} 与插件目录中的文件同路径`,
  )
  for (const state of states) {
    if (hostOf(state.target) === host) state.errors.push(...messages)
  }
}

function hasSucceededTarget(states: readonly TargetState[], host: HostName): boolean {
  return states.some(state => hostOf(state.target) === host && succeeded(state))
}

export async function writeMarketplaces(
  states: readonly TargetState[],
  marketplaces: readonly PlannedMarketplace[],
): Promise<void> {
  for (const item of marketplaces) {
    if (!hasSucceededTarget(states, item.host)) continue
    await mkdir(dirname(item.targetPath), { recursive: true })
    await writeFile(item.targetPath, item.content)
    for (const state of states) {
      if (hostOf(state.target) === item.host && succeeded(state)) {
        state.marketplaceUnits.push(item.shownPath)
      }
    }
  }
}
