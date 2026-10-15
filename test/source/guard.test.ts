// 构建时读取守卫声明（F-02-03、F-02-05）
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
    options: [],
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

test('afterTool 与执行后能力参与读取（F-02-04）', async () => {
  const { result } = await read(`export default {
  name: 'g',
  requires: ['replaceOutput', 'withholdOutput'],
  afterTool: () => ({ kind: 'keep' }),
}
`)
  assert.ok(result.ok)
  assert.deepEqual(result.value?.requires, ['replaceOutput', 'withholdOutput'])
  assert.deepEqual(result.value?.checks, ['afterTool'])
  const bad = await read("export default { name: 'g', requires: [], afterTool: 1 }\n")
  assert.ok(!bad.result.ok)
  assert.equal(bad.result.issues[0]?.field, 'afterTool')
  assert.match(bad.result.issues[0]?.message ?? '', /函数/)
})

test('守卫文件不存在时返回 InputIssue', async () => {
  const { result } = await read(null)
  assert.ok(!result.ok)
  assert.deepEqual(result.issues, [
    { file: 'guard.ts', field: null, message: '文件不存在' },
  ])
})

test('守卫选项按名称排序得出（F-02-05）', async () => {
  const { result } = await read(`import type { GuardPlugin } from 'uapa'
export default {
  name: 'g',
  requires: [],
  options: {
    strict: { type: 'boolean', title: '严格', description: '是否严格', default: false },
    Limit_2: { type: 'number', title: '上限', description: '长度上限', default: 0.5 },
    label: { type: 'string', title: '标签', description: '原因前缀', default: '' },
  },
} satisfies GuardPlugin
`)
  assert.ok(result.ok)
  assert.deepEqual(result.value?.options, [
    {
      type: 'number',
      title: '上限',
      description: '长度上限',
      default: 0.5,
      name: 'Limit_2',
    },
    {
      type: 'string',
      title: '标签',
      description: '原因前缀',
      default: '',
      name: 'label',
    },
    {
      type: 'boolean',
      title: '严格',
      description: '是否严格',
      default: false,
      name: 'strict',
    },
  ])
})

test('守卫选项不合规时返回 InputIssue（F-02-05）', async () => {
  const option = (fields: string) =>
    `{ type: 'number', title: 't', description: 'd', default: 1, ${fields} }`
  const cases: [string, string, RegExp][] = [
    ['[]', 'options', /映射/],
    [`{ '1st': ${option('')} }`, 'options.1st', /以字母开头/],
    [`{ 'a-b': ${option('')} }`, 'options.a-b', /以字母开头/],
    [
      `{ limit: ${option('')}, LIMIT: ${option('')} }`,
      'options.LIMIT',
      /全大写后与选项 limit 相同/,
    ],
    ['{ limit: 1 }', 'options.limit', /对象/],
    [
      `{ limit: ${option('sensitive: true')} }`,
      'options.limit.sensitive',
      /不支持的键/,
    ],
    [
      `{ limit: ${option("type: 'directory'")} }`,
      'options.limit.type',
      /string、number 或 boolean/,
    ],
    [`{ limit: ${option("title: ''")} }`, 'options.limit.title', /非空单行/],
    [
      `{ limit: ${option("description: 'a\\nb'")} }`,
      'options.limit.description',
      /非空单行/,
    ],
    [`{ limit: ${option("default: '1'")} }`, 'options.limit.default', /number/],
    [`{ limit: ${option('default: Infinity')} }`, 'options.limit.default', /number/],
    [
      `{ flag: { type: 'boolean', title: 't', description: 'd' } }`,
      'options.flag.default',
      /boolean/,
    ],
  ]
  for (const [options, field, message] of cases) {
    const { result } = await read(
      `export default { name: 'g', requires: [], options: ${options} }\n`,
    )
    assert.ok(!result.ok, options)
    assert.equal(result.issues[0]?.field, field, options)
    assert.match(result.issues[0]?.message ?? '', message, options)
  }
})
