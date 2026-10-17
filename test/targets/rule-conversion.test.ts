// rules 的换算承载（F-05-19、F-06-11，SD-38）：规则技能的 frontmatter、always 规则的输出脚本与
// SessionStart 条目、残余风险与跳过项
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { claudeCodeInProcess } from '../../src/capabilities/claude-code-in-process.ts'
import { claudeCodeSubprocess } from '../../src/capabilities/claude-code-subprocess.ts'
import { codexSubprocess } from '../../src/capabilities/codex-subprocess.ts'
import type { TargetCapabilities } from '../../src/capabilities/types.ts'
import type { TargetName } from '../../src/config/targets.ts'
import type { CommandHookDecl, UapaConfig } from '../../src/config/types.ts'
import type { Rule } from '../../src/source/types.ts'
import { claudeCode } from '../../src/targets/claude-code/index.ts'
import { codex } from '../../src/targets/codex/index.ts'
import {
  alwaysRulesText,
  ruleSkillFile,
  rulesScript,
} from '../../src/targets/rule-skills.ts'
import type { HostModule, HostResult, TargetPlan } from '../../src/targets/types.ts'
import { baseConfig } from '../helpers/project.ts'

function rule(name: string, extra: Partial<Rule> = {}): Rule {
  return {
    name,
    path: `rules/${name}.md`,
    activation: 'model',
    description: '设计 API 时',
    globs: [],
    body: '\n路径用名词复数。\n',
    targets: null,
    ...extra,
  }
}

const ALWAYS = rule('chinese', { activation: 'always', description: null })
const GLOB = rule('typescript', {
  activation: 'glob',
  description: '编辑 TypeScript 文件时',
  globs: ['*.ts', 'src/**/*.tsx'],
})

function plan(
  target: TargetName,
  capabilities: TargetCapabilities,
  rules: readonly Rule[],
  commandHooks: readonly CommandHookDecl[] = [],
): TargetPlan {
  return {
    target,
    capabilities,
    skills: [],
    agents: [],
    mcpServers: [],
    rules,
    commands: [],
    checks: [],
    commandHooks,
  }
}

function generate(host: HostModule, plans: readonly TargetPlan[]): Promise<HostResult> {
  const targets = plans.map(p => p.target)
  return host.generate({
    config: { ...baseConfig, targets } as UapaConfig,
    plans,
    guard: null,
    sharedWith: [],
    bundle: async () => '',
  })
}

function fileOf(result: HostResult, path: string): string {
  assert.ok(result.ok)
  const file = result.files.find(f => f.path === path)
  assert.ok(file !== undefined, path)
  return String(file.content)
}

test('规则技能的 frontmatter 依次为 name、description、paths 与 user-invocable', () => {
  assert.equal(
    ruleSkillFile(rule('api')).content,
    '---\nname: api\ndescription: 设计 API 时\nuser-invocable: false\n---\n\n路径用名词复数。\n',
  )
  assert.equal(
    ruleSkillFile(GLOB).content,
    '---\nname: typescript\ndescription: 编辑 TypeScript 文件时\npaths:\n' +
      '  - "*.ts"\n  - src/**/*.tsx\nuser-invocable: false\n---\n\n路径用名词复数。\n',
  )
  const bare = ruleSkillFile({ ...GLOB, description: null }).content
  assert.equal(
    bare,
    '---\nname: typescript\npaths:\n  - "*.ts"\n  - src/**/*.tsx\nuser-invocable: false\n' +
      '---\n\n路径用名词复数。\n',
  )
  assert.equal(ruleSkillFile(GLOB).path, 'skills/typescript/SKILL.md')
})

test('always 规则的文本：按传入顺序去掉首尾换行，以一个空行连接，末尾一个换行', () => {
  const second = rule('zeta', { activation: 'always', body: '\r\n第二条\n\n' })
  assert.equal(
    alwaysRulesText([ALWAYS, rule('api'), second]),
    '路径用名词复数。\n\n第二条\n',
  )
  assert.equal(alwaysRulesText([rule('api')]), null)
  assert.equal(rulesScript('a"b\n'), 'process.stdout.write("a\\"b\\n")\n')
})

