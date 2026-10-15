// 包入口：构建配置、命令 hooks 声明与守卫公共类型
// （F-01-01、F-01-09、F-02-01、F-02-02、F-02-04、F-02-05）。
export {
  type CommandHookDecl,
  type CommandHookEvent,
  defineConfig,
  type UapaConfig,
} from './config/types.ts'
export type {
  AfterTool,
  BeforePrompt,
  BeforeStop,
  BeforeTool,
  Capability,
  GuardContext,
  GuardOption,
  GuardPlugin,
  PromptSubmit,
  ToolCall,
} from './runtime/core/types.ts'
