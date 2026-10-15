// 构建配置校验（F-01-03）：字段类型与取值由 zod 检查，宿主与目标的对应关系、
// 插件目录的路径规则另行检查。错误给出字段路径（模块接口 §8）。
import { z } from 'zod'
import { failed, fieldPath, type InputIssue, type Loaded, loaded } from './issues.ts'
import { checkPluginDirs, configuredHosts } from './layout.ts'
import { HOSTS, type HostName, TARGETS } from './targets.ts'
import type { HostOptions, UapaConfig } from './types.ts'

// semver 2.0.0 规范给出的正则
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/

const text = z.string().min(1, '不能为空')
const relativeDir = text

const hostOptionSchemas: { [H in HostName]: z.ZodType<HostOptions[H]> } = {
  'claude-code': z.strictObject({
    dir: relativeDir.optional(),
    displayName: text.optional(),
    userConfig: z.unknown().optional(),
    dependencies: z.unknown().optional(),
    $schema: text.optional(),
  }),
  agy: z.strictObject({ dir: relativeDir.optional() }),
}

const targetName = z.enum(TARGETS, {
  error: issue => `未知目标名 ${JSON.stringify(issue.input)}`,
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
    .superRefine((targets, ctx) => {
      targets.forEach((target, index) => {
        if (targets.indexOf(target) !== index) {
          ctx.addIssue({
            code: 'custom',
            path: [index],
            message: `重复的目标 ${target}`,
          })
        }
      })
    }),
  outDir: relativeDir.optional(),
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
  issues.push(...checkPluginDirs(config, root, file))
  return issues.length > 0 ? failed(issues) : loaded(config)
}
