// 包结构检查（F-10-03、TA-10）：安装面不含生命周期脚本，生产依赖只有三个。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const manifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
)

// 安装或打包时会被包管理器自动运行的脚本名；git 依赖安装时还会运行 prepare。
const LIFECYCLE_SCRIPTS = [
  'preinstall',
  'install',
  'postinstall',
  'preprepare',
  'prepare',
  'postprepare',
  'prepublish',
  'prepublishOnly',
  'prepack',
  'postpack',
]

test('package.json 不含生命周期脚本', () => {
  const declared = Object.keys(manifest.scripts ?? {})
  const lifecycle = declared.filter(name => LIFECYCLE_SCRIPTS.includes(name))
  assert.deepEqual(lifecycle, [])
})

test('生产依赖只有 rolldown、yaml、zod', () => {
  assert.deepEqual(Object.keys(manifest.dependencies ?? {}).sort(), [
    'rolldown',
    'yaml',
    'zod',
  ])
  assert.equal(manifest.optionalDependencies, undefined)
  assert.equal(manifest.peerDependencies, undefined)
})

test('入口、安装面与运行环境', () => {
  assert.equal(manifest.type, 'module')
  assert.deepEqual(manifest.bin, { uapa: './dist/cli/main.js' })
  assert.deepEqual(manifest.exports, {
    '.': { types: './dist/index.d.ts', default: './dist/index.js' },
  })
  assert.deepEqual(manifest.files, ['dist/'])
  assert.equal(manifest.engines?.node, '>=22.18')
  assert.match(manifest.packageManager, /^pnpm@12\.\d+\.\d+$/)
})
