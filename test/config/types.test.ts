// 构建配置类型（F-01-01）：类型不符时 tsc 报错，
// 由 @ts-expect-error 在 pnpm check 中核对
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defineConfig, type UapaConfig } from '../../src/index.ts'

const valid: UapaConfig = {
  name: 'demo',
  version: '0.1.0',
  description: 'd',
  targets: ['claude-code:subprocess'],
  hosts: { 'claude-code': { dir: 'out', displayName: 'Demo' } },
}

test('defineConfig 原样返回配置', () => {
  assert.equal(defineConfig(valid), valid)
})

test('类型不符时 tsc 报错', () => {
  // @ts-expect-error 未登记的目标名
  defineConfig({ ...valid, targets: ['cursor:subprocess'] })
  // @ts-expect-error 未登记的宿主
  defineConfig({ ...valid, hosts: { cursor: {} } })
  // @ts-expect-error 缺少必填字段 version
  defineConfig({ name: 'demo', description: 'd', targets: ['claude-code:subprocess'] })
  assert.ok(true)
})
