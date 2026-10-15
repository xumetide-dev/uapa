// 发布脚本（F-10-04、F-10-05；TA-10、TA-14）。在仓库中以 Node 24 运行：
//
//   node scripts/release.ts --node22 <Node 22.0.0 的可执行文件>
//
// 依次执行：前置检查（参数、工作区干净、位于 main、tag 未存在、两个 Node 的版本）→ pnpm check →
// TA-14 → 编译 dist/ → 在 main 之上创建含 dist/ 的发布提交并打 vX.Y.Z tag → 安装冒烟。
// 不推送。发布提交经临时索引创建，main、暂存区与已跟踪文件不变；仓库中只写 dist/、提交与 tag。
// 安装冒烟失败时删除本次创建的 tag，发布提交随之不再被引用。
import { type SpawnSyncReturns, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isDeepStrictEqual, parseArgs } from 'node:util'
import {
  FIXTURES_DIR,
  readCase,
  readEntryCases,
  readTree,
  runEntryCase,
  withFixtureRun,
} from '../test/fixtures/run.ts'

const NODE22_VERSION = 'v22.0.0' // 子进程入口支持的最低版本（F-04-06）
const RELEASE_NODE_MAJOR = 24
// TA-03、full 与 after-tool（v0.2.0 的执行后检查）夹具的入口用例
const TA14_FIXTURES = ['throwing-guard', 'full', 'after-tool']
const SMOKE_FIXTURE = 'full'
const RELEASE_COMMIT_BODY = '含 dist/ 的发布提交，只由 tag 引用；main 不含 dist/。'
// 安装冒烟的安装命令：任何依赖的构建脚本未获放行即安装失败，不受维护者 pnpm 配置的影响
const SMOKE_INSTALL = [
  'install',
  '--config.strict-dep-builds=true',
  '--config.dangerously-allow-all-builds=false',
]

// 安装冒烟前把夹具配置改为以 defineConfig 包裹（覆盖值导入，F-10-05）；每处须恰好出现一次
const CONFIG_REWRITES: readonly (readonly [string, string])[] = [
  ["import type { UapaConfig } from 'uapa'\n", "import { defineConfig } from 'uapa'\n"],
  ['export default {\n', 'export default defineConfig({\n'],
  ['} satisfies UapaConfig\n', '})\n'],
]

// 发布条件不满足；main 只输出消息，不输出调用栈
export class ReleaseError extends Error {}

export async function release(root: string, argv: readonly string[]): Promise<void> {
  const node22 = parseNode22(argv)
  const tag = `v${await packageVersion(root)}`
  checkWorktree(root, tag)
  checkNodeVersions(node22)
  run('pnpm', ['check'], root)
  for (const line of await runTa14(node22)) console.log(line)
  await compileDist(root)
  const commit = createReleaseCommit(root, tag)
  try {
    await installSmoke(root, tag)
  } catch (error) {
    git(root, ['tag', '--delete', tag])
    throw error
  }
  console.log(
    `安装冒烟：以 git 依赖安装 ${tag}，对 ${SMOKE_FIXTURE} 夹具的构建结果与期望一致`,
  )
  console.log(`已创建发布提交 ${commit} 与 tag ${tag}，未推送`)
}

function parseNode22(argv: readonly string[]): string {
  let values: { node22?: string | undefined }
  try {
    const options = { node22: { type: 'string' } } as const
    values = parseArgs({ args: [...argv], options, strict: true }).values
  } catch (error) {
    throw new ReleaseError((error as Error).message)
  }
  if (values.node22 === undefined)
    throw new ReleaseError(
      `缺少 --node22 <Node ${NODE22_VERSION} 的可执行文件>（TA-14）`,
    )
  return values.node22
}

async function packageVersion(root: string): Promise<string> {
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  if (typeof manifest.version !== 'string')
    throw new ReleaseError('package.json 没有 version 字段')
  return manifest.version
}

function checkWorktree(root: string, tag: string): void {
  if (git(root, ['status', '--porcelain']) !== '')
    throw new ReleaseError('工作区不干净：先提交或清理改动（git status）')
  const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD'])
  if (branch !== 'main') throw new ReleaseError(`须在 main 上发布，当前为 ${branch}`)
  if (git(root, ['tag', '--list', tag]) !== '')
    throw new ReleaseError(`tag ${tag} 已存在`)
}

