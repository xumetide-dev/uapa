// 校验构建配置（F-01-03）：每条失败分支给出字段路径
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { InputIssue } from '../../src/config/issues.ts'
import { validateConfig } from '../../src/config/validate.ts'
import { baseConfig } from '../helpers/project.ts'

const ROOT = '/work/project'

function issues(value: unknown): InputIssue[] {
  const result = validateConfig(value, 'uapa.config.ts', ROOT)
  return result.ok ? [] : [...result.issues]
}

function fields(value: unknown): (string | null)[] {
  return issues(value).map(issue => issue.field)
}

test('合法配置通过', () => {
  const result = validateConfig(baseConfig, 'uapa.config.ts', ROOT)
  assert.ok(result.ok)
})

test('未知目标名、重复目标与空目标列表', () => {
  const unknown = issues({ ...baseConfig, targets: ['claude-code:subprocess', 'x:y'] })
  assert.deepEqual(unknown, [
    { file: 'uapa.config.ts', field: 'targets[1]', message: '未知目标名 "x:y"' },
  ])
  const repeated = ['claude-code:subprocess', 'claude-code:subprocess']
  assert.deepEqual(issues({ ...baseConfig, targets: repeated }), [
    {
      file: 'uapa.config.ts',
      field: 'targets[1]',
      message: '重复的目标 claude-code:subprocess',
    },
  ])
  assert.deepEqual(fields({ ...baseConfig, targets: [] }), ['targets'])
})

test('缺必填字段与未知字段', () => {
  const { name: _name, ...withoutName } = baseConfig
  assert.deepEqual(issues(withoutName), [
    { file: 'uapa.config.ts', field: 'name', message: '缺少必填字段' },
  ])
  assert.deepEqual(issues({ ...baseConfig, extra: 1 }), [
    { file: 'uapa.config.ts', field: 'extra', message: '未知字段' },
  ])
  assert.deepEqual(fields({ ...baseConfig, hosts: { 'copilot-cli': {} } }), [
    'hosts.copilot-cli',
  ])
  const unknownOption = { ...baseConfig, hosts: { 'claude-code': { foo: 1 } } }
  assert.deepEqual(fields(unknownOption), ['hosts.claude-code.foo'])
  assert.deepEqual(fields({ ...baseConfig, version: 'v1' }), ['version'])
  assert.deepEqual(fields({ ...baseConfig, author: {} }), ['author.name'])
})

test('默认布局的插件目录不得等于或包含源项目根目录、outDir', () => {
  const at = (dir: string, extra: object = {}) => ({
    ...baseConfig,
    ...extra,
    hosts: { 'claude-code': { dir } },
  })
  // 根目录与上级目录都同时覆盖源项目根目录与 outDir，各报一条
  const twice = ['hosts.claude-code.dir', 'hosts.claude-code.dir']
  assert.deepEqual(fields(at('.')), twice)
  assert.deepEqual(fields(at('..')), twice)
  assert.deepEqual(fields(at('dist')), ['hosts.claude-code.dir'])
  assert.deepEqual(fields(at('out', { outDir: 'out/reports' })), [
    'hosts.claude-code.dir',
  ])
  assert.match(issues(at('.'))[0]?.message ?? '', /源项目根目录/)
  assert.deepEqual(fields(at('plugins/claude')), [])
  // 默认插件目录 <outDir>/<宿主> 由 outDir 推出，出错时字段为 outDir
  const nested = validateConfig(
    { ...baseConfig, outDir: '../..' },
    'u.ts',
    '/w/claude-code/app',
  )
  assert.ok(!nested.ok)
  assert.equal(nested.issues[0]?.field, 'outDir')
})

// 以下三个分支在登记第二个宿主后才能构造（M1-02 验收 §7 第 1 行）
const twoHosts = ['claude-code:subprocess', 'agy:subprocess']

