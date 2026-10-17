// 构建配置校验（F-01-03、F-01-09、F-01-14）：字段类型与取值由 zod 检查，宿主与目标的对应关系、
// 命令 hooks 声明的目标限定、插件目录与 marketplace 目录的路径规则另行检查。错误给出字段路径
// （模块接口 §8）。
import { posix, win32 } from 'node:path'
import { z } from 'zod'
import { failed, fieldPath, type InputIssue, type Loaded, loaded } from './issues.ts'
import { checkPluginDirs, configuredHosts } from './layout.ts'
import { checkMarketplace } from './marketplace.ts'
import { HOSTS, type HostName, TARGETS } from './targets.ts'
import {
  COMMAND_HOOK_EVENTS,
  type HostOptions,
  MANIFEST_RESERVED_KEYS,
  type UapaConfig,
} from './types.ts'

// semver 2.0.0 规范给出的正则
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/

const text = z.string().min(1, '不能为空')
const relativeDir = text
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

// 插件目录内的相对文件路径（模块接口 §2）：以 / 分隔，可以以 ./ 开头；不是绝对路径，
// 不含反斜杠、..、. 与空段
function isPluginFile(path: string): boolean {
  if (posix.isAbsolute(path) || win32.isAbsolute(path) || path.includes('\\'))
    return false
  const segments = path.split('/')
  const rest = segments[0] === '.' ? segments.slice(1) : segments
  return rest.length > 0 && rest.every(s => s !== '' && s !== '.' && s !== '..')
}

// 空字符串只报“不能为空”
const pluginFile = z
  .string()
  .min(1, { error: '不能为空', abort: true })
  .refine(isPluginFile, {
    error: '应为插件目录内以 / 分隔的相对文件路径，不得为绝对路径或含 ..',
  })

// 透传字段（SD-42）：保留键各记一条，字段写到键
const manifestFields = z
  .record(z.string(), z.unknown())
  .superRefine((manifest, ctx) => {
    const reserved: readonly string[] = MANIFEST_RESERVED_KEYS
    for (const key of Object.keys(manifest).filter(k => reserved.includes(k))) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: '由 UAPA 生成或依赖默认位置，不能透传',
      })
    }
  })

const hostOptionSchemas: { [H in HostName]: z.ZodType<HostOptions[H]> } = {
  'claude-code': z.strictObject({
    dir: relativeDir.optional(),
    displayName: text.optional(),
    userConfig: z.unknown().optional(),
    dependencies: z.unknown().optional(),
    $schema: text.optional(),
    manifest: manifestFields.optional(),
    onFailure: z.literal('block', { error: "只能为 'block'" }).optional(),
  }),
  codex: z.strictObject({
    dir: relativeDir.optional(),
    interface: z.record(z.string(), z.unknown()).optional(),
    hooksFile: pluginFile.optional(),
  }),
  agy: z.strictObject({ dir: relativeDir.optional() }),
}

const targetName = z.enum(TARGETS, {
  error: issue => `未知目标名 ${JSON.stringify(issue.input)}`,
})

// 列表中第二次及以后出现的目标各记一条
function noDuplicateTargets(targets: readonly string[], ctx: z.RefinementCtx): void {
  targets.forEach((target, index) => {
    if (targets.indexOf(target) !== index) {
      ctx.addIssue({ code: 'custom', path: [index], message: `重复的目标 ${target}` })
    }
  })
}

// 命令 hooks 声明（命令 hooks 声明第 1 节）：matcher、timeout 等字段按未知字段拒绝
const commandHook = z.strictObject({
  event: z.enum(COMMAND_HOOK_EVENTS, {
    error: issue => `未知事件 ${JSON.stringify(issue.input)}`,
  }),
  command: z
    .string()
    .min(1, { error: '不能为空', abort: true })
    .refine(command => !command.includes('\n') && !command.includes('\r'), {
      error: '应为单行，不能含换行',
    }),
  targets: z
    .array(targetName)
    .min(1, '至少列出一个目标')
    .superRefine(noDuplicateTargets)
    .optional(),
})

const configSchema = z.strictObject({
  name: text,
  version: z.string().regex(SEMVER, '不是 semver 版本号'),
  description: text,
  author: z
    .strictObject({ name: text, email: text.optional(), url: text.optional() })
    .optional(),
  keywords: z.array(text).optional(),
  guard: text.optional(),
  targets: z
    .array(targetName)
    .min(1, '至少配置一个目标')
    .superRefine(noDuplicateTargets),
  outDir: relativeDir.optional(),
  commandHooks: z.array(commandHook).optional(),
  marketplace: z
    .strictObject({
      name: z.string().regex(KEBAB_CASE, '不是 kebab-case'),
      owner: z.strictObject({ name: text, email: text.optional() }),
      dir: relativeDir.optional(),
    })
    .optional(),
  hosts: z.strictObject(hostOptionSchemas).partial().optional(),
})

const zh = z.locales.zhCN()

// 缺字段写“缺少必填字段”，其余沿用 zod 的中文消息
function errorMessage(issue: z.core.$ZodRawIssue): string | undefined {
  if (issue.code === 'invalid_type' && issue.input === undefined) return '缺少必填字段'
  return zh.localeError(issue) as string | undefined
}

function toIssues(error: z.ZodError, file: string): InputIssue[] {
  const issues: InputIssue[] = []
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        issues.push({
          file,
          field: fieldPath([...issue.path, key]),
          message: '未知字段',
        })
      }
    } else {
      issues.push({ file, field: fieldPath(issue.path), message: issue.message })
    }
  }
  return issues
}

export function validateConfig(
  value: unknown,
  file: string,
  root: string,
): Loaded<UapaConfig> {
  const parsed = configSchema.safeParse(value, { error: errorMessage })
  if (!parsed.success) return failed(toIssues(parsed.error, file))
  const config: UapaConfig = parsed.data
  const used = new Set(configuredHosts(config))
  const issues: InputIssue[] = []
  for (const host of HOSTS) {
    if (config.hosts?.[host] !== undefined && !used.has(host)) {
      issues.push({
        file,
        field: `hosts.${host}`,
        message: 'targets 中没有该宿主的目标',
      })
    }
  }
  issues.push(...unconfiguredHookTargets(config, file))
  issues.push(...checkPluginDirs(config, root, file))
  issues.push(...checkMarketplace(config, root, file))
  return issues.length > 0 ? failed(issues) : loaded(config)
}

// 命令 hooks 声明的 targets 只能含已配置的目标
function unconfiguredHookTargets(config: UapaConfig, file: string): InputIssue[] {
  const issues: InputIssue[] = []
  const hooks = config.commandHooks ?? []
  for (const [index, hook] of hooks.entries()) {
    for (const [at, target] of (hook.targets ?? []).entries()) {
      if (config.targets.includes(target)) continue
      issues.push({
        file,
        field: `commandHooks[${index}].targets[${at}]`,
        message: `${target} 不在 targets 中`,
      })
    }
  }
  return issues
}
