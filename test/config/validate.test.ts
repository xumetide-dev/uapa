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
  assert.deepEqual(fields({ ...baseConfig, hosts: { codex: {} } }), ['hosts.codex'])
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
