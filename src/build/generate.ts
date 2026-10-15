// 按宿主调用宿主模块（F-03-03）：只传入通过能力检查的目标；一个宿主失败不影响其他宿主。
import type { BundleRequest } from '../bundle/types.ts'
import { resolvePluginDirs } from '../config/layout.ts'
import { HOSTS, type HostName, hostOf } from '../config/targets.ts'
import type { HostInput, HostModule, HostResult, OutputFile } from '../targets/types.ts'
import type { BuildInput, TargetState } from './state.ts'

export interface HostDeps {
  readonly hostModules: Readonly<Record<HostName, HostModule>>
  readonly bundle: (request: BundleRequest) => Promise<string>
}

// 返回各宿主生成成功的文件；失败的宿主不在结果中，其目标的 errors 已填写
export async function generateHosts(
  build: BuildInput,
  states: readonly TargetState[],
  deps: HostDeps,
): Promise<Map<HostName, readonly OutputFile[]>> {
  const { config, guard } = build
  const dirs = resolvePluginDirs(config, build.root)
  const files = new Map<HostName, readonly OutputFile[]>()
  for (const host of HOSTS) {
    const hostStates = states.filter(state => hostOf(state.target) === host)
    const plans = hostStates.flatMap(state => (state.plan === null ? [] : [state.plan]))
    if (plans.length === 0) continue
    const dirHosts = dirs.find(dir => dir.hosts.includes(host))?.hosts ?? []
    const sharedWith = dirHosts.filter(other => other !== host)
    const input = { config, plans, guard, sharedWith, bundle: deps.bundle }
    const result = await callHost(deps.hostModules[host], input)
    for (const state of hostStates.filter(s => s.plan !== null)) {
      const own = (notes: readonly { target: string; message: string }[]) =>
        notes.filter(note => note.target === state.target).map(note => note.message)
      if (result.ok) {
        // 宿主模块的跳过项排在能力检查的跳过项之后（构建报告「skipped」）
        for (const skip of result.skipped.filter(s => s.target === state.target)) {
          state.skipped.push({ component: skip.component, reason: skip.reason })
        }
        state.hostRisks.push(...own(result.residualRisks))
      } else if ('thrown' in result)
        state.errors.push(`同一宿主的生成失败: ${result.thrown}`)
      else {
        const messages = own(result.errors)
        state.errors.push(...(messages.length > 0 ? messages : ['同一宿主的生成失败']))
      }
    }
    if (result.ok) files.set(host, result.files)
  }
  return files
}

type CallResult = HostResult | { readonly ok: false; readonly thrown: string }

// generate 抛错（含打包失败）时该宿主的目标全部失败，错误为异常消息
async function callHost(module: HostModule, input: HostInput): Promise<CallResult> {
  try {
    return await module.generate(input)
  } catch (error) {
    return { ok: false, thrown: error instanceof Error ? error.message : String(error) }
  }
}
