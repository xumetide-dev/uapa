// hooks 模块夹具的产物性质（F-05-08、F-05-10）：去重变量为 null 时守卫文件不含 $.env.set，
// 未计划停机前检查时不含状态引用；两个目标都配置时两个入口使用同一去重变量名
import assert from 'node:assert/strict'
import { test } from 'node:test'
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
