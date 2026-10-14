// 写出后调用宿主校验（F-03-14）：对本次写出了文件且实现了 verify 的宿主，以插件目录的
// 绝对路径调用一次；failed 或抛错时该宿主的目标全部失败，已写出的文件保留。
import { resolvePluginDirs } from '../config/layout.ts'
import { type HostName, hostOf } from '../config/targets.ts'
import type { UapaConfig } from '../config/types.ts'
import type { HostModule, VerifyResult } from '../targets/types.ts'
import type { TargetState } from './state.ts'

export async function verifyHosts(
  config: UapaConfig,
  root: string,
  states: readonly TargetState[],
  hostModules: Readonly<Record<HostName, HostModule>>,
): Promise<void> {
  for (const dir of resolvePluginDirs(config, root)) {
    for (const host of dir.hosts) {
      const written = states.filter(s => hostOf(s.target) === host && s.unit !== null)
      const module = hostModules[host]
      const verify = module.verify
      if (written.length === 0 || verify === undefined) continue
      const result = await settle(() => verify.call(module, dir.path))
      for (const state of written) {
        state.hostValidation = result.status
        if (result.status === 'failed') state.errors.push(...result.errors)
      }
    }
  }
}

// verify 抛错时按失败处理，错误为异常消息
async function settle(run: () => Promise<VerifyResult>): Promise<VerifyResult> {
  try {
    return await run()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { status: 'failed', errors: [message] }
  }
}
