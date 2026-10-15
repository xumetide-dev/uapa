// 能力检查：按 frontmatter 与组件承载为每个目标筛选 skills、agents、rules、commands 与 MCP
// 服务器（F-03-02、F-03-16），按守卫的 requires 与目标能力得出要生成 hook 的检查（F-03-13），
// 按事件承载得出命令 hooks 声明（F-03-15），合为 TargetPlan。
import type { TargetCapabilities } from '../capabilities/types.ts'
import { hostOf, type TargetName } from '../config/targets.ts'
import type { CommandHookDecl, UapaConfig } from '../config/types.ts'
import type { Capability, GuardCheck } from '../runtime/core/types.ts'
import type { GuardDeclaration } from '../source/guard.ts'
import type { McpServer, SourceProject } from '../source/types.ts'
import { type GatedCheck, newState, type TargetState } from './state.ts'

export function planTargets(
  config: UapaConfig,
  source: SourceProject,
  guard: GuardDeclaration | null,
  capabilities: Readonly<Record<TargetName, TargetCapabilities>>,
): TargetState[] {
  return config.targets.map(target => {
    const state = newState(target, capabilities[target])
    const skills = planComponents(state, 'skills', source.skills)
    const agents = planComponents(state, 'agents', source.agents)
    const rules = planComponents(state, 'rules', source.rules)
    const commands = planComponents(state, 'commands', source.commands)
    const mcpServers = planMcpServers(state, source.mcpServers)
    const checks = guard === null ? [] : planChecks(state, guard)
    const commandHooks = planCommandHooks(state, config, capabilities)
    if (state.errors.length === 0) {
      state.plan = {
        target,
        capabilities: state.capabilities,
        skills,
        agents,
        mcpServers,
        rules,
        commands,
        checks,
        commandHooks,
      }
    }
    return state
  })
}

interface Component {
  readonly name: string
  readonly targets: readonly TargetName[] | null
}

// 跳过项的 component 与错误信息中的写法
const COMPONENT_KINDS = {
  skills: { label: 'skill', path: (name: string) => `skills/${name}` },
  agents: { label: 'agent', path: (name: string) => `agents/${name}.md` },
  rules: { label: 'rule', path: (name: string) => `rules/${name}.md` },
  commands: { label: 'command', path: (name: string) => `commands/${name}.md` },
} as const

// 不适用本目标的组件不计；本目标不能承载该类组件时，
// 显式写了本目标的组件使目标失败，未写 targets 的列为跳过
function planComponents<T extends Component>(
  state: TargetState,
  kind: keyof typeof COMPONENT_KINDS,
  components: readonly T[],
): T[] {
  const carried = state.capabilities.components[kind] !== 'none'
  const { label, path } = COMPONENT_KINDS[kind]
  const planned: T[] = []
  for (const component of components) {
    const { name, targets } = component
    if (targets !== null && !targets.includes(state.target)) continue
    if (carried) planned.push(component)
    else if (targets !== null) {
      state.errors.push(`${label} ${name} 显式限定了本目标，但本目标不能承载 ${kind}`)
    } else {
      state.skipped.push({ component: path(name), reason: `本目标不能承载 ${kind}` })
    }
  }
  return planned
}

// MCP 服务器没有 targets：本目标不承载 MCP 时全部列为跳过
function planMcpServers(
  state: TargetState,
  servers: readonly McpServer[],
): McpServer[] {
  if (state.capabilities.components.mcp !== 'none') return [...servers]
  for (const server of servers) {
    state.skipped.push({
      component: `mcpServers.${server.name}`,
      reason: '本目标不能承载 MCP 服务器',
    })
  }
  return []
}

// 缺失时省略对应 hook 的能力（hooks 适配第 6 节）；rewriteInput 与 replaceOutput 缺失按降级处理
const GATE_OF_CHECK: Readonly<Record<GatedCheck, Capability>> = {
  beforePrompt: 'promptGate',
  beforeStop: 'stopGate',
  afterTool: 'withholdOutput',
}

// requires 中有本目标缺失的能力时目标失败；未列入 requires 的缺失能力记为降级或省略检查
function planChecks(state: TargetState, guard: GuardDeclaration): GuardCheck[] {
  const supported = state.capabilities.capabilities
  for (const capability of guard.requires.filter(c => !supported[c])) {
    state.errors.push(`守卫的 requires 声明了 ${capability}，本目标缺少该能力`)
  }
  if (state.errors.length > 0) return []
  if (guard.checks.includes('beforeTool') && !supported.rewriteInput) {
    state.degraded.push({
      decision: 'rewrite',
      as: 'deny',
      reason: '本目标不能改写入参，rewrite 按 fallbackReason 拒绝',
    })
  }
  // 执行后检查被省略时（缺 withholdOutput）没有 replace 可降级（SD-29）
  if (
    guard.checks.includes('afterTool') &&
    supported.withholdOutput &&
    !supported.replaceOutput
  ) {
    state.degraded.push({
      decision: 'replace',
      as: 'withhold',
      reason: '本目标不能替换输出，replace 的 text 作为扣留说明写出',
    })
  }
  return guard.checks.filter(check => {
    if (check === 'beforeTool' || supported[GATE_OF_CHECK[check]]) return true
    state.omitted.push(check)
    return false
  })
}

// 命令 hooks 声明的承载检查（command-hooks.md 第 4 节）：适用且本目标承载该事件的声明按声明
// 顺序列入；不承载时，targets 显式列出本目标则失败，否则列为跳过，同一宿主的另一目标承载时不写
function planCommandHooks(
  state: TargetState,
  config: UapaConfig,
  capabilities: Readonly<Record<TargetName, TargetCapabilities>>,
): CommandHookDecl[] {
  const planned: CommandHookDecl[] = []
  for (const [index, hook] of (config.commandHooks ?? []).entries()) {
    const explicit = hook.targets !== undefined
    if (explicit && !hook.targets.includes(state.target)) continue
    if (state.capabilities.commandHookEvents[hook.event] !== null) {
      planned.push(hook)
      continue
    }
    const reason = `本目标不承载 ${hook.event} 事件`
    if (explicit) {
      state.errors.push(`commandHooks[${index}] 显式限定了本目标，但${reason}`)
      continue
    }
    const carriedBySibling = config.targets.some(
      other =>
        other !== state.target &&
        hostOf(other) === hostOf(state.target) &&
        capabilities[other].commandHookEvents[hook.event] !== null,
    )
    if (!carriedBySibling)
      state.skipped.push({ component: `commandHooks[${index}]`, reason })
  }
  return planned
}
