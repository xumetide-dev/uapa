// 终端摘要（F-03-10）：按目标列出成功或失败，
// 以及跳过、降级、残余风险的数量和报告文件路径。
import type { BuildReport } from './types.ts'

// reportPath 为报告文件相对配置文件所在目录的路径；
// 返回以换行结尾的文本，由 cli 写到 stdout
export function formatSummary(report: BuildReport, reportPath: string): string {
  const lines = report.targets.map(target => {
    const status = target.status === 'ok' ? '成功' : '失败'
    const counts = [
      `跳过 ${target.skipped.length}`,
      `降级 ${target.degraded.length}`,
      `残余风险 ${target.residualRisks.length}`,
    ].join('，')
    return `${status} ${target.target}：${counts}`
  })
  lines.push(`构建报告：${reportPath}`)
  return `${lines.join('\n')}\n`
}
