// 更新夹具的期望输出：node test/fixtures/update.ts [<夹具>…]（不给夹具名时更新全部）。
// 写入 stdout.txt、stderr.txt 与 expected/tree/ 中由构建生成的文件。
// 插件目录中的 manifest 与 hooks 配置（构建报告以外、且不在 source/ 中的 .json 文件）
// 按验收标准手写，本命令只核对，缺失或不一致时列出并以退出码 1 结束。
// 写入后须人工核对 diff（规则见 README.md）。
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  FIXTURES_DIR,
  type FixtureRun,
  fixtureNames,
  readCase,
  readTree,
  withFixtureRun,
} from './run.ts'

function handWritten(path: string, source: ReadonlyMap<string, Buffer>): boolean {
  if (!path.endsWith('.json') || source.has(path)) return false
  return !path.endsWith('/uapa-report.json') && path !== 'uapa-report.json'
}

async function update(name: string): Promise<string[]> {
  const fixtureCase = await readCase(name)
  return withFixtureRun(name, fixtureCase, result => write(name, fixtureCase, result))
}

async function write(
  name: string,
  fixtureCase: { readonly exitCode: number },
  result: FixtureRun,
): Promise<string[]> {
  const problems: string[] = []
  if (result.exitCode !== fixtureCase.exitCode) {
    problems.push(
      `${name}: 退出码为 ${result.exitCode}，case.json 期望 ${fixtureCase.exitCode}`,
    )
  }
  const expectedDir = join(FIXTURES_DIR, name, 'expected')
  const treeDir = join(expectedDir, 'tree')
  await mkdir(treeDir, { recursive: true })
  await writeFile(join(expectedDir, 'stdout.txt'), result.stdout)
  await writeFile(join(expectedDir, 'stderr.txt'), result.stderr)
  const source = await readTree(join(FIXTURES_DIR, name, 'source'))
  const expected = await readTree(treeDir)
  for (const [path, content] of result.tree) {
    const target = join(treeDir, ...path.split('/'))
    if (handWritten(path, source)) {
      if (!expected.get(path)?.equals(content))
        problems.push(`${name}: 需手写或核对 ${path}`)
      continue
    }
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content)
  }
  for (const path of expected.keys()) {
    if (!result.tree.has(path)) await rm(join(treeDir, ...path.split('/')))
  }
  return problems
}

const names = process.argv.slice(2)
for (const name of names) {
  if (!existsSync(join(FIXTURES_DIR, name, 'case.json')))
    throw new Error(`没有夹具 ${name}`)
}
const problems: string[] = []
for (const name of names.length > 0 ? names : fixtureNames()) {
  problems.push(...(await update(name)))
}
for (const problem of problems) process.stderr.write(`${problem}\n`)
process.exitCode = problems.length > 0 ? 1 : 0
