// 目标名与宿主标识的唯一定义处（模块接口 §1）。新增目标时在 TARGETS 中登记，
// 新宿主另在 HOSTS 中登记；HOSTS 的顺序决定插件目录与报告中宿主的先后。
// 未登记的目标名按未知目标名处理。

export const HOSTS = ['claude-code', 'codex', 'agy'] as const
export type HostName = (typeof HOSTS)[number]

export const TARGETS = [
  'claude-code:subprocess',
  'codex:subprocess',
  'agy:subprocess',
] as const
export type TargetName = (typeof TARGETS)[number]

// 目标名为 `<宿主>:<形态>`；宿主部分未在 HOSTS 中登记时下一行的赋值报错
type HostOf<T> = T extends `${infer H}:${string}` ? H : never
const targetHostsRegistered: HostOf<TargetName> extends HostName ? true : never = true
void targetHostsRegistered

export function isTargetName(value: unknown): value is TargetName {
  return typeof value === 'string' && (TARGETS as readonly string[]).includes(value)
}

export function hostOf(target: TargetName): HostName {
  // 上方的类型断言保证宿主部分已登记
  return target.slice(0, target.indexOf(':')) as HostName
}
