// 构建编排的步骤（模块接口 §8、架构 §1）。宿主模块与能力数据的登记处以参数传入，
// 单元测试传入测试用的宿主模块与能力数据。
import type { TargetCapabilities } from '../capabilities/types.ts'
import type { TargetName } from '../config/targets.ts'
import type { UapaConfig } from '../config/types.ts'
import { readGuard, readSource } from '../source/index.ts'
import { compareOutputs } from './compare.ts'
import { generateHosts, type HostDeps } from './generate.ts'
import type { BuildOutcome } from './index.ts'
import { planOutputs } from './outputs.ts'
import { planTargets } from './plan.ts'
import { toReport, writeReport } from './report.ts'
import { verifyHosts } from './verify.ts'
import { writeOutputs } from './write.ts'

export interface BuildDeps extends HostDeps {
  readonly targetCapabilities: Readonly<Record<TargetName, TargetCapabilities>>
}

// 比对模式与构建共用到“计划写出的文件集合”为止：比对时不写文件、不调用宿主校验、不写报告
export async function runBuild(
  config: UapaConfig,
  root: string,
  options: { readonly check: boolean },
  deps: BuildDeps,
): Promise<BuildOutcome> {
  const source = await readSource(config, root)
  const guard = await readGuard(config, root)
  if (!source.ok || !guard.ok) {
    const issues = [
      ...(source.ok ? [] : source.issues),
      ...(guard.ok ? [] : guard.issues),
    ]
    return { kind: 'input-error', issues }
  }
  const build = { config, root, source: source.value, guard: guard.value }
  const states = planTargets(config, source.value, guard.value, deps.targetCapabilities)
  const hostFiles = await generateHosts(build, states, deps)
  const outputs = await planOutputs(build, states, hostFiles)
  if (options.check) {
    const changes = await compareOutputs(root, outputs)
    return { kind: 'done', report: toReport(states), reportPath: null, changes }
  }
  await writeOutputs(root, outputs)
  await verifyHosts(config, root, states, deps.hostModules)
  const report = toReport(states)
  const reportPath = await writeReport(config, root, report)
  return { kind: 'done', report, reportPath, changes: null }
}
