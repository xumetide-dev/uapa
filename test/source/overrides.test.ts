// 读取覆盖目录 overrides/<宿主>/（F-01-06）
import assert from 'node:assert/strict'
import { symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import type { UapaConfig } from '../../src/config/types.ts'
import { readSource } from '../../src/source/index.ts'
import { baseConfig, tempProject } from '../helpers/project.ts'

const config = {
  ...baseConfig,
  targets: ['claude-code:subprocess', 'codex:subprocess'],
} as UapaConfig

async function read(
  files: Record<string, string>,
  prepare: (root: string) => Promise<void> = async () => {},
) {
  const project = await tempProject(files)
  try {
    await prepare(project.root)
    return await readSource(config, project.root)
  } finally {
    await project.cleanup()
  }
}

test('overrides/ 不存在时为空；按宿主递归列出文件，相对宿主目录、按字典序', async () => {
  const none = await read({})
  assert.ok(none.ok)
  assert.deepEqual(none.value.overrides, {})
  const result = await read({
    'overrides/README.md': '说明文件不是目录，忽略\n',
    'overrides/codex/README.md': '',
    'overrides/codex/.codex-plugin/plugin.json': '{}\n',
    'overrides/claude-code/hooks/hooks.json': '{}\n',
  })
  assert.ok(result.ok)
  assert.deepEqual(result.value.overrides, {
    'claude-code': ['hooks/hooks.json'],
    codex: ['.codex-plugin/plugin.json', 'README.md'],
  })
})

test('目录名不是已配置的宿主时为输入错误', async () => {
  const result = await read({
    'overrides/agy/plugin.json': '{}\n',
    'overrides/kimi/x': '',
  })
  assert.ok(!result.ok)
  const message = '不是已配置的宿主（已配置：claude-code、codex）'
  assert.deepEqual(result.issues, [
    { file: 'overrides/agy', field: null, message },
    { file: 'overrides/kimi', field: null, message },
  ])
})

test('overrides 不是目录、含符号链接时为输入错误', async () => {
  const file = await read({ overrides: '' })
  assert.ok(!file.ok)
  assert.deepEqual(file.issues, [
    { file: 'overrides', field: null, message: 'overrides 应为目录' },
  ])
  const linked = await read({ 'overrides/codex/a.txt': 'a\n' }, root =>
    symlink('a.txt', join(root, 'overrides/codex/b.txt')),
  )
  assert.ok(!linked.ok)
  assert.deepEqual(linked.issues, [
    {
      file: 'overrides/codex',
      field: null,
      message: '不支持的文件类型（如符号链接）：b.txt',
    },
  ])
})
