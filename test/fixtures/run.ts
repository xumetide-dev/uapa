// 夹具运行器（F-10-02）：把 source/ 复制到临时目录，以 process.execPath 运行 uapa，
// 收集退出码、stdout、stderr 与运行后的整个源项目目录。格式见 README.md。
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { cp, mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const FIXTURES_DIR = fileURLToPath(new URL('.', import.meta.url))
const CLI = fileURLToPath(new URL('../../src/cli/main.ts', import.meta.url))

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

// PATH 只含一个空的临时目录，子进程环境不继承测试进程的环境变量
export async function runFixture(name: string, fixtureCase: FixtureCase) {
  const temp = await mkdtemp(join(tmpdir(), 'uapa-fixture-'))
  try {
    const project = join(temp, 'project')
    const path = join(temp, 'path')
    await cp(join(FIXTURES_DIR, name, 'source'), project, { recursive: true })
    await mkdir(path)
    const result = spawnSync(process.execPath, [CLI, ...fixtureCase.args], {
      cwd: project,
      env: { PATH: path },
      encoding: 'utf8',
    })
    const run: FixtureRun = {
      exitCode: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      tree: await readTree(project),
    }
    return run
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
