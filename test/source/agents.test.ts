// 读取 agents（F-01-07，SD-30）：agents/ 下一层的 .md 文件，frontmatter 的 name 与文件名相同
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { UapaConfig } from '../../src/config/types.ts'
import { readSource } from '../../src/source/index.ts'
import { baseConfig, tempProject } from '../helpers/project.ts'

const agent = (name: string, extra = '') =>
  `---\nname: ${name}\ndescription: 说明 ${name}\n${extra}---\n\n你是 ${name}。\n`

async function read(files: Record<string, string>) {
  const project = await tempProject(files)
  try {
    return await readSource(baseConfig as UapaConfig, project.root)
  } finally {
    await project.cleanup()
  }
}

test('agents/ 不存在时为空列表；子目录与非 .md 文件忽略', async () => {
  const none = await read({ 'uapa.config.ts': '' })
  assert.ok(none.ok)
  assert.deepEqual(none.value.agents, [])
  const ignored = await read({
    'agents/README.txt': '说明\n',
    'agents/nested/inner.md': agent('inner'),
  })
  assert.ok(ignored.ok)
  assert.deepEqual(ignored.value.agents, [])
})

test('agents 不是目录时失败', async () => {
  const result = await read({ agents: '不是目录\n' })
  assert.ok(!result.ok)
  assert.deepEqual(result.issues, [
    { file: 'agents', field: null, message: 'agents 应为目录' },
  ])
})

test('得出名称、路径与 targets，按 name 排序', async () => {
  const result = await read({
    'agents/zeta.md': agent('zeta'),
    'agents/alpha.md': agent('alpha', 'targets: [agy:subprocess]\n'),
  })
  assert.ok(result.ok)
  assert.deepEqual(result.value.agents, [
    { name: 'alpha', path: 'agents/alpha.md', targets: ['agy:subprocess'] },
    { name: 'zeta', path: 'agents/zeta.md', targets: null },
  ])
})

test('缺 frontmatter、name 或 description 无效、name 与文件名不同、targets 无效时失败', async () => {
  const cases: [string, string | null, RegExp][] = [
    ['正文\n', null, /frontmatter/],
    ['---\nname: [a\n---\n', null, /YAML/],
    ['---\ndescription: 说明\n---\n', 'name', /非空/],
    ['---\nname: a\ndescription: " "\n---\n', 'description', /非空/],
    [agent('b'), 'name', /与文件名 a 不一致/],
    [agent('a', 'targets: []\n'), 'targets', /非空的目标名列表/],
    [agent('a', 'targets: [cursor:subprocess]\n'), 'targets[0]', /未知目标名/],
  ]
  for (const [text, field, message] of cases) {
    const result = await read({ 'agents/a.md': text })
    assert.ok(!result.ok)
    assert.equal(result.issues[0]?.file, 'agents/a.md')
    assert.equal(result.issues[0]?.field, field)
    assert.match(result.issues[0]?.message ?? '', message)
  }
})

test('skills 与 agents 的问题一并返回', async () => {
  const result = await read({
    'skills/s/SKILL.md': '正文\n',
    'agents/a.md': agent('b'),
  })
  assert.ok(!result.ok)
  assert.deepEqual(
    result.issues.map(issue => issue.file),
    ['skills/s/SKILL.md', 'agents/a.md'],
  )
})
