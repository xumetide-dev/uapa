// 构建编排的步骤（模块接口 §8、架构 §1）。宿主模块与能力数据的登记处以参数传入，
// 单元测试传入测试用的宿主模块与能力数据。
import type { TargetCapabilities } from '../capabilities/types.ts'
import type { TargetName } from '../config/targets.ts'
import type { UapaConfig } from '../config/types.ts'
import { readGuard, readSource } from '../source/index.ts'
import { generateHosts, type HostDeps } from './generate.ts'
import type { BuildOutcome } from './index.ts'
import { planTargets } from './plan.ts'
import { toReport, writeReport } from './report.ts'
import { writeOutputs } from './write.ts'

export interface BuildDeps extends HostDeps {
  readonly targetCapabilities: Readonly<Record<TargetName, TargetCapabilities>>
}

export async function runBuild(
  config: UapaConfig,
  root: string,
  options: { readonly check: boolean },
  deps: BuildDeps,
): Promise<BuildOutcome> {
  if (options.check) throw new Error('比对模式尚未实现（F-03-08）')
  const source = await readSource(config, root)
  const guard = await readGuard(config, root)
  if (!source.ok || !guard.ok) {
    const issues = [
      ...(source.ok ? [] : source.issues),
      ...(guard.ok ? [] : guard.issues),
    ]
    return { kind: 'input-error', issues }
  }
  const states = planTargets(config, source.value, guard.value, deps.targetCapabilities)
  const hostFiles = await generateHosts(config, guard.value, states, deps)
  await writeOutputs(config, root, states, hostFiles)
  const report = toReport(states)
  const reportPath = await writeReport(config, root, report)
  return { kind: 'done', report, reportPath, changes: null }
}
