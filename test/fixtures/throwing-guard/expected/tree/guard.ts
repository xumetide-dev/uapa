// 夹具守卫（TA-03）：每个检查都抛出 new Error('throwing-guard')，验证各子进程入口按该目标的
// 拒绝写法收口：执行前与提示提交前检查拒绝，停机前检查不阻止结束
import type { GuardPlugin } from 'uapa'

function fail(): never {
  throw new Error('throwing-guard')
}

const guard: GuardPlugin = {
  name: 'throwing-guard',
  requires: [],
  beforeTool: fail,
  beforePrompt: fail,
  beforeStop: fail,
}

export default guard