function checkNodeVersions(node22: string): void {
  const result = spawnSync(node22, ['--version'], { encoding: 'utf8' })
  const actual = result.error?.message ?? result.stdout.trim()
  if (actual !== NODE22_VERSION)
    throw new ReleaseError(
      `--node22 应为 Node ${NODE22_VERSION} 的可执行文件，实际：${actual}`,
    )
  const major = Number(process.versions.node.split('.')[0])
  if (major !== RELEASE_NODE_MAJOR)
    throw new ReleaseError(
      `发布脚本须以 Node ${RELEASE_NODE_MAJOR} 运行（TA-14），当前为 ${process.version}`,
    )
}

// TA-14：在同一份夹具产物上，分别以 Node 22.0.0 与运行本脚本的 Node 24 运行每个入口用例，
// 两次的退出码、stdout、stderr 都须与用例的期望逐字一致
export async function runTa14(node22: string): Promise<string[]> {
  const lines: string[] = []
  for (const fixture of TA14_FIXTURES) {
    const fixtureCase = await readCase(fixture)
    const entryCases = await readEntryCases(fixture)
    await withFixtureRun(fixture, fixtureCase, async fixtureRun => {
      if (fixtureRun.exitCode !== fixtureCase.exitCode)
        throw new ReleaseError(`TA-14：夹具 ${fixture} 构建失败：${fixtureRun.stderr}`)
      for (const entryCase of entryCases) {
        for (const node of [node22, process.execPath]) {
          const { result, expected } = await runEntryCase(fixtureRun, entryCase, {
            node,
          })
          if (isDeepStrictEqual(result, expected)) continue
          const label = `${fixture} ${entryCase.target}/${entryCase.name}`
          throw new ReleaseError(
            `TA-14：${label} 以 ${node} 运行的结果与期望不一致：${JSON.stringify(result)}`,
          )
        }
      }
    })
    lines.push(
      `TA-14 ${fixture}：${entryCases.length} 个入口用例在 Node ${NODE22_VERSION} 与 ` +
        `${process.version} 上的退出码、stdout、stderr 逐字一致`,
    )
  }
  return lines
}

