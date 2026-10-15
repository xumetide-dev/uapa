// 构建报告（F-03-09）：按目标顺序把构建状态转为报告，写到 <outDir>/uapa-report.json。
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { outDirOf } from '../config/layout.ts'
import { displayPath } from '../config/paths.ts'
import type { UapaConfig } from '../config/types.ts'
import type { BuildReport, TargetReport } from '../report/types.ts'
import type { GuardCheck } from '../runtime/core/types.ts'
import { type GatedCheck, succeeded, type TargetState } from './state.ts'

const CHECK_LABELS: Readonly<Record<GuardCheck, string>> = {
  beforeTool: '执行前检查',
  beforePrompt: '提示提交前检查',
  beforeStop: '停机前检查',
  afterTool: '执行后检查',
}

// 省略检查的原因（hooks 适配第 6 节）
const OMITTED_RISKS: Readonly<Record<GatedCheck, string>> = {
  beforePrompt: '本目标缺少 promptGate，未生成提示提交前检查的 hook：提示不受检查',
  beforeStop: '本目标缺少 stopGate，未生成停机前检查的 hook：停机不受检查',
  afterTool:
    '本目标缺少 withholdOutput，未生成执行后检查的 hook：执行后检查不生效，' +
    '模型能读到原始输出',
}

export function toReport(states: readonly TargetState[]): BuildReport {
  return { targets: states.map(toTargetReport) }
}

function toTargetReport(state: TargetState): TargetReport {
  return {
    target: state.target,
    status: succeeded(state) ? 'ok' : 'failed',
    errors: state.errors,
    host: { ...state.capabilities.host },
    units: state.unit === null ? [] : [{ kind: 'plugin', path: state.unit }],
    skipped: state.skipped,
    degraded: state.degraded,
    overridden: state.overridden,
    hostValidation: state.hostValidation,
    residualRisks: [
      ...capabilityRisks(state),
      ...state.sharedRisks,
      ...state.hostRisks,
    ],
  }
}

// 按能力数据生成的残余风险，顺序见构建报告文档「residualRisks」
function capabilityRisks(state: TargetState): string[] {
  const checks = state.plan?.checks ?? []
  const { failureDefault, hookTimeoutSeconds, defaultTimeoutSeconds } =
    state.capabilities
  const risks: string[] = []
  if (state.target.endsWith(':subprocess')) {
    for (const check of checks.filter(c => failureDefault[c].error === 'allow')) {
      risks.push(
        `缺少 Node ≥ 22 或入口无法启动时，${CHECK_LABELS[check]}` +
          '不生效（宿主在 hook 出错时放行）',
      )
    }
  }
  for (const check of state.omitted) risks.push(OMITTED_RISKS[check])
  if (
    checks.length > 0 &&
    hookTimeoutSeconds === null &&
    defaultTimeoutSeconds !== null
  ) {
    risks.push(`hooks 配置未写超时，沿用宿主默认超时 ${defaultTimeoutSeconds} 秒`)
  }
  return risks
}

// 返回报告文件的显示路径
export async function writeReport(
  config: UapaConfig,
  root: string,
  report: BuildReport,
): Promise<string> {
  const outDir = outDirOf(config, root)
  const path = join(outDir, 'uapa-report.json')
  await mkdir(outDir, { recursive: true })
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`)
  return displayPath(root, path)
}