test('hosts 中出现 targets 未配置目标的宿主时，字段为 hosts.<宿主>', () => {
  assert.deepEqual(issues({ ...baseConfig, hosts: { agy: {} } }), [
    {
      file: 'uapa.config.ts',
      field: 'hosts.agy',
      message: 'targets 中没有该宿主的目标',
    },
  ])
  const agyOnly = { ...baseConfig, targets: ['agy:subprocess'] }
  assert.deepEqual(fields({ ...agyOnly, hosts: { 'claude-code': {} } }), [
    'hosts.claude-code',
  ])
  assert.deepEqual(fields({ ...baseConfig, targets: twoHosts, hosts: { agy: {} } }), [])
  assert.deepEqual(fields({ ...agyOnly, hosts: { agy: { extra: 1 } } }), [
    'hosts.agy.extra',
  ])
})

test('默认布局的插件目录包含另一宿主的插件目录时校验失败', () => {
  const dirs = (claude: string, agy: string) =>
    issues({
      ...baseConfig,
      targets: twoHosts,
      hosts: { 'claude-code': { dir: claude }, agy: { dir: agy } },
    })
  const outer = dirs('plugins', 'plugins/agy')
  assert.deepEqual(
    outer.map(issue => issue.field),
    ['hosts.claude-code.dir'],
  )
  assert.match(outer[0]?.message ?? '', /不能等于或包含agy 的插件目录（plugins\/agy）/)
  const inner = dirs('out/claude', 'out')
  assert.deepEqual(
    inner.map(issue => issue.field),
    ['hosts.agy.dir'],
  )
  assert.match(inner[0]?.message ?? '', /claude-code 的插件目录（out\/claude）/)
  assert.deepEqual(dirs('plugins/claude', 'plugins/agy'), [])
  // 两个宿主解析为同一目录时为合并布局（F-03-06），不按默认布局检查
  assert.deepEqual(dirs('plugins', 'plugins'), [])
})

// 承接 M1-02 验收 §7 第 2 行：hooksFile 只能是插件目录内的相对文件路径
test('hosts.codex.hooksFile 为绝对路径、含 .. 或空段时校验失败', () => {
  const codex = (hooksFile: unknown) => ({
    ...baseConfig,
    targets: ['codex:subprocess'],
    hosts: { codex: { hooksFile } },
  })
  const invalid = [
    '/abs/hooks.json',
    'C:/hooks.json',
    '../hooks.json',
    'hooks/../../x.json',
    'hooks\\x.json',
    'hooks/',
    './',
    '.',
    '',
  ]
  for (const path of invalid) {
    assert.deepEqual(fields(codex(path)), ['hosts.codex.hooksFile'], path)
  }
  assert.match(issues(codex('../x.json'))[0]?.message ?? '', /不得为绝对路径或含 \.\./)
  for (const path of ['hooks/codex.json', './hooks/codex.json', 'codex-hooks.json']) {
    assert.deepEqual(fields(codex(path)), [], path)
  }
  assert.deepEqual(
    fields({ ...codex('h.json'), hosts: { codex: { interface: 'x' } } }),
    ['hosts.codex.interface'],
  )
})

// v0.4.0 的配置字段（F-01-14）
test("hosts['claude-code'].manifest 含保留键或不是对象、onFailure 不是 'block' 时校验失败", () => {
  const claude = (options: object) => ({
    ...baseConfig,
    hosts: { 'claude-code': options },
  })
  const manifest = { license: 'MIT', name: 'x', version: '1.0.0', homepage: 'h' }
  assert.deepEqual(issues(claude({ manifest })), [
    {
      file: 'uapa.config.ts',
      field: 'hosts.claude-code.manifest.name',
      message: '由 UAPA 生成或依赖默认位置，不能透传',
    },
    {
      file: 'uapa.config.ts',
      field: 'hosts.claude-code.manifest.version',
      message: '由 UAPA 生成或依赖默认位置，不能透传',
    },
  ])
  assert.deepEqual(fields(claude({ manifest: ['MIT'] })), [
    'hosts.claude-code.manifest',
  ])
  assert.deepEqual(
    fields(claude({ manifest: { license: 'MIT', hooks: './h.json' } })),
    [],
  )
  assert.deepEqual(issues(claude({ onFailure: 'none' })), [
    {
      file: 'uapa.config.ts',
      field: 'hosts.claude-code.onFailure',
      message: "只能为 'block'",
    },
  ])
  assert.deepEqual(fields(claude({ onFailure: 'block' })), [])
})

