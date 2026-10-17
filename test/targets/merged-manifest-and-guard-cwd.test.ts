// M5-08 专项测试：agy 替代 manifest 位置与三宿主合并布局（F-11-15，SD-47），以及
// GuardContext.cwd 在四个目标入口上的提取与退化（F-02-06、F-04-10、F-05-27、F-06-17、F-11-15，SD-50）。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { bundle } from '../../src/bundle/index.ts'
import { agySubprocess } from '../../src/capabilities/agy-subprocess.ts'
import { claudeCodeInProcess } from '../../src/capabilities/claude-code-in-process.ts'
import { claudeCodeSubprocess } from '../../src/capabilities/claude-code-subprocess.ts'
import { codexSubprocess } from '../../src/capabilities/codex-subprocess.ts'
import type { TargetCapabilities } from '../../src/capabilities/types.ts'
import { agy } from '../../src/targets/agy/index.ts'
import type { HostInput, TargetPlan } from '../../src/targets/types.ts'

function agyPlan(): TargetPlan {
  return {
    target: 'agy:subprocess',
    capabilities: agySubprocess,
    skills: [],
    agents: [],
    mcpServers: [],
    rules: [],
    commands: [],
    checks: [],
    commandHooks: [],
  }
}

function makeInput(
  sharedWith: HostInput['sharedWith'],
  manifest?: 'plugin.json' | '.antigravity-plugin/plugin.json',
): HostInput {
  return {
    config: {
      name: 'demo',
      version: '1.0.0',
      description: 'demo',
      targets: ['agy:subprocess'],
      ...(manifest === undefined ? {} : { hosts: { agy: { manifest } } }),
    },
    plans: [agyPlan()],
    guard: null,
    sharedWith,
    bundle: async () => 'export {}\n',
  }
}

test('agy manifestPath：独立目录默认根 plugin.json，合并目录默认 .antigravity-plugin/plugin.json（F-11-15）', async () => {
  const standalone = await agy.generate(makeInput([]))
  assert.equal(standalone.ok, true)
  if (standalone.ok) {
    assert.deepEqual(
      standalone.files.map(f => f.path),
      ['plugin.json'],
    )
    assert.ok(standalone.files[0]?.conflictHint !== undefined)
  }
  const subdir = await agy.generate(makeInput([], '.antigravity-plugin/plugin.json'))
  assert.equal(subdir.ok, true)
  if (subdir.ok) {
    assert.deepEqual(
      subdir.files.map(f => f.path),
      ['.antigravity-plugin/plugin.json'],
    )
    assert.equal(subdir.files[0]?.conflictHint, undefined)
  }
  const merged = await agy.generate(makeInput(['claude-code', 'codex']))
  assert.equal(merged.ok, true)
  if (merged.ok) {
    assert.deepEqual(
      merged.files.map(f => f.path),
      ['.antigravity-plugin/plugin.json'],
    )
    assert.deepEqual(merged.residualRisks, [])
  }
})

async function buildSubprocessEntry(
  dir: string,
  entry: 'claude-code-subprocess' | 'codex-subprocess' | 'agy-subprocess',
  guardPath: string,
  caps: TargetCapabilities,
): Promise<string> {
  const code = await bundle({
    entry,
    guardModule: guardPath,
    data: {
      pluginName: 'demo',
      toolNames: caps.toolNames,
      capabilities: caps.capabilities,
      moduleSessionEnv: null,
      options: [],
    },
    external: 'node',
  })
  const path = join(dir, `${entry}.mjs`)
  await writeFile(path, code)
  return path
}

function runEntry(entryPath: string, arg: string, stdin: unknown) {
  const res = spawnSync(process.execPath, [entryPath, arg], {
    input: JSON.stringify(stdin),
    encoding: 'utf8',
  })
  return {
    status: res.status,
    stdout: res.stdout,
    stderr: res.stderr,
    combined: `${res.stdout}\n${res.stderr}`,
  }
}

const GUARD_SOURCE = [
  'export default {',
  '  beforePrompt(_event: unknown, ctx: { cwd: string | null }) {',
  "    return { kind: 'block', reason: `cwd=${String(ctx.cwd)}` }",
  '  },',
  '  beforeTool(_call: unknown, ctx: { cwd: string | null }) {',
  "    return { kind: 'deny', reason: `cwd=${String(ctx.cwd)}` }",
  '  },',
  '}',
].join('\n')

test('GuardContext.cwd：Claude Code 与 Codex 子进程提取 cwd，缺失或空串退化为 null（F-04-10）', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'uapa-guard-cwd-'))
  try {
    const guardPath = join(dir, 'guard.ts')
    await writeFile(guardPath, GUARD_SOURCE)
    const claudeEntry = await buildSubprocessEntry(
      dir,
      'claude-code-subprocess',
      guardPath,
      claudeCodeSubprocess,
    )
    const out1 = runEntry(claudeEntry, 'before-prompt', {
      session_id: 's1',
      prompt: 'hi',
      cwd: '/workspace/claude',
    })
    assert.equal(out1.status, 2)
    assert.match(out1.stderr, /cwd=\/workspace\/claude/)
    const out2 = runEntry(claudeEntry, 'before-prompt', {
      session_id: 's1',
      prompt: 'hi',
      cwd: '',
    })
    assert.equal(out2.status, 2)
    assert.match(out2.stderr, /cwd=null/)
    const codexEntry = await buildSubprocessEntry(
      dir,
      'codex-subprocess',
      guardPath,
      codexSubprocess,
    )
    const out3 = runEntry(codexEntry, 'before-prompt', {
      session_id: 's1',
      prompt: 'hi',
      cwd: '/workspace/codex',
    })
    assert.equal(out3.status, 2)
    assert.match(out3.stderr, /cwd=\/workspace\/codex/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('GuardContext.cwd：agy 提取 workspacePaths[0]，in-process 固定为 null（F-04-10、F-05-27、F-11-15）', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'uapa-guard-cwd-agy-'))
  try {
    const guardPath = join(dir, 'guard.ts')
    await writeFile(guardPath, GUARD_SOURCE)
    const agyEntry = await buildSubprocessEntry(
      dir,
      'agy-subprocess',
      guardPath,
      agySubprocess,
    )
    const out1 = runEntry(agyEntry, 'before-tool', {
      conversationId: 's1',
      toolCall: { name: 'run_command', args: { CommandLine: 'echo ok' } },
      workspacePaths: ['/workspace/agy', '/workspace/second'],
    })
    assert.equal(out1.status, 0)
    assert.match(out1.stdout, /cwd=\/workspace\/agy/)
    const out2 = runEntry(agyEntry, 'before-tool', {
      conversationId: 's1',
      toolCall: { name: 'run_command', args: { CommandLine: 'echo ok' } },
      workspacePaths: [],
    })
    assert.equal(out2.status, 0)
    assert.match(out2.stdout, /cwd=null/)
    const inProcessJs = await bundle({
      entry: 'claude-code-in-process',
      guardModule: guardPath,
      data: {
        pluginName: 'demo',
        toolNames: claudeCodeInProcess.toolNames,
        capabilities: claudeCodeInProcess.capabilities,
        moduleSessionEnv: null,
        options: [],
      },
      external: 'claude-code',
      checks: ['beforePrompt'],
    })
    assert.match(
      inProcessJs,
      /guardContext\(optionsFromValues\(.+?\.options, options\), null\)/,
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
