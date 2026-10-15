// 命令行（F-09-01～F-09-04）：退出码以构造的 BuildOutcome 与抛出的异常
// 覆盖模块接口 §8 的每一行
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BuildOutcome, FileChange } from '../../src/build/index.ts'
import { HELP, parseCommand } from '../../src/cli/args.ts'
import { type CliDeps, exitCodeOf, run } from '../../src/cli/run.ts'
import type { TargetReport } from '../../src/report/types.ts'

const entry: TargetReport = {
  target: 'claude-code:subprocess',
  status: 'ok',
  errors: [],
  host: {
    name: 'claude-code',
    version: '2.1.296',
    checked: '2026-10-13',
    source: 's.md',
  },
  units: [],
  skipped: [],
  degraded: [],
  overridden: [],
  hostValidation: 'none',
  residualRisks: [],
}

const done = (
  targets: TargetReport[],
  changes: FileChange[] | null = null,
): BuildOutcome => ({
  kind: 'done',
  report: { targets },
  reportPath: changes === null ? 'dist/uapa-report.json' : null,
  changes,
})

async function invoke(argv: string[], deps: Partial<CliDeps>) {
  let stdout = ''
  let stderr = ''
  const io = {
    stdout: (t: string) => {
      stdout += t
    },
    stderr: (t: string) => {
      stderr += t
    },
  }
  const full: CliDeps = {
    loadConfig: async () => ({
      ok: true,
      value: {
        name: 'demo',
        version: '0.1.0',
        description: 'd',
        targets: ['claude-code:subprocess'],
      },
    }),
    build: async () => done([entry]),
    ...deps,
  }
  const code = await run(argv, '/work', io, full)
  return { code, stdout, stderr }
}

test('退出码：0 全部成功；1 有目标失败或有差异；2 输入错误', () => {
  assert.equal(exitCodeOf(done([entry])), 0)
  assert.equal(exitCodeOf(done([entry, { ...entry, status: 'failed' }])), 1)
  assert.equal(exitCodeOf(done([entry], [{ change: 'added', path: 'a' }])), 1)
  assert.equal(exitCodeOf(done([entry], [])), 0)
  assert.equal(exitCodeOf({ kind: 'input-error', issues: [] }), 2)
})

test('配置加载失败以 2 结束，按 uapa: <file>[: <field>]: <message> 输出', async () => {
  const result = await invoke(['build'], {
    loadConfig: async () => ({
      ok: false,
      issues: [
        { file: 'uapa.config.ts', field: 'targets[1]', message: '未知目标名 "x"' },
        { file: null, field: null, message: '无文件的错误' },
      ],
    }),
  })
  assert.equal(result.code, 2)
  assert.equal(result.stdout, '')
  assert.equal(
    result.stderr,
    'uapa: uapa.config.ts: targets[1]: 未知目标名 "x"\nuapa: 无文件的错误\n',
  )
})

test('目标失败时 stderr 逐条写原因、stdout 写摘要，以 1 结束', async () => {
  const failed = { ...entry, status: 'failed' as const, errors: ['名称不合规'] }
  const result = await invoke(['build'], { build: async () => done([failed]) })
  assert.equal(result.code, 1)
  assert.equal(result.stderr, 'uapa: claude-code:subprocess: 名称不合规\n')
  assert.match(result.stdout, /^失败 claude-code:subprocess/)
})

test('input-error 与 build 抛出的异常都以 2 结束，异常输出堆栈', async () => {
  const issue = { file: 'skills/a', field: null, message: '缺少 SKILL.md' }
  const input = await invoke(['build'], {
    build: async () => ({ kind: 'input-error', issues: [issue] }),
  })
  assert.equal(input.code, 2)
  assert.equal(input.stderr, 'uapa: skills/a: 缺少 SKILL.md\n')
  const thrown = await invoke(['build'], {
    build: async () => {
      throw new Error('boom')
    },
  })
  assert.equal(thrown.code, 2)
  assert.match(thrown.stderr, /^uapa: 未预期的错误：Error: boom\n {4}at /)
})

test('--check：以 check 调用 build，stdout 只写差异行，有差异或目标失败时以 1 结束', async () => {
  const changes: FileChange[] = [
    { change: 'removed', path: 'dist/claude-code/extra.txt' },
    { change: 'modified', path: 'dist/codex/.codex-plugin/plugin.json' },
  ]
  let options: { readonly check: boolean } | null = null
  const diff = await invoke(['build', '--check'], {
    build: async (_config, _root, given) => {
      options = given
      return done([entry], changes)
    },
  })
  assert.deepEqual(options, { check: true })
  assert.equal(diff.code, 1)
  assert.equal(
    diff.stdout,
    'removed dist/claude-code/extra.txt\nmodified dist/codex/.codex-plugin/plugin.json\n',
  )
  assert.equal(diff.stderr, '')
  const same = await invoke(['build', '--check'], {
    build: async () => done([entry], []),
  })
  assert.deepEqual([same.code, same.stdout, same.stderr], [0, '', ''])
  const failed = { ...entry, status: 'failed' as const, errors: ['名称不合规'] }
  const failing = await invoke(['build', '--check'], {
    build: async () => done([failed], []),
  })
  assert.deepEqual(
    [failing.code, failing.stdout, failing.stderr],
    [1, '', 'uapa: claude-code:subprocess: 名称不合规\n'],
  )
})

test('--config 指定配置文件，相对路径以当前目录为基准', async () => {
  let loaded = ''
  await invoke(['build', '--config', 'sub/u.config.ts'], {
    loadConfig: async path => {
      loaded = path
      return { ok: false, issues: [] }
    },
  })
  assert.equal(loaded, '/work/sub/u.config.ts')
})

test('--help、--version 输出到 stdout 并以 0 结束；用法错误以 2 结束', async () => {
  const help = await invoke(['--help'], {})
  assert.deepEqual([help.code, help.stdout, help.stderr], [0, HELP, ''])
  const version = await invoke(['--version'], {})
  assert.deepEqual([version.code, version.stdout], [0, '0.1.0\n'])
  const usage = await invoke(['build', '--unknown'], {})
  assert.equal(usage.code, 2)
  assert.equal(usage.stderr, 'uapa: 未知选项 --unknown（运行 uapa --help 查看用法）\n')
})

test('参数解析', () => {
  assert.deepEqual(parseCommand(['build']), {
    kind: 'build',
    config: null,
    check: false,
  })
  assert.deepEqual(parseCommand(['build', '--config=a.ts']), {
    kind: 'build',
    config: 'a.ts',
    check: false,
  })
  assert.deepEqual(parseCommand(['build', '--check', '--config', 'a.ts']), {
    kind: 'build',
    config: 'a.ts',
    check: true,
  })
  const errors: [string[], RegExp][] = [
    [[], /缺少命令/],
    [['make'], /未知命令 make/],
    [['build', '--config'], /--config 缺少路径/],
    [['build', 'extra'], /多余的参数 extra/],
  ]
  for (const [argv, message] of errors) {
    const command = parseCommand(argv)
    assert.equal(command.kind, 'usage-error')
    assert.match(command.kind === 'usage-error' ? command.message : '', message)
  }
})
