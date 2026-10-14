// 入口用例：以 process.execPath 运行打包后的入口；子进程环境只含用例给出的变量
import { spawnSync } from 'node:child_process'

export interface EntryResult {
  readonly status: number | null
  readonly stdout: string
  readonly stderr: string
}

export function runEntry(
  file: string,
  args: readonly string[],
  stdin: string,
  env: Readonly<Record<string, string>> = {},
): EntryResult {
  const result = spawnSync(process.execPath, [file, ...args], {
    input: stdin,
    env,
    encoding: 'utf8',
    timeout: 30_000,
  })
  if (result.error !== undefined) throw result.error
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}
