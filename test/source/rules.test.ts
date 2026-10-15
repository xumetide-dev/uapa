// 读取 rules（F-01-10，SD-32）：rules/ 下一层的 .md 文件，frontmatter 只允许四个键，正文原样保留
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { UapaConfig } from '../../src/config/types.ts'
import { readSource } from '../../src/source/index.ts'
import { baseConfig, tempProject } from '../helpers/project.ts'

async function read(files: Record<string, string>) {
  const project = await tempProject(files)
  try {
    return await readSource(baseConfig as UapaConfig, project.root)
  } finally {
    await project.cleanup()
  }
}

test('rules/ 不存在时为空列表；子目录与非 .md 文件忽略；不是目录时失败', async () => {
  const none = await read({ 'uapa.config.ts': '' })
  assert.ok(none.ok)
  assert.deepEqual(none.value.rules, [])
  const ignored = await read({
    'rules/README.txt': '说明\n',
    'rules/nested/inner.md': '---\nactivation: always\n---\n',
  })
  assert.ok(ignored.ok)
  assert.deepEqual(ignored.value.rules, [])
  const file = await read({ rules: '不是目录\n' })
  assert.ok(!file.ok)
  assert.deepEqual(file.issues, [
    { file: 'rules', field: null, message: 'rules 应为目录' },
  ])
})

test('得出三种 activation 的字段，按 name 排序，正文为 frontmatter 之后的原文', async () => {
  const result = await read({
    'rules/style.md': '---\nactivation: always\n---\n\n使用中文。\n',
    'rules/api.md':
      '---\nactivation: model\ndescription: 编写 API 时\ntargets: [agy:subprocess]\n---\n正文\n',
    'rules/ts-files.md':
      '---\nactivation: glob\ndescription: TS 文件\nglobs: ["*.ts", "src/**/*.tsx"]\n---\n# TS\n',
  })
  assert.ok(result.ok)
  assert.deepEqual(result.value.rules, [
    {
      name: 'api',
      path: 'rules/api.md',
      activation: 'model',
      description: '编写 API 时',
      globs: [],
      body: '正文\n',
      targets: ['agy:subprocess'],
    },
    {
      name: 'style',
      path: 'rules/style.md',
      activation: 'always',
      description: null,
      globs: [],
      body: '\n使用中文。\n',
      targets: null,
    },
    {
      name: 'ts-files',
      path: 'rules/ts-files.md',
      activation: 'glob',
      description: 'TS 文件',
      globs: ['*.ts', 'src/**/*.tsx'],
      body: '# TS\n',
      targets: null,
    },
  ])
})

test('正文含 CRLF 时原样保留；结束行之后没有内容时正文为空', async () => {
  const result = await read({
    'rules/crlf.md': '---\r\nactivation: always\r\n---\r\n第一行\r\n第二行\r\n',
    'rules/empty.md': '---\nactivation: always\n---',
  })
  assert.ok(result.ok)
  assert.deepEqual(
    result.value.rules.map(rule => rule.body),
    ['第一行\r\n第二行\r\n', ''],
  )
})

test('frontmatter 与文件名不合规则时失败，field 写到 frontmatter 字段', async () => {
  const cases: [string, string, string | null, RegExp][] = [
    ['a.md', '正文\n', null, /frontmatter/],
    [
      'a.md',
      '---\nactivation: always\nalwaysApply: true\n---\n',
      'alwaysApply',
      /不支持/,
    ],
    ['a.md', '---\nactivation: manual\n---\n', 'activation', /always、model 或 glob/],
    ['a.md', '---\ndescription: d\n---\n', 'activation', /always、model 或 glob/],
    ['a.md', '---\nactivation: model\n---\n', 'description', /model 时必填/],
    [
      'a.md',
      '---\nactivation: always\ndescription: ""\n---\n',
      'description',
      /非空单行/,
    ],
    [
      'a.md',
      '---\nactivation: always\ndescription: "a\\nb"\n---\n',
      'description',
      /非空单行/,
    ],
    ['a.md', '---\nactivation: glob\n---\n', 'globs', /非空的字符串列表/],
    [
      'a.md',
      '---\nactivation: glob\nglobs: "*.ts"\n---\n',
      'globs',
      /非空的字符串列表/,
    ],
    [
      'a.md',
      '---\nactivation: always\nglobs: ["*.ts"]\n---\n',
      'globs',
      /glob 时才能写/,
    ],
    [
      'a.md',
      '---\nactivation: glob\nglobs: ["*.ts,*.md"]\n---\n',
      'globs[0]',
      /不含 ,/,
    ],
    [
      'a.md',
      '---\nactivation: glob\nglobs: ["*.ts", " "]\n---\n',
      'globs[1]',
      /非空单行/,
    ],
    [
      'a.md',
      '---\nactivation: always\ntargets: []\n---\n',
      'targets',
      /非空的目标名列表/,
    ],
    ['a b.md', '---\nactivation: always\n---\n', null, /字母、数字、_、-/],
  ]
  for (const [name, text, field, message] of cases) {
    const result = await read({ [`rules/${name}`]: text })
    assert.ok(!result.ok, `${name}: ${text}`)
    assert.equal(result.issues[0]?.file, `rules/${name}`)
    assert.equal(result.issues[0]?.field, field, text)
    assert.match(result.issues[0]?.message ?? '', message)
  }
})
