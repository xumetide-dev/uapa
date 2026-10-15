// 发布脚本的前置检查（F-10-04）：缺少 --node22、工作区不干净、tag 已存在或 --node22 不是
// Node 22.0.0 时失败，不创建提交与 tag。仓库为 mkdtemp 中新建的 git 仓库；这些检查都在
// pnpm check 之前，测试不会走到检查、编译与安装
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { ReleaseError, release } from '../../scripts/release.ts'

// 不读用户与系统的 git 配置（钩子目录、默认分支、签名），提交身份写在命令行上
const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
}

function git(root: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd: root, env: GIT_ENV, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

async function withRepo(check: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'uapa-release-'))
  try {
    await writeFile(
      join(root, 'package.json'),
      '{ "name": "demo", "version": "0.1.0" }\n',
    )
    git(root, 'init', '--quiet', '--initial-branch=main')
    git(root, 'add', 'package.json')
    const identity = ['-c', 'user.name=uapa-test', '-c', 'user.email=test@example.com']
    git(root, ...identity, 'commit', '--quiet', '--message', 'init')
    git(root, ...identity, 'tag', '--annotate', 'v0.0.9', '--message', 'v0.0.9')
    await check(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

// 失败前后的提交数与引用（分支、tag）不变
async function assertFailsWithoutCommit(
  root: string,
  argv: readonly string[],
  message: RegExp,
): Promise<void> {
  const before = [git(root, 'rev-list', '--all', '--count'), git(root, 'for-each-ref')]
  await assert.rejects(release(root, argv), error => {
    assert.ok(error instanceof ReleaseError)
    assert.match(error.message, message)
    return true
  })
  const after = [git(root, 'rev-list', '--all', '--count'), git(root, 'for-each-ref')]
  assert.deepEqual(after, before)
}

test('缺少 --node22 时失败', async () => {
  await withRepo(root =>
    assertFailsWithoutCommit(root, [], /^缺少 --node22 <Node v22\.0\.0 的可执行文件>/),
  )
})

test('未知参数时失败', async () => {
  await withRepo(root =>
    assertFailsWithoutCommit(root, ['--node22', 'node', '--push'], /--push/),
  )
})

test('工作区不干净时失败', async () => {
  await withRepo(async root => {
    await writeFile(join(root, 'notes.txt'), 'draft\n')
    await assertFailsWithoutCommit(
      root,
      ['--node22', process.execPath],
      /^工作区不干净/,
    )
  })
})

test('tag 已存在时失败', async () => {
  await withRepo(async root => {
    git(root, 'tag', 'v0.1.0')
    await assertFailsWithoutCommit(
      root,
      ['--node22', process.execPath],
      /^tag v0\.1\.0 已存在$/,
    )
  })
})

test('--node22 不是 Node 22.0.0 时失败', async () => {
  const escaped = process.version.replaceAll('.', '\\.')
  await withRepo(root =>
    assertFailsWithoutCommit(
      root,
      ['--node22', process.execPath],
      new RegExp(`^--node22 应为 Node v22\\.0\\.0 的可执行文件，实际：${escaped}$`),
    ),
  )
})
