// 工具名与入参换算（F-04-01）、改写的反向换算与降级（F-04-02）
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  canonicalToolName,
  resolveToolDecision,
  toToolCall,
} from '../../src/runtime/core/tools.ts'
import type { ToolNameMap } from '../../src/runtime/core/types.ts'

const TOOLS: ToolNameMap = { Bash: 'shell', Read: 'read_file' }

test('映射表中的工具换算为规范名，其余以 host:<原名> 传入', () => {
  assert.equal(canonicalToolName('Bash', TOOLS), 'shell')
  assert.equal(canonicalToolName('NotebookEdit', TOOLS), 'host:NotebookEdit')
  // 只认映射表自身的键，不取原型链上的属性
  assert.equal(canonicalToolName('constructor', TOOLS), 'host:constructor')
})

test('shell 的入参换算为 { command }，命令缺失时按输入无法解析处理', () => {
  const input = { command: 'ls', description: 'list' }
  assert.deepEqual(toToolCall('s', { name: 'Bash', input, command: 'ls' }, TOOLS), {
    ok: true,
    call: { sessionId: 's', tool: 'shell', input: { command: 'ls' } },
  })
  assert.deepEqual(toToolCall('s', { name: 'Bash', input: {} }, TOOLS), {
    ok: false,
    field: 'tool.command',
  })
  const read = toToolCall('s', { name: 'Read', input: { file_path: 'a' } }, TOOLS)
  assert.deepEqual(read, {
    ok: true,
    call: { sessionId: 's', tool: 'read_file', input: { file_path: 'a' } },
  })
})

test('rewrite 只对 shell 且目标能改写时生效，其余按 fallbackReason 拒绝', () => {
  const rewrite = {
    kind: 'rewrite',
    input: { command: 'echo safe' },
    fallbackReason: '请改用 echo safe',
  } as const
  assert.deepEqual(resolveToolDecision(rewrite, 'shell', true), {
    kind: 'rewriteShell',
    command: 'echo safe',
    fallbackReason: '请改用 echo safe',
  })
  const denied = { kind: 'deny', reason: '请改用 echo safe' }
  assert.deepEqual(resolveToolDecision(rewrite, 'shell', false), denied)
  assert.deepEqual(resolveToolDecision(rewrite, 'read_file', true), denied)
  assert.deepEqual(resolveToolDecision({ kind: 'allow' }, 'shell', true), {
    kind: 'allow',
  })
  const deny = { kind: 'deny', reason: '不允许' } as const
  assert.deepEqual(resolveToolDecision(deny, 'shell', true), deny)
})
