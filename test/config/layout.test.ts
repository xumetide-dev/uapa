// 插件目录解析（模块接口 §2）
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolvePluginDirs } from '../../src/config/layout.ts'
import { baseConfig } from '../helpers/project.ts'

test('默认为 <outDir>/<宿主>，dir 相对配置文件所在目录', () => {
  assert.deepEqual(resolvePluginDirs(baseConfig, '/p'), [
    { path: '/p/dist/claude-code', hosts: ['claude-code'] },
  ])
  assert.deepEqual(resolvePluginDirs({ ...baseConfig, outDir: 'build' }, '/p'), [
    { path: '/p/build/claude-code', hosts: ['claude-code'] },
  ])
  const custom = { ...baseConfig, hosts: { 'claude-code': { dir: '../plugin' } } }
  assert.deepEqual(resolvePluginDirs(custom, '/p'), [
    { path: '/plugin', hosts: ['claude-code'] },
  ])
})
