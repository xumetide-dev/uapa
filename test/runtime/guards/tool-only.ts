// 只实现执行前检查的守卫
import type { GuardPlugin } from '../../../src/index.ts'

const guard: GuardPlugin = {
  name: 'tool-only',
  requires: [],
  beforeTool: () => ({ kind: 'deny', reason: 'tool-only' }),
}

export default guard
