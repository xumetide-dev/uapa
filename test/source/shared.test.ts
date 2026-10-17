// 读取共用文件 files/（F-01-12）
import assert from 'node:assert/strict'
import { symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import type { UapaConfig } from '../../src/config/types.ts'
import { readSource } from '../../src/source/index.ts'
import { baseConfig, tempProject } from '../helpers/project.ts'

async function read(
  files: Record<string, string>,
  prepare: (root: string) => Promise<void> = async () => {},
) {
  const project = await tempProject(files)
  try {
    await prepare(project.root)
    return await readSource(baseConfig as UapaConfig, project.root)
  } finally {
    await project.cleanup()
  }
}

test('files/ 不存在时为空列表', async () => {
  const result = await read({})
  assert.ok(result.ok)
  assert.deepEqual(result.value.files, [])
})

test('递归列出 files/ 下的文件，相对 files/、POSIX 分隔、按字典序', async () => {
  const result = await read({
    'files/scripts/server.mjs': '',
    'files/README.md': '',
    'files/scripts/lib/util.mjs': '',
    'files/.lsp.json': '{}\n',
  })
  assert.ok(result.ok)
  assert.deepEqual(result.value.files, [
    '.lsp.json',
    'README.md',
    'scripts/lib/util.mjs',
    'scripts/server.mjs',
  ])
})

test('files 为文件或含符号链接时为输入错误', async () => {
  const notDir = await read({ files: '' })
  assert.ok(!notDir.ok)
  assert.deepEqual(notDir.issues, [
    { file: 'files', field: null, message: 'files 应为目录' },
  ])
  const linked = await read({ 'files/a.txt': '' }, root =>
    symlink(join(root, 'files', 'a.txt'), join(root, 'files', 'link.txt')),
  )
  assert.ok(!linked.ok)
  assert.deepEqual(linked.issues, [
    { file: 'files', field: null, message: '不支持的文件类型（如符号链接）：link.txt' },
  ])
})