// dist/ 的编译配置沿用 tsconfig.json 的编译选项，只改输出相关的项。配置写在临时目录中，
// 仓库中不另建配置文件，因此 include、typeRoots 等路径写成绝对路径
export async function compileDist(root: string): Promise<void> {
  const dist = join(root, 'dist')
  await rm(dist, { recursive: true, force: true })
  const temp = await mkdtemp(join(tmpdir(), 'uapa-release-tsc-'))
  try {
    const config = {
      extends: join(root, 'tsconfig.json'),
      compilerOptions: {
        noEmit: false,
        rewriteRelativeImportExtensions: true,
        declaration: true,
        typeRoots: [join(root, 'node_modules', '@types')],
        rootDir: join(root, 'src'),
        outDir: dist,
      },
      include: [join(root, 'src', '**', '*.ts')],
    }
    const file = join(temp, 'tsconfig.json')
    await writeFile(file, `${JSON.stringify(config, null, 2)}\n`)
    const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc')
    run(process.execPath, [tsc, '-p', file], root)
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
  await checkPackageEntries(root)
}

// package.json 的 bin 与 exports 指向的文件都须在编译结果中
async function checkPackageEntries(root: string): Promise<void> {
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  const exported = manifest.exports['.']
  const paths = [...Object.values(manifest.bin), exported.types, exported.default]
  for (const path of paths as string[]) {
    if (!existsSync(join(root, path)))
      throw new ReleaseError(`编译结果中没有 package.json 引用的 ${path}`)
  }
}

// 发布提交以 HEAD 的树为底加入 dist/（被 .gitignore 忽略，强制加入），父提交为 main
export function createReleaseCommit(root: string, tag: string): string {
  const temp = mkdtempSync(join(tmpdir(), 'uapa-release-index-'))
  const env = { ...process.env, GIT_INDEX_FILE: join(temp, 'index') }
  try {
    git(root, ['read-tree', 'HEAD'], env)
    git(root, ['add', '--force', '--', 'dist'], env)
    const tree = git(root, ['write-tree'], env)
    // 标题与正文各一个 -m，git 以空行分隔
    const message = ['-m', `chore: 发布 ${tag}`, '-m', RELEASE_COMMIT_BODY]
    const commit = git(root, ['commit-tree', tree, '-p', 'HEAD', ...message])
    git(root, ['tag', '--annotate', tag, '--message', tag, commit])
    return commit
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

// 安装冒烟（F-10-05、TA-10）：临时项目以 git 依赖指向本地仓库的 tag 安装（SMOKE_INSTALL），
// 再以安装后的 bin 对 full 夹具运行 uapa build，PATH 只含一个空目录（与夹具运行器一致），
// 结果与夹具的期望产物逐字比对
export async function installSmoke(root: string, tag: string): Promise<void> {
  const temp = await mkdtemp(join(tmpdir(), 'uapa-install-smoke-'))
  try {
    const project = join(temp, 'project')
    const path = join(temp, 'path')
    await cp(join(FIXTURES_DIR, SMOKE_FIXTURE, 'source'), project, { recursive: true })
    await mkdir(path)
    const config = join(project, 'uapa.config.ts')
    await writeFile(config, wrapWithDefineConfig(await readFile(config, 'utf8')))
    const dependency = `git+${pathToFileURL(root).href}#${tag}`
    // packageManager 取自本仓库，安装使用与本仓库相同的 pnpm，不随全局安装的 pnpm 变化
    const { packageManager } = JSON.parse(
      await readFile(join(root, 'package.json'), 'utf8'),
    )
    const manifest = {
      name: 'uapa-install-smoke',
      private: true,
      type: 'module',
      packageManager,
      devDependencies: { uapa: dependency },
    }
    await writeFile(
      join(project, 'package.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    )
    run('pnpm', SMOKE_INSTALL, project)
    const installed = join(project, 'node_modules', 'uapa')
    const bin = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8')).bin
    const built = spawnSync(process.execPath, [join(installed, bin.uapa), 'build'], {
      cwd: project,
      env: { PATH: path },
      encoding: 'utf8',
    })
    await compareWithFixture(project, built)
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
}

function wrapWithDefineConfig(text: string): string {
  let result = text
  for (const [from, to] of CONFIG_REWRITES) {
    if (result.split(from).length !== 2)
      throw new ReleaseError(`安装冒烟：夹具配置中应恰有一处 ${JSON.stringify(from)}`)
    result = result.replace(from, to)
  }
  return result
}

// full 夹具的生成文件都在默认布局的 dist/ 下；源项目中的其余文件不比对
async function compareWithFixture(
  project: string,
  built: SpawnSyncReturns<string>,
): Promise<void> {
  const fixture = join(FIXTURES_DIR, SMOKE_FIXTURE)
  const expected = {
    exitCode: (await readCase(SMOKE_FIXTURE)).exitCode,
    stdout: await readFile(join(fixture, 'expected', 'stdout.txt'), 'utf8'),
    stderr: await readFile(join(fixture, 'expected', 'stderr.txt'), 'utf8'),
    dist: await readTree(join(fixture, 'expected', 'tree', 'dist')),
  }
  const actual = {
    exitCode: built.status,
    stdout: built.stdout,
    stderr: built.stderr,
    dist: await readTree(join(project, 'dist')),
  }
  if (isDeepStrictEqual(actual, expected)) return
  const differing = Object.keys(expected).filter(
    key =>
      !isDeepStrictEqual(
        actual[key as keyof typeof actual],
        expected[key as keyof typeof expected],
      ),
  )
  throw new ReleaseError(
    `安装冒烟：构建结果与 ${SMOKE_FIXTURE} 夹具的期望不一致（${differing.join('、')}）；` +
      `stderr：${built.stderr}`,
  )
}

function run(command: string, args: readonly string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' })
  if (result.error !== undefined || result.status !== 0)
    throw new ReleaseError(
      `${command} ${args.join(' ')} 失败：${result.error?.message ?? `退出码 ${result.status}`}`,
    )
}

function git(root: string, args: readonly string[], env = process.env): string {
  const result = spawnSync('git', args, { cwd: root, env, encoding: 'utf8' })
  if (result.error !== undefined || result.status !== 0)
    throw new ReleaseError(
      `git ${args.join(' ')} 失败：${result.error?.message ?? result.stderr.trim()}`,
    )
  return result.stdout.trim()
}

if (import.meta.main) {
  const root = dirname(dirname(fileURLToPath(import.meta.url)))
  try {
    await release(root, process.argv.slice(2))
  } catch (error) {
    if (!(error instanceof ReleaseError)) throw error
    process.stderr.write(`release: ${error.message}\n`)
    process.exitCode = 1
  }
}
