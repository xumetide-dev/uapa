// agy 的 rules（F-11-09，SD-32）：activation 换为 trigger，globs 以 , 连接为一个字符串，含目录的
// 模式加 **/ 前缀，正文为 Rule.body 原文；生成后超过 24,000 字节或加了前缀时写残余风险
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parse } from 'yaml'
import { agySubprocess } from '../../src/capabilities/agy-subprocess.ts'
import type { UapaConfig } from '../../src/config/types.ts'
import type { Rule } from '../../src/source/types.ts'
import { agy } from '../../src/targets/agy/index.ts'
import { agyGlob } from '../../src/targets/agy/rules.ts'
import type { HostResult } from '../../src/targets/types.ts'
import { baseConfig } from '../helpers/project.ts'

const TARGET = 'agy:subprocess'

const rule = (fields: Partial<Rule> & Pick<Rule, 'name' | 'activation'>): Rule => ({
  path: `rules/${fields.name}.md`,
  description: null,
  globs: [],
  body: '\n使用中文。\r\n',
  targets: null,
  ...fields,
})

async function generate(rules: readonly Rule[]): Promise<HostResult> {
  return agy.generate({
    config: { ...baseConfig, targets: [TARGET] } as UapaConfig,
    plans: [
      {
        target: TARGET,
        capabilities: agySubprocess,
        skills: [],
        agents: [],
        mcpServers: [],
        rules,
        commands: [],
        checks: [],
        commandHooks: [],
      },
    ],
    guard: null,
    sharedWith: [],
    bundle: async () => '',
  })
}

function ruleFiles(result: HostResult): Record<string, string> {
  assert.ok(result.ok)
  const entries = result.files
    .filter(file => file.path.startsWith('rules/'))
    .map(file => [file.path, String(file.content)])
  return Object.fromEntries(entries)
}

test('三种 activation 换为 agy 的 trigger，description 有值时写出，正文原样', async () => {
  const result = await generate([
    rule({ name: 'always', activation: 'always' }),
    rule({ name: 'api', activation: 'model', description: '编写 API 时: 先读规范' }),
    rule({
      name: 'ts',
      activation: 'glob',
      description: 'TS 文件',
      globs: ['*.ts', 'src/**/*.tsx'],
    }),
  ])
  assert.deepEqual(ruleFiles(result), {
    'rules/always.md': '---\ntrigger: always_on\n---\n\n使用中文。\r\n',
    'rules/api.md':
      '---\ntrigger: model_decision\ndescription: "编写 API 时: 先读规范"\n---\n\n使用中文。\r\n',
    'rules/ts.md':
      '---\ntrigger: glob\ndescription: TS 文件\nglobs: "*.ts,**/src/**/*.tsx"\n---\n\n使用中文。\r\n',
  })
  assert.ok(result.ok)
  assert.deepEqual(result.residualRisks, [
    {
      target: TARGET,
      message:
        'rules/ts.md 的 globs 中含目录的模式写为 **/ 开头：agy 按文件的绝对路径匹配，' +
        '这些模式也匹配其他位置的同名目录',
    },
  ])
})

test('globs 的换算：不含 / 或已以 /、**/ 开头的模式原样，其余加 **/ 前缀，开头的 ./ 去掉', () => {
  const cases: [string, string][] = [
    ['*.ts', '*.ts'],
    ['Makefile', 'Makefile'],
    ['src/**/*.tsx', '**/src/**/*.tsx'],
    ['src/ui/*.tsx', '**/src/ui/*.tsx'],
    ['./docs/*.md', '**/docs/*.md'],
    ['./*.ts', '**/*.ts'],
    ['**/*.tsx', '**/*.tsx'],
    ['**/src/**', '**/src/**'],
    ['/etc/*.conf', '/etc/*.conf'],
  ]
  for (const [pattern, written] of cases)
    assert.equal(agyGlob(pattern), written, pattern)
})

test('globs 都不需要换算时不写前缀风险', async () => {
  const globs = ['*.ts', '**/*.tsx']
  const result = await generate([rule({ name: 'ts', activation: 'glob', globs })])
  assert.ok(result.ok)
  assert.deepEqual(result.residualRisks, [])
})

test('frontmatter 为 YAML：长字符串不折行，解析后取值与源项目一致', async () => {
  const description = '较长的说明'.repeat(30)
  const globs = ['src/**/*.ts', 'test/**/*.ts']
  const result = await generate([
    rule({ name: 'long', activation: 'glob', description, globs }),
  ])
  const text = ruleFiles(result)['rules/long.md'] ?? ''
  const [, meta] = text.split('---\n')
  assert.equal(meta?.split('\n').length, 4)
  assert.deepEqual(parse(meta ?? ''), {
    trigger: 'glob',
    description,
    globs: '**/src/**/*.ts,**/test/**/*.ts',
  })
})

test('生成后超过 24,000 字节的规则写残余风险', async () => {
  const result = await generate([
    rule({ name: 'big', activation: 'always', body: 'x'.repeat(24_000) }),
    rule({ name: 'small', activation: 'always' }),
  ])
  assert.ok(result.ok)
  assert.deepEqual(result.residualRisks, [
    {
      target: TARGET,
      message: 'rules/big.md 超过 agy 规则文件的 24,000 字节上限，超出部分被宿主截断',
    },
  ])
})

test('没有 rules 时不生成 rules/', async () => {
  const result = await generate([])
  assert.deepEqual(ruleFiles(result), {})
})
