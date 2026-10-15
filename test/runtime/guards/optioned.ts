// 声明 number、boolean、string 各一个选项；各检查把收到的取值写入原因，供入口用例断言
import type { GuardContext, GuardPlugin } from '../../../src/index.ts'

const shown = (ctx: GuardContext) => JSON.stringify(ctx.options)

const guard: GuardPlugin = {
  name: 'optioned',
  requires: [],
  options: {
    limit: { type: 'number', title: '上限', description: '长度上限', default: 3 },
    strict: { type: 'boolean', title: '严格', description: '是否严格', default: true },
    label: {
      type: 'string',
      title: '标签',
      description: '原因前缀',
      default: 'alpha beta',
    },
  },
  beforeTool: (_call, ctx) => ({ kind: 'deny', reason: `before-tool ${shown(ctx)}` }),
  beforePrompt: (_p, ctx) => ({ kind: 'block', reason: `before-prompt ${shown(ctx)}` }),
  afterTool: (_call, _output, ctx) => ({
    kind: 'withhold',
    reason: `after-tool ${shown(ctx)}`,
  }),
  beforeStop: (_s, ctx) => ({ kind: 'continue', reason: `before-stop ${shown(ctx)}` }),
}

export default guard