test('Claude Code：规则技能、输出脚本与 SessionStart 条目排在声明的命令 hooks 之前', async () => {
  const declared: CommandHookDecl = {
    event: 'SessionStart',
    command: 'echo uapa-start',
  }
  const result = await generate(claudeCode, [
    plan('claude-code:subprocess', claudeCodeSubprocess, [ALWAYS, GLOB], [declared]),
  ])
  assert.ok(result.ok)
  assert.deepEqual(result.files.map(f => f.path).sort(), [
    '.claude-plugin/plugin.json',
    'hooks/hooks.json',
    'hooks/uapa-rules-claude-code.mjs',
    'skills/typescript/SKILL.md',
  ])
  assert.equal(
    fileOf(result, 'hooks/uapa-rules-claude-code.mjs'),
    'process.stdout.write("路径用名词复数。\\n")\n',
  )
  const hooks = JSON.parse(fileOf(result, 'hooks/hooks.json'))
  assert.deepEqual(hooks.hooks.SessionStart, [
    {
      hooks: [
        {
          type: 'command',
          command: `node "\${CLAUDE_PLUGIN_ROOT}/hooks/uapa-rules-claude-code.mjs"`,
          timeout: 30,
        },
      ],
    },
    { hooks: [{ type: 'command', command: 'echo uapa-start', timeout: 30 }] },
  ])
  assert.deepEqual(result.residualRisks, [])
})

test('Claude Code：只有 in-process 时仍写规则条目并写 Node 的风险；超长输出与不适用的规则写风险', async () => {
  const long = rule('long', { activation: 'always', body: 'x'.repeat(10_001) })
  const result = await generate(claudeCode, [
    plan('claude-code:in-process', claudeCodeInProcess, [long]),
  ])
  assert.ok(result.ok)
  const hooks = JSON.parse(fileOf(result, 'hooks/hooks.json'))
  assert.deepEqual(Object.keys(hooks), ['hooks'])
  assert.deepEqual(hooks.hooks.SessionStart, [
    {
      hooks: [
        {
          type: 'command',
          command: `node "\${CLAUDE_PLUGIN_ROOT}/hooks/uapa-rules-claude-code.mjs"`,
        },
      ],
    },
  ])
  assert.deepEqual(
    result.residualRisks.map(r => r.message),
    [
      'always 规则的输出为 10002 字符，超过 Claude Code 注入上下文的 10,000 字符上限，' +
        '超出部分不进入上下文',
      'always 规则由 SessionStart 命令 hook 以 node 运行输出：只配置 claude-code:in-process ' +
        '时也需要本机有 Node，没有时规则不进入上下文',
    ],
  )
  const both = await generate(claudeCode, [
    plan('claude-code:in-process', claudeCodeInProcess, []),
    plan('claude-code:subprocess', claudeCodeSubprocess, [GLOB]),
  ])
  assert.ok(both.ok)
  assert.deepEqual(both.residualRisks, [
    {
      target: 'claude-code:in-process',
      message: 'rule typescript 不适用于本目标，但与其他目标共用插件目录，宿主仍会加载',
    },
  ])
})

test('Codex：规则技能与 Claude Code 逐字一致；没有 description 的 glob 规则跳过', async () => {
  const bare = rule('bare', { activation: 'glob', description: null, globs: ['*.md'] })
  const result = await generate(codex, [
    plan('codex:subprocess', codexSubprocess, [ALWAYS, bare, GLOB, rule('api')]),
  ])
  assert.ok(result.ok)
  assert.deepEqual(result.skipped, [
    {
      target: 'codex:subprocess',
      component: 'rules/bare.md',
      reason: 'Codex 的技能须有 description，没有 description 的 glob 规则不能写为技能',
    },
  ])
  const claude = await generate(claudeCode, [
    plan('claude-code:subprocess', claudeCodeSubprocess, [GLOB, rule('api')]),
  ])
  for (const path of ['skills/typescript/SKILL.md', 'skills/api/SKILL.md']) {
    assert.equal(fileOf(result, path), fileOf(claude, path))
  }
  assert.equal(
    fileOf(result, 'hooks/uapa-rules-codex.mjs'),
    'process.stdout.write("路径用名词复数。\\n")\n',
  )
  const hooks = JSON.parse(fileOf(result, 'hooks/hooks.json'))
  assert.deepEqual(hooks.hooks.SessionStart, [
    {
      hooks: [
        {
          type: 'command',
          command: `node "\${PLUGIN_ROOT}/hooks/uapa-rules-codex.mjs"`,
          timeout: 30,
        },
      ],
    },
  ])
  const messages = result.residualRisks.map(r => r.message)
  assert.ok(messages.some(m => m.startsWith('Codex 不按 paths 加载技能')))
  assert.ok(
    messages.some(m => m.startsWith('always 规则由 SessionStart 命令 hook 输出')),
  )
})
