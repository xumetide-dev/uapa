// 加载 uapa.config.ts（F-01-02）
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { loadConfig } from '../../src/config/load.ts'
import { tempProject } from '../helpers/project.ts'

const CONFIG = `export default ${JSON.stringify({
  name: 'demo',
  version: '0.1.0',
  description: 'd',
  targets: ['claude-code:subprocess'],
})}\n`

async function load(files: Record<string, string>) {
  const project = await tempProject(files)
  try {
    return await loadConfig(join(project.root, 'uapa.config.ts'))
  } finally {
    await project.cleanup()
  }
}

test('以类型剥离导入配置并返回校验后的值', async () => {
  const result = await load({
    'uapa.config.ts': `import type { UapaConfig } from 'uapa'\n${CONFIG.replace(
      '\n',
      ' satisfies UapaConfig\n',
    )}`,
  })
  assert.ok(result.ok)
  assert.equal(result.value.name, 'demo')
})

test('不可擦除语法返回 InputIssue，写明出错的文件', async () => {
  const own = await load({ 'uapa.config.ts': `enum E { A }\n${CONFIG}` })
  assert.ok(!own.ok)
  assert.equal(own.issues[0]?.file, 'uapa.config.ts')
  assert.match(own.issues[0]?.message ?? '', /类型剥离不支持的语法/)
  const nested = await load({
    'uapa.config.ts': `import { v } from './helper.ts'\nvoid v\n${CONFIG}`,
    'helper.ts': 'enum E { A }\nexport const v = E.A\n',
  })
  assert.ok(!nested.ok)
  assert.equal(nested.issues[0]?.file, 'helper.ts')
})

test('相对导入缺少 .ts 扩展名时返回 InputIssue', async () => {
  const result = await load({
    'uapa.config.ts': `import { v } from './lib/helper'\nvoid v\n${CONFIG}`,
    'lib/helper.ts': 'export const v = 1\n',
  })
  assert.ok(!result.ok)
  assert.deepEqual(result.issues, [
    {
      file: 'uapa.config.ts',
      field: null,
      message: '相对导入缺少 .ts 扩展名：lib/helper',
    },
  ])
})

test('默认导出缺失或不是对象、文件不存在时返回 InputIssue', async () => {
  for (const source of ['export const x = 1\n', 'export default 42\n']) {
    const result = await load({ 'uapa.config.ts': source })
    assert.ok(!result.ok)
    assert.deepEqual(result.issues, [
      { file: 'uapa.config.ts', field: null, message: '默认导出缺失或不是对象' },
    ])
  }
  const missing = await load({})
  assert.ok(!missing.ok)
  assert.equal(missing.issues[0]?.message, '文件不存在')
})
