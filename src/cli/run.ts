// 命令行（F-09-01～F-09-04）：构建器中只有本模块读取命令行参数、
// 向终端输出与设置退出码。退出码与错误输出格式见模块接口 §8。
import { readFileSync } from 'node:fs'
import { realpath } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { type BuildOutcome, build } from '../build/index.ts'
import type { InputIssue } from '../config/issues.ts'
import { loadConfig } from '../config/load.ts'
import { formatSummary } from '../report/summary.ts'
import { HELP, parseCommand } from './args.ts'

export interface Io {
  stdout(text: string): void
  stderr(text: string): void
}

export interface CliDeps {
  readonly loadConfig: typeof loadConfig
  readonly build: typeof build
}

const DEFAULT_CONFIG = 'uapa.config.ts'

export async function run(
  argv: readonly string[],
  cwd: string,
  io: Io,
  deps: CliDeps = { loadConfig, build },
): Promise<number> {
  const command = parseCommand(argv)
  switch (command.kind) {
    case 'help':
      io.stdout(HELP)
      return 0
    case 'version':
      io.stdout(`${packageVersion()}\n`)
      return 0
    case 'usage-error':
      io.stderr(`uapa: ${command.message}\n`)
      return 2
    case 'build': {
      const configPath = resolve(cwd, command.config ?? DEFAULT_CONFIG)
      return runBuild(configPath, { check: command.check }, io, deps)
    }
  }
}

// options 原样传给 build
async function runBuild(
  configPath: string,
  options: { readonly check: boolean },
  io: Io,
  deps: CliDeps,
): Promise<number> {
  try {
    // 报告与错误中的路径相对配置文件所在目录；
    // 取真实路径，使其与 Node 报告的模块路径一致
    const root = await realpath(dirname(configPath)).catch(() => dirname(configPath))
    const config = await deps.loadConfig(join(root, basename(configPath)))
    if (!config.ok) {
      writeIssues(config.issues, io)
      return 2
    }
    const outcome = await deps.build(config.value, root, options)
    writeOutcome(outcome, io)
    return exitCodeOf(outcome)
  } catch (error) {
    // 宿主模块之外的未预期异常：按 2 处理并输出堆栈
    const detail =
      error instanceof Error ? (error.stack ?? error.message) : String(error)
    io.stderr(`uapa: 未预期的错误：${detail}\n`)
    return 2
  }
}

export function exitCodeOf(outcome: BuildOutcome): 0 | 1 | 2 {
  if (outcome.kind === 'input-error') return 2
  const failed = outcome.report.targets.some(target => target.status === 'failed')
  const changed = outcome.changes !== null && outcome.changes.length > 0
  return failed || changed ? 1 : 0
}

function writeIssues(issues: readonly InputIssue[], io: Io): void {
  for (const issue of issues) {
    const where = [issue.file, issue.field].filter(part => part !== null)
    io.stderr(`uapa: ${[...where, issue.message].join(': ')}\n`)
  }
}

function writeOutcome(outcome: BuildOutcome, io: Io): void {
  if (outcome.kind === 'input-error') {
    writeIssues(outcome.issues, io)
    return
  }
  for (const target of outcome.report.targets) {
    for (const error of target.errors) io.stderr(`uapa: ${target.target}: ${error}\n`)
  }
  // --check 只写差异行，无差异时 stdout 为空
  if (outcome.changes !== null) {
    for (const { change, path } of outcome.changes) io.stdout(`${change} ${path}\n`)
  } else if (outcome.reportPath !== null) {
    io.stdout(formatSummary(outcome.report, outcome.reportPath))
  }
}

function packageVersion(): string {
  const manifest = new URL('../../package.json', import.meta.url)
  return (JSON.parse(readFileSync(manifest, 'utf8')) as { version: string }).version
}
