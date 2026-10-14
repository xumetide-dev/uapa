// 构建时读取守卫声明（F-02-03）
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import type { UapaConfig } from '../../src/config/types.ts'
import { readGuard } from '../../src/source/guard.ts'
import { baseConfig, tempProject } from '../helpers/project.ts'

async function read(guardSource: string | null) {
  const files: Record<string, string> =
    guardSource === null ? {} : { 'guard.ts': guardSource }
  const project = await tempProject(files)
  try {
    const config: UapaConfig = { ...baseConfig, guard: 'guard.ts' }
    return { result: await readGuard(config, project.root), root: project.root }
  } finally {
    await project.cleanup()
  }
}

test('未配置守卫时为 null', async () => {
  const project = await tempProject({})
  const result = await readGuard(baseConfig as UapaConfig, project.root)
  await project.cleanup()
  assert.deepEqual(result, { ok: true, value: null })
})

test('得出名称、requires 与已实现的检查', async () => {
  const { result, root } = await read(`import type { GuardPlugin } from 'uapa'
export default {
  name: 'g',
  requires: ['stopGate'],
  beforeStop: () => ({ kind: 'stop' }),
  beforeTool: () => ({ kind: 'allow' }),
} satisfies GuardPlugin
`)
  assert.ok(result.ok)
  assert.deepEqual(result.value, {
    modulePath: join(root, 'guard.ts'),
    name: 'g',
    requires: ['stopGate'],
    checks: ['beforeTool', 'beforeStop'],
  })
})

test('默认导出不符合 GuardPlugin 时返回 InputIssue', async () => {
  const cases: [string, string | null, RegExp][] = [
    ['export default 1\n', null, /GuardPlugin/],
    ["export default { name: '', requires: [] }\n", 'name', /非空/],
    ["export default { name: 'g' }\n", 'requires', /能力名列表/],
    ["export default { name: 'g', requires: ['fly'] }\n", 'requires[0]', /未知能力/],
    [
      "export default { name: 'g', requires: [], beforeTool: 1 }\n",
      'beforeTool',
      /函数/,
    ],
  ]
  for (const [source, field, message] of cases) {
    const { result } = await read(source)
    assert.ok(!result.ok)
    assert.equal(result.issues[0]?.file, 'guard.ts')
    assert.equal(result.issues[0]?.field, field)
    assert.match(result.issues[0]?.message ?? '', message)
  }
})

test('含 afterTool 或 requires 含执行后能力时返回 InputIssue（SD-20）', async () => {
  const after = await read(
    "export default { name: 'g', requires: [], afterTool() {} }\n",
  )
  assert.ok(!after.result.ok)
  assert.equal(after.result.issues[0]?.field, 'afterTool')
  assert.match(after.result.issues[0]?.message ?? '', /不支持执行后检查/)
  for (const capability of ['replaceOutput', 'withholdOutput']) {
    const { result } = await read(
      `export default { name: 'g', requires: ['${capability}'] }\n`,
    )
    assert.ok(!result.ok)
    assert.equal(result.issues[0]?.field, 'requires[0]')
    assert.match(result.issues[0]?.message ?? '', /不支持执行后检查/)
  }
})

test('守卫文件不存在时返回 InputIssue', async () => {
  const { result } = await read(null)
  assert.ok(!result.ok)
  assert.deepEqual(result.issues, [
    { file: 'guard.ts', field: null, message: '文件不存在' },
  ])
})
