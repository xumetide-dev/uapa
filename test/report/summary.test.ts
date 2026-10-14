// 终端摘要（F-03-10）
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatSummary } from '../../src/report/summary.ts'
import type { TargetReport } from '../../src/report/types.ts'

const base: TargetReport = {
  target: 'claude-code:subprocess',
  status: 'ok',
  errors: [],
  host: {
    name: 'claude-code',
    version: '2.1.296',
    checked: '2026-10-13',
    source: 's.md',
  },
  units: [],
  skipped: [],
  degraded: [],
  overridden: [],
  hostValidation: 'none',
  residualRisks: [],
}

test('按目标列出结果与各项数量，最后一行为报告路径', () => {
  const failed: TargetReport = {
    ...base,
    target: 'other:subprocess',
    status: 'failed',
    skipped: [{ component: 'skills/a', reason: 'r' }],
    degraded: [{ decision: 'rewrite', as: 'deny', reason: 'r' }],
    residualRisks: ['a', 'b'],
  }
  assert.equal(
    formatSummary({ targets: [base, failed] }, 'dist/uapa-report.json'),
    '成功 claude-code:subprocess：跳过 0，降级 0，残余风险 0\n' +
      '失败 other:subprocess：跳过 1，降级 1，残余风险 2\n' +
      '构建报告：dist/uapa-report.json\n',
  )
})