test('marketplace 的名称、owner 与未知字段', () => {
  const market = (marketplace: object) => ({ ...baseConfig, marketplace })
  const owner = { name: 'A' }
  assert.deepEqual(fields(market({ name: 'demo-market', owner })), [])
  assert.deepEqual(
    fields(
      market({ name: 'demo-market', owner: { name: 'A', email: 'a@example.com' } }),
    ),
    [],
  )
  assert.deepEqual(issues(market({ name: 'Demo Market', owner })), [
    { file: 'uapa.config.ts', field: 'marketplace.name', message: '不是 kebab-case' },
  ])
  assert.deepEqual(fields(market({ name: 'm', owner: {} })), ['marketplace.owner.name'])
  assert.deepEqual(fields(market({ name: 'm', owner, extra: 1 })), [
    'marketplace.extra',
  ])
  assert.deepEqual(fields(market({ name: 'm' })), ['marketplace.owner'])
})

test('只有 agy 目标时不得配置 marketplace', () => {
  const agyOnly = {
    ...baseConfig,
    targets: ['agy:subprocess'],
    marketplace: { name: 'm', owner: { name: 'A' } },
  }
  const [issue] = issues(agyOnly)
  assert.equal(issue?.field, 'marketplace')
  assert.match(issue?.message ?? '', /agy 只支持官方 marketplace/)
  assert.deepEqual(fields({ ...agyOnly, targets: twoHosts }), [])
})

test('marketplace.dir 位于默认布局的插件目录内，或插件目录不在其中时校验失败', () => {
  const at = (dir: string, extra: object = {}) => ({
    ...baseConfig,
    targets: ['claude-code:subprocess', 'codex:subprocess', 'agy:subprocess'],
    marketplace: { name: 'm', owner: { name: 'A' }, dir },
    ...extra,
  })
  // 默认插件目录在 dist/ 下：dist 与源项目根目录都包含它们
  assert.deepEqual(fields(at('dist')), [])
  assert.deepEqual(fields(at('.')), [])
  const cleared = issues(at('dist/claude-code/market'))
  assert.deepEqual(
    cleared.map(issue => issue.field),
    ['marketplace.dir', 'marketplace.dir', 'marketplace.dir'],
  )
  assert.match(
    cleared[0]?.message ?? '',
    /位于 claude-code 的插件目录 dist\/claude-code 之内/,
  )
  assert.match(
    cleared[1]?.message ?? '',
    /^claude-code 的插件目录 dist\/claude-code 不在/,
  )
  assert.match(
    cleared[2]?.message ?? '',
    /^codex 的插件目录 dist\/codex 不在 marketplace 目录/,
  )
  // agy 不写 marketplace 条目，它的插件目录不必在 marketplace 目录内
  const outside = issues(at('market'))
  assert.deepEqual(
    outside.map(issue => issue.message.split(' ')[0]),
    ['claude-code', 'codex'],
  )
  // 合并布局的目录不清空，可以就是 marketplace 目录
  const merged = {
    hosts: { 'claude-code': { dir: 'plugin' }, codex: { dir: 'plugin' } },
  }
  assert.deepEqual(fields(at('plugin', merged)), [])
})

test('hosts.agy.manifest 与 commandHooks[i].timeout 校验（F-01-15）', () => {
  const agyCfg = (manifest: unknown) => ({
    ...baseConfig,
    targets: ['agy:subprocess'],
    hosts: { agy: { manifest } },
  })
  assert.deepEqual(fields(agyCfg('plugin.json')), [])
  assert.deepEqual(fields(agyCfg('.antigravity-plugin/plugin.json')), [])
  assert.deepEqual(issues(agyCfg('other.json')), [
    {
      file: 'uapa.config.ts',
      field: 'hosts.agy.manifest',
      message: "只能为 'plugin.json' 或 '.antigravity-plugin/plugin.json'",
    },
  ])
  assert.deepEqual(
    fields({
      ...baseConfig,
      commandHooks: [{ event: 'Stop', command: 'echo ok', timeout: 10 }],
    }),
    [],
  )
  assert.deepEqual(
    fields({
      ...baseConfig,
      commandHooks: [{ event: 'Stop', command: 'echo ok', timeout: 0 }],
    }),
    ['commandHooks[0].timeout'],
  )
})
