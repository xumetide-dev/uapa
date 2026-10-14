// 读取 skills 与 frontmatter 的目标限定（F-01-04、F-01-05、TA-04）
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { UapaConfig } from '../../src/config/types.ts'
import { readSource } from '../../src/source/index.ts'
import { baseConfig, tempProject } from '../helpers/project.ts'

const skill = (name: string, extra = '') =>
  `---\nname: ${name}\ndescription: 说明 ${name}\n${extra}---\n\n正文\n`

async function read(files: Record<string, string>) {
  const project = await tempProject(files)
  try {
    return await readSource(baseConfig as UapaConfig, project.root)
  } finally {
    await project.cleanup()
  }
}

test('skills/ 不存在时为空列表，不是目录的项忽略', async () => {
  const none = await read({ 'uapa.config.ts': '' })
  assert.ok(none.ok)
  assert.deepEqual(none.value.skills, [])
  const withFile = await read({ 'skills/README.md': '说明\n' })
  assert.ok(withFile.ok)
  assert.deepEqual(withFile.value.skills, [])
})

test('递归列出文件并按字典序排列，skills 按 name 排序', async () => {
  const result = await read({
    'skills/zeta/SKILL.md': skill('zeta'),
    'skills/alpha/SKILL.md': skill('alpha', 'targets: [claude-code:subprocess]\n'),
    'skills/alpha/scripts/run.sh': 'echo\n',
    'skills/alpha/README.md': 'r\n',
  })
  assert.ok(result.ok)
  assert.deepEqual(result.value.skills, [
    {
      name: 'alpha',
      dir: 'skills/alpha',
      files: ['README.md', 'SKILL.md', 'scripts/run.sh'],
      targets: ['claude-code:subprocess'],
    },
    { name: 'zeta', dir: 'skills/zeta', files: ['SKILL.md'], targets: null },
  ])
})

test('缺 SKILL.md、frontmatter 无效、name 与目录名不一致时失败', async () => {
  const cases: [Record<string, string>, string | null, RegExp][] = [
    [{ 'skills/a/other.md': 'x\n' }, null, /缺少 SKILL.md/],
    [{ 'skills/a/SKILL.md': '正文\n' }, null, /frontmatter/],
    [{ 'skills/a/SKILL.md': '---\nname: [a\n---\n' }, null, /YAML/],
    [{ 'skills/a/SKILL.md': skill('b') }, 'name', /与目录名 a 不一致/],
    [
      { 'skills/a/SKILL.md': '---\nname: a\ndescription: ""\n---\n' },
      'description',
      /非空/,
    ],
  ]
  for (const [files, field, message] of cases) {
    const result = await read(files)
    assert.ok(!result.ok)
    assert.equal(result.issues[0]?.field, field)
    assert.match(result.issues[0]?.message ?? '', message)
  }
})

test('frontmatter 的 targets 含未知目标名或为空数组时失败', async () => {
  const unknown = await read({
    'skills/a/SKILL.md': skill(
      'a',
      'targets: [claude-code:subprocess, cursor:subprocess]\n',
    ),
  })
  assert.ok(!unknown.ok)
  assert.deepEqual(unknown.issues, [
    {
      file: 'skills/a/SKILL.md',
      field: 'targets[1]',
      message: '未知目标名 "cursor:subprocess"',
    },
  ])
  const empty = await read({ 'skills/a/SKILL.md': skill('a', 'targets: []\n') })
  assert.ok(!empty.ok)
  assert.equal(empty.issues[0]?.field, 'targets')
})
