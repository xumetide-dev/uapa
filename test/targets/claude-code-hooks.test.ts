// Claude Code 的命令 hooks 配置与子进程入口的打包请求（F-05-03、F-05-04），宿主校验（F-05-09）
import assert from 'node:assert/strict'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import type { BundleRequest } from '../../src/bundle/types.ts'
import { claudeCodeSubprocess } from '../../src/capabilities/claude-code-subprocess.ts'
import type { UapaConfig } from '../../src/config/types.ts'
import type { GuardCheck } from '../../src/runtime/core/types.ts'
import { commandHooks } from '../../src/targets/claude-code/hooks.ts'
import { claudeCode } from '../../src/targets/claude-code/index.ts'
import { validatePlugin } from '../../src/targets/claude-code/verify.ts'
import type { HostResult } from '../../src/targets/types.ts'
import { baseConfig } from '../helpers/project.ts'

const GUARD = {
  modulePath: '/project/guard.ts',
  name: 'g',
  requires: [],
  checks: ['beforeTool', 'beforeStop'] as GuardCheck[],
}

async function generate(
  checks: readonly GuardCheck[],
  guard: typeof GUARD | null = GUARD,
): Promise<{ result: HostResult; requests: BundleRequest[] }> {
  const requests: BundleRequest[] = []
  const result = await claudeCode.generate({
    config: baseConfig as UapaConfig,
    plans: [
      {
        target: 'claude-code:subprocess',
        capabilities: claudeCodeSubprocess,
        skills: [],
        agents: [],
        mcpServers: [],
        rules: [],
        commands: [],
        checks,
        commandHooks: [],
      },
    ],
    guard,
    sharedWith: [],
    bundle: async request => {
      requests.push(request)
      return 'BUNDLED\n'
    },
  })
  return { result, requests }
}

function file(result: HostResult, path: string): string | undefined {
  assert.ok(result.ok)
  return result.files.find(f => f.path === path)?.content as string | undefined
}

test('hooks/hooks.json 按 TargetPlan.checks 生成条目，不写 matcher，超时取能力数据', async () => {
  const { result } = await generate(['beforeTool', 'beforePrompt', 'beforeStop'])
  const entry = (arg: string) => [
    {
      hooks: [
        {
          type: 'command',
          command: `node "\${CLAUDE_PLUGIN_ROOT}/hooks/uapa-claude-code.mjs" ${arg}`,
          timeout: 30,
        },
      ],
    },
  ]
  const expected = {
    hooks: {
      PreToolUse: entry('before-tool'),
      UserPromptSubmit: entry('before-prompt'),
      Stop: entry('before-stop'),
    },
  }
  assert.equal(
    file(result, 'hooks/hooks.json'),
    `${JSON.stringify(expected, null, 2)}\n`,
  )
  assert.equal(file(result, 'hooks/uapa-claude-code.mjs'), 'BUNDLED\n')
})

test('能力数据的 hookTimeoutSeconds 为 null 时条目不写 timeout', () => {
  assert.deepEqual(commandHooks(['beforeStop'], null), {
    Stop: [
      {
        hooks: [
          {
            type: 'command',
            command: `node "\${CLAUDE_PLUGIN_ROOT}/hooks/uapa-claude-code.mjs" before-stop`,
          },
        ],
      },
    ],
  })
})

test('子进程入口的打包请求：入口名、守卫、目标数据与外部导入', async () => {
  const { result, requests } = await generate(['beforeTool'])
  assert.ok(result.ok)
  assert.deepEqual(requests, [
    {
      entry: 'claude-code-subprocess',
      guardModule: '/project/guard.ts',
      data: {
        pluginName: 'demo',
        toolNames: claudeCodeSubprocess.toolNames,
        capabilities: claudeCodeSubprocess.capabilities,
        moduleSessionEnv: null,
      },
      external: 'node',
    },
  ])
  const hooks = JSON.parse(file(result, 'hooks/hooks.json') ?? '{}')
  assert.deepEqual(Object.keys(hooks.hooks), ['PreToolUse'])
})

test('checks 为空或未配置守卫时只生成 manifest，不打包', async () => {
  for (const [checks, guard] of [
    [[], GUARD],
    [[], null],
  ] as const) {
    const { result, requests } = await generate(checks, guard)
    assert.ok(result.ok)
    assert.deepEqual(
      result.files.map(f => f.path),
      ['.claude-plugin/plugin.json'],
    )
    assert.equal(requests.length, 0)
  }
})

test('宿主校验：PATH 中没有 claude 为 skipped，退出码 0 为 passed，非零为 failed', async () => {
  const bin = await mkdtemp(join(tmpdir(), 'uapa-bin-'))
  const original = process.env.PATH
  try {
    process.env.PATH = bin
    const dir = join(bin, 'plugin')
    assert.deepEqual(validatePlugin(dir), {
      status: 'skipped',
      reason: 'PATH 中没有 claude',
    })
    const claude = join(bin, 'claude')
    await writeFile(claude, '#!/bin/sh\nexit 0\n')
    await chmod(claude, 0o755)
    assert.deepEqual(validatePlugin(dir), { status: 'passed' })
    // 输出中的插件目录换为 <插件目录>
    await writeFile(
      claude,
      `#!/bin/sh\necho "Validating $4/.claude-plugin/plugin.json"\necho "  x bad name" >&2\nexit 1\n`,
    )
    assert.deepEqual(validatePlugin(dir), {
      status: 'failed',
      errors: [
        '宿主校验失败：claude plugin validate --strict 以退出码 1 结束',
        'Validating <插件目录>/.claude-plugin/plugin.json',
        'x bad name',
      ],
    })
  } finally {
    process.env.PATH = original
    await rm(bin, { recursive: true, force: true })
  }
})
