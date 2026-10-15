// 夹具守卫：执行前检查一律放行；执行后检查按输出文本中的标记作答：uapa-replace-probe 换为
// uapa-replaced，含 uapa-withhold-probe 时扣留，含 uapa-throw-probe 时抛错，含
// uapa-invalid-probe 时返回空白的替换文本（无效），其余保留。只匹配无副作用的标记文本（见 AGENTS.md）
import type { AfterTool, GuardPlugin } from 'uapa'

function afterDecision(output: string): AfterTool {
  if (output.includes('uapa-throw-probe')) throw new Error('标记输出 uapa-throw-probe')
  if (output.includes('uapa-invalid-probe')) return { kind: 'replace', text: ' ' }
  if (output.includes('uapa-withhold-probe')) {
    return { kind: 'withhold', reason: '扣留标记输出 uapa-withhold-probe' }
  }
  if (output.includes('uapa-replace-probe')) {
    return {
      kind: 'replace',
      text: output.replaceAll('uapa-replace-probe', 'uapa-replaced'),
    }
  }
  return { kind: 'keep' }
}

const guard: GuardPlugin = {
  name: 'after-tool-guard',
  requires: [],
  beforeTool: () => ({ kind: 'allow' }),
  afterTool: (_call, output) => afterDecision(output),
}

export default guard
