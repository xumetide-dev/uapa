// 夹具运行器（F-10-02）：把 source/ 复制到临时目录，以 process.execPath 运行 uapa，
// 收集退出码、stdout、stderr 与运行后的整个源项目目录；入口用例在同一份产物上运行。
// 格式见 README.md。
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { chmod, cp, mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TARGETS, type TargetName } from '../../src/config/targets.ts'

export const FIXTURES_DIR = fileURLToPath(new URL('.', import.meta.url))
const CLI = fileURLToPath(new URL('../../src/cli/main.ts', import.meta.url))

// 子进程目标的入口文件，相对插件目录（入口与打包接口第 2 节）
const ENTRY_FILES: Readonly<Partial<Record<TargetName, string>>> = {
  'claude-code:subprocess': 'hooks/uapa-claude-code.mjs',
  'codex:subprocess': 'hooks/uapa-codex.mjs',
  'agy:subprocess': 'hooks/uapa-agy.mjs',
}

export interface FixtureCase {
  readonly args: readonly string[]
  readonly exitCode: number
}

export interface FixtureRun {
  readonly exitCode: number | null
  readonly stdout: string
  readonly stderr: string
  // 相对源项目根的 POSIX 路径 → 内容，按路径排序
  readonly tree: ReadonlyMap<string, Buffer>
  readonly project: string // 运行后的源项目目录；回调结束后删除
}

// 入口用例：expected/stdin/<目标名，冒号换为 ->/<用例>.json
export interface EntryCase {
  readonly target: TargetName
  readonly name: string
  readonly args: readonly string[]
  readonly stdin: unknown // 字符串原样写入 stdin，其余按 JSON 写入
  readonly env: Readonly<Record<string, string>>
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

export interface EntryResult {
  readonly exitCode: number | null
  readonly stdout: string
  readonly stderr: string
}

// 含 case.json 的子目录即一个夹具
export function fixtureNames(): string[] {
  return readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => existsSync(join(FIXTURES_DIR, name, 'case.json')))
    .sort()
}

export async function readCase(name: string): Promise<FixtureCase> {
  const text = await readFile(join(FIXTURES_DIR, name, 'case.json'), 'utf8')
  return JSON.parse(text) as FixtureCase
}

// PATH 只含一个临时目录，夹具的 path/ 中的文件复制到其中（verify-failed 外为空）；
// 子进程环境不继承测试进程的环境变量
export async function withFixtureRun<T>(
  name: string,
  fixtureCase: FixtureCase,
  inspect: (run: FixtureRun) => Promise<T>,
): Promise<T> {
  const temp = await mkdtemp(join(tmpdir(), 'uapa-fixture-'))
  try {
    const project = join(temp, 'project')
    const path = join(temp, 'path')
    await cp(join(FIXTURES_DIR, name, 'source'), project, { recursive: true })
    await mkdir(path)
    const bin = join(FIXTURES_DIR, name, 'path')
    if (existsSync(bin)) {
      await cp(bin, path, { recursive: true })
      for (const file of await readdir(path)) await chmod(join(path, file), 0o755)
    }
    const result = spawnSync(process.execPath, [CLI, ...fixtureCase.args], {
      cwd: project,
      env: { PATH: path },
      encoding: 'utf8',
    })
    return await inspect({
      exitCode: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      tree: await readTree(project),
      project,
    })
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
}

export async function readTree(dir: string): Promise<Map<string, Buffer>> {
  const tree = new Map<string, Buffer>()
  if (!existsSync(dir)) return tree
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  const files = entries
    .filter(entry => entry.isFile())
    .map(entry =>
      relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'),
    )
    .sort()
  for (const file of files)
    tree.set(file, await readFile(join(dir, ...file.split('/'))))
  return tree
}

export async function readEntryCases(name: string): Promise<EntryCase[]> {
  const dir = join(FIXTURES_DIR, name, 'expected', 'stdin')
  if (!existsSync(dir)) return []
  const cases: EntryCase[] = []
  for (const targetDir of (await readdir(dir)).sort()) {
    const target = TARGETS.find(t => t.replace(':', '-') === targetDir)
    if (target === undefined)
      throw new Error(`${name}: 未知目标目录 stdin/${targetDir}`)
    for (const file of (await readdir(join(dir, targetDir))).sort()) {
      const text = await readFile(join(dir, targetDir, file), 'utf8')
      const fields = JSON.parse(text) as Omit<EntryCase, 'target' | 'name'>
      cases.push({ ...fields, env: fields.env ?? {}, target, name: file })
    }
  }
  return cases
}

// 产物中目标的插件目录取自构建报告的 units
async function pluginDir(run: FixtureRun, target: TargetName): Promise<string> {
  const reports = [...run.tree.keys()].filter(p => p.endsWith('uapa-report.json'))
  if (reports.length !== 1) throw new Error('产物中应恰有一个 uapa-report.json')
  const report = JSON.parse(run.tree.get(reports[0] as string)?.toString('utf8') ?? '')
  const entry = report.targets.find((t: { target: string }) => t.target === target)
  const unit = entry?.units?.[0]?.path
  if (typeof unit !== 'string') throw new Error(`构建报告中 ${target} 没有安装单位`)
  return join(run.project, ...unit.split('/'))
}

// 以插件目录为工作目录运行入口；{dataDir} 换为本用例新建的临时目录。extraEnv 另加入子进程
// 环境（TA-05 的第二次运行），不做替换
export async function runEntryCase(
  run: FixtureRun,
  entryCase: EntryCase,
  extraEnv: Readonly<Record<string, string>> = {},
): Promise<{ result: EntryResult; expected: EntryResult }> {
  const entryFile = ENTRY_FILES[entryCase.target]
  if (entryFile === undefined) throw new Error(`${entryCase.target} 没有子进程入口`)
  const dir = await pluginDir(run, entryCase.target)
  const dataDir = await mkdtemp(join(tmpdir(), 'uapa-data-'))
  try {
    const fill = (text: string) => text.split('{dataDir}').join(dataDir)
    const stdin =
      typeof entryCase.stdin === 'string'
        ? entryCase.stdin
        : JSON.stringify(entryCase.stdin)
    const env = {
      ...Object.fromEntries(
        Object.entries(entryCase.env).map(([key, value]) => [key, fill(value)]),
      ),
      ...extraEnv,
    }
    const spawned = spawnSync(
      process.execPath,
      [join(dir, ...entryFile.split('/')), ...entryCase.args.map(fill)],
      { cwd: dir, env, input: fill(stdin), encoding: 'utf8', timeout: 30_000 },
    )
    return {
      result: {
        exitCode: spawned.status,
        stdout: spawned.stdout,
        stderr: spawned.stderr,
      },
      expected: {
        exitCode: entryCase.exitCode,
        stdout: fill(entryCase.stdout),
        stderr: fill(entryCase.stderr),
      },
    }
  } finally {
    await rm(dataDir, { recursive: true, force: true })
  }
}
