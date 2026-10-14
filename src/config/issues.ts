// 配置、源项目与守卫读取共用的输入错误（模块接口 §8）
export interface InputIssue {
  // 相对配置文件所在目录，POSIX 分隔；没有对应文件时为 null
  readonly file: string | null
  // 字段路径以 . 连接，数组下标写作 [n]，如 'targets[2]'、'hosts.claude-code.dir'
  readonly field: string | null
  readonly message: string
}

export type Loaded<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly InputIssue[] }

export function loaded<T>(value: T): Loaded<T> {
  return { ok: true, value }
}

export function failed<T>(issues: readonly InputIssue[]): Loaded<T> {
  return { ok: false, issues }
}

// 字段路径：['targets', 2] → 'targets[2]'，
// ['hosts', 'claude-code', 'dir'] → 'hosts.claude-code.dir'
export function fieldPath(path: readonly PropertyKey[]): string | null {
  let out = ''
  for (const key of path) {
    if (typeof key === 'number') out += `[${key}]`
    else out += out === '' ? String(key) : `.${String(key)}`
  }
  return out === '' ? null : out
}
