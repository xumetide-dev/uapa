// agy 的 rules（F-11-09，SD-32）：activation 换为 trigger，globs 以 , 连接为一个字符串，
// 正文为 Rule.body 原文；生成后超过 24,000 字节时写残余风险
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parse } from 'yaml'
import { agySubprocess } from '../../src/capabilities/agy-subprocess.ts'
import type { UapaConfig } from '../../src/config/types.ts'
import type { Rule } from '../../src/source/types.ts'
import { agy } from '../../src/targets/agy/index.ts'
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
      '---\ntrigger: glob\ndescription: TS 文件\nglobs: "*.ts,src/**/*.tsx"\n---\n\n使用中文。\r\n',
  })
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
    globs: globs.join(','),
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
