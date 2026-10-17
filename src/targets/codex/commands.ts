// 逐个检查 commands 的转换（F-06-13，SD-43）：Codex 安装兼容格式的插件时把 commands/*.md 转换为
// 技能，不满足条件的命令被静默跳过。条件按 rust-v0.162.1 core-plugins/src/command_migration.rs
// 与 command_migration/{plugin,render}.rs 照搬（codex-source-review.md「commands、rules 与用户
// 配置」）。没有 description 的命令也被跳过，但 UAPA 读取 commands 时已要求非空的 description
// （F-01-11），不会出现。
import { compare } from '../../source/files.ts'
import type { Command } from '../../source/types.ts'
import type { TargetSkip } from '../types.ts'

const SKILL_PREFIX = 'source-command'
const MAX_SKILL_NAME_LENGTH = 64 // MAX_SKILL_NAME_LEN，按字符计
const MAX_SKILL_BYTES = 4_000 // MAX_MIGRATED_COMMAND_SKILL_BYTES，转换后的 SKILL.md

// 先排除文件名为 README、技能名过长与含模板写法的命令，其余按技能名去重：多个命令得出同一
// 技能名时全部不转换；最后按转换结果的字节数检查
export function commandSkips(
  target: TargetSkip['target'],
  commands: readonly Command[],
): TargetSkip[] {
  const skip = (command: Command, reason: string): TargetSkip => ({
    target,
    component: `commands/${command.name}.md`,
    reason,
  })
  const skipped: TargetSkip[] = []
  const byName = new Map<string, Command[]>()
  for (const command of commands) {
    const reason = unsupportedReason(command)
    if (reason !== null) {
      skipped.push(skip(command, reason))
      continue
    }
    const name = skillName(command.name)
    byName.set(name, [...(byName.get(name) ?? []), command])
  }
  skipped.push(...checkGroupedCommands(byName, skip))
  return skipped.sort((a, b) => compare(a.component, b.component))
}

function checkGroupedCommands(
  byName: ReadonlyMap<string, readonly Command[]>,
  skip: (command: Command, reason: string) => TargetSkip,
): TargetSkip[] {
  const skipped: TargetSkip[] = []
  for (const [name, same] of byName) {
    if (same.length > 1) {
      const paths = same.map(command => `commands/${command.name}.md`).sort(compare)
      const reason = `${paths.join('、')} 转换后的技能名都是 ${name}，Codex 都不转换`
      skipped.push(...same.map(command => skip(command, reason)))
      continue
    }
    const [command] = same
    if (command === undefined) continue
    const bytes = Buffer.byteLength(renderedSkill(command, name), 'utf8')
    if (bytes > MAX_SKILL_BYTES) {
      const reason = `转换后的技能为 ${bytes} 字节，超过 Codex 的上限 4000 字节`
      skipped.push(skip(command, reason))
    }
  }
  return skipped
}

function unsupportedReason(command: Command): string | null {
  if (command.name === 'README') return 'Codex 不转换文件名为 README 的命令'
  const name = skillName(command.name)
  if ([...name].length > MAX_SKILL_NAME_LENGTH) {
    return `转换后的技能名 ${name} 超过 64 个字符，Codex 不转换`
  }
  const feature = templateFeature(command.body)
  if (feature !== null) return `正文含模板写法 ${feature}，Codex 不转换`
  return null
}

// has_unsupported_command_template_features 的各条件，返回命中的写法
function templateFeature(body: string): string | null {
  if (body.includes('$ARGUMENTS')) return '$ARGUMENTS'
  if (/\$[0-9]/.test(body)) return '$<数字>'
  if (body.includes('{{') && body.includes('}}')) return '{{…}}'
  if (body.includes('!`') || body.includes('! `')) return '!`…`'
  const tokens = body.split(/\s+/)
  if (tokens.some(token => token.startsWith('@') && token.length > 1)) return '@<文件>'
  return null
}

// command_skill_name：slugify_name(`source-command-<命令名>`)
function skillName(commandName: string): string {
  let slug = ''
  for (const char of `${SKILL_PREFIX}-${commandName}`) {
    if (/^[A-Za-z0-9]$/.test(char)) slug += char.toLowerCase()
    else if (!slug.endsWith('-')) slug += '-'
  }
  const trimmed = slug.replace(/^-+|-+$/g, '')
  return trimmed === '' ? 'migrated' : trimmed
}

// render_command_skill。description 取 frontmatter 的值去掉首尾空白（yaml_scalar）；插件的改写规则
// 只把大小写不同的 AGENTS.md 换为 AGENTS.md，不改变字节数，这里不做
function renderedSkill(command: Command, name: string): string {
  const body = command.body.trim()
  const template = body === '' ? 'No command template body was found.' : body
  return (
    `---\nname: ${yamlString(name)}\ndescription: ${yamlString(command.description.trim())}\n---\n\n` +
    `# ${name}\n\nUse this skill when the user asks to run the migrated source command ` +
    `\`${command.name}\`.\n\n## Command Template\n\n${template}\n`
  )
}

function yamlString(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}
