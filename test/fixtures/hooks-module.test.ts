// hooks 模块夹具的产物性质（F-05-08、F-05-10、F-05-18）：去重变量为 null 时守卫文件不含
// $.env.set，未计划停机前检查时不含状态引用；两个目标都配置时两个入口使用同一去重变量名；
// 守卫选项的取值由 register 的第二个参数传入（TA-23）
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { api, nextOf, only, record } from '../helpers/hooks-module.ts'
import { type FixtureRun, readCase, withFixtureRun } from './run.ts'

function text(run: FixtureRun, path: string): string {
  const content = run.tree.get(path)
  assert.ok(content !== undefined, path)
  return content.toString('utf8')
}

test('in-process-only：守卫文件不含 $.env.set 与 atom，plugin.json 不写 types', async () => {
  await withFixtureRun(
    'in-process-only',
    await readCase('in-process-only'),
    async run => {
      assert.equal(run.exitCode, 0, run.stderr)
      const guard = text(run, 'dist/claude-code/hooks/uapa-guard.mjs')
      assert.ok(!guard.includes('$.env.set'))
      assert.ok(!guard.includes('atom('))
      assert.ok(!guard.includes('classic.Stop'))
      const manifest = JSON.parse(
        text(run, 'dist/claude-code/.claude-plugin/plugin.json'),
      )
      assert.ok(!('types' in manifest))
      assert.ok(!run.tree.has('dist/claude-code/types/index.d.ts'))
    },
  )
})

test('claude-both：两个入口使用 UAPA_MODULE_SESSION_BOTH_GUARD', async () => {
  await withFixtureRun('claude-both', await readCase('claude-both'), async run => {
    assert.equal(run.exitCode, 0, run.stderr)
    const name = '"UAPA_MODULE_SESSION_BOTH_GUARD"'
    const guard = text(run, 'dist/claude-code/hooks/uapa-guard.mjs')
    assert.equal(guard.split(`$.env.set(${name}`).length - 1, 2)
    assert.ok(text(run, 'dist/claude-code/hooks/uapa-claude-code.mjs').includes(name))
  })
})

test('guard-options：register 传入的取值进入拒绝原因，类型不符时以守卫选项无效拒绝', async () => {
  await withFixtureRun('guard-options', await readCase('guard-options'), async run => {
    assert.equal(run.exitCode, 0, run.stderr)
    const file = join(run.project, 'dist', 'claude-code', 'hooks', 'uapa-guard.mjs')
    const loaded = await import(pathToFileURL(file).href)
    const bash = { tool: 'Bash', tool_use_id: 't', command: 'echo uapa-deny-probe' }
    const decide = async (...values: [unknown?]) => {
      const hook = only(record(loaded.register, ...values), 'tool.call').hook
      const { next, calls } = nextOf()
      return { result: await hook(api('s'), bash, next), calls }
    }
    const reason = (label: string, maxLength: number, strict: boolean) =>
      `${label}: 拒绝标记命令 uapa-deny-probe（maxLength=${maxLength}，strict_mode=${strict}）`
    assert.deepEqual(await decide(), {
      result: { deny: reason('uapa-guard', 200, true) },
      calls: [],
    })
    const values = { maxLength: 64, strict_mode: false, label: 'x y=z' }
    assert.deepEqual(await decide(values), {
      result: { deny: reason('x y=z', 64, false) },
      calls: [],
    })
    assert.deepEqual(await decide({ maxLength: '64' }), {
      result: { deny: 'uapa: 守卫选项无效: maxLength' },
      calls: [],
    })
  })
})
