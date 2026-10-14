// 包入口：构建配置与守卫公共类型（F-01-01、F-02-01、F-02-02）。
export { defineConfig, type UapaConfig } from './config/types.ts'
export type {
  BeforePrompt,
  BeforeStop,
  BeforeTool,
  Capability,
  GuardPlugin,
  PromptSubmit,
  ToolCall,
} from './runtime/core/types.ts'
