// 读取 commands（F-01-11，SD-33）：commands/ 下一层的 .md 文件，只校验 description 与 targets
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

test('commands/ 不存在时为空列表；子目录与非 .md 文件忽略', async () => {
  const none = await read({ 'uapa.config.ts': '' })
  assert.ok(none.ok)
  assert.deepEqual(none.value.commands, [])
  const ignored = await read({
    'commands/README.txt': '说明\n',
    'commands/nested/inner.md': '---\ndescription: d\n---\n',
  })
  assert.ok(ignored.ok)
  assert.deepEqual(ignored.value.commands, [])
})

test('得出名称、路径、description、正文与 targets，按 name 排序；其他键不校验', async () => {
  const result = await read({
    'commands/zeta.md':
      '---\ndescription: z\nargument-hint: <文件>\nmodel: haiku\n---\n$1\n',
    'commands/alpha.md':
      '---\ndescription: a\ntargets: [claude-code:subprocess]\n---\n',
  })
  assert.ok(result.ok)
  assert.deepEqual(result.value.commands, [
    {
      name: 'alpha',
      path: 'commands/alpha.md',
      description: 'a',
      body: '',
      targets: ['claude-code:subprocess'],
    },
    {
      name: 'zeta',
      path: 'commands/zeta.md',
      description: 'z',
      body: '$1\n',
      targets: null,
    },
  ])
})

test('缺 frontmatter、缺 description、targets 无效、文件名不合规则时失败', async () => {
  const cases: [string, string, string | null, RegExp][] = [
    ['a.md', '审查改动\n', null, /frontmatter/],
    ['a.md', '---\nargument-hint: x\n---\n', 'description', /非空/],
    ['a.md', '---\ndescription: " "\n---\n', 'description', /非空/],
    [
      'a.md',
      '---\ndescription: d\ntargets: [cursor:subprocess]\n---\n',
      'targets[0]',
      /未知目标名/,
    ],
    ['a.b.md', '---\ndescription: d\n---\n', null, /字母、数字、_、-/],
  ]
  for (const [name, text, field, message] of cases) {
    const result = await read({ [`commands/${name}`]: text })
    assert.ok(!result.ok, text)
    assert.equal(result.issues[0]?.file, `commands/${name}`)
    assert.equal(result.issues[0]?.field, field)
    assert.match(result.issues[0]?.message ?? '', message)
  }
})
