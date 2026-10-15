// 打包入口（F-04-06、F-04-07 的外部导入检查）
import assert from 'node:assert/strict'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { bundle, entryPath } from '../../src/bundle/index.ts'
import type { BundleRequest } from '../../src/bundle/types.ts'
import type { TargetRuntimeData } from '../../src/runtime/core/types.ts'
import { importsOf } from '../helpers/imports.ts'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const ENTRY = here('../runtime/entries/test-subprocess.ts')

let dir = ''
before(async () => {
  dir = await mkdtemp(join(tmpdir(), 'uapa-bundle-'))
})
after(() => rm(dir, { recursive: true, force: true }))

const DATA: TargetRuntimeData = {
  pluginName: 'demo-plugin',
  toolNames: { Bash: 'shell' },
  capabilities: {
    rewriteInput: true,
    replaceOutput: false,
    withholdOutput: false,
    stopGate: true,
    promptGate: false,
  },
  moduleSessionEnv: null,
}

function request(
  guardModule: string,
  data: Partial<TargetRuntimeData> = {},
): BundleRequest {
  return { entry: ENTRY, guardModule, data: { ...DATA, ...data }, external: 'node' }
}

// 把测试守卫复制到 name 目录下，守卫另导入一个本地模块，本地模块导入 node:crypto
async function guardIn(name: string): Promise<string> {
  const target = join(dir, name)
  await cp(here('../runtime/guards'), target, { recursive: true })
  await writeFile(
    join(target, 'helper.ts'),
    "import { createHash } from 'node:crypto'\nexport const digest = typeof createHash\n",
  )
  await writeFile(
    join(target, 'with-helper.ts'),
    "import base from './scripted.ts'\nimport { digest } from './helper.ts'\n" +
      'export default { ...base, name: digest }\n',
  )
  return join(target, 'with-helper.ts')
}

test('入口名相对 src/runtime/entries/ 定位，绝对路径原样使用', () => {
  const path = entryPath('claude-code-subprocess')
  assert.equal(path, here('../../src/runtime/entries/claude-code-subprocess.ts'))
  assert.equal(entryPath(ENTRY), ENTRY)
})

test('打包结果为单文件，只导入 node: 内置模块，与源文件位置无关（TA-01）', async () => {
  const first = await bundle(request(await guardIn('one')))
  const second = await bundle(request(await guardIn('two')))
  assert.equal(first, second)
  assert.ok(!first.includes(dir), '打包结果不得含本机路径')
  assert.ok(!first.includes('//#region'))
  const file = join(dir, 'entry.mjs')
  await writeFile(file, first)
  const imports = await importsOf(file)
  assert.ok(imports.length > 0)
  assert.ok(
    imports.every(id => id.startsWith('node:')),
    imports.join(', '),
  )
  assert.ok(imports.includes('node:crypto'))
})

test('替换打包时名称；moduleSessionEnv 为 null 时不保留去重分支', async () => {
  const guard = await guardIn('names')
  const plain = await bundle(request(guard))
  assert.ok(plain.includes('"demo-plugin"'))
  assert.ok(!plain.includes('__UAPA_'))
  const named = await bundle(
    request(guard, { moduleSessionEnv: 'UAPA_MODULE_SESSION_DEMO' }),
  )
  assert.ok(named.includes('"UAPA_MODULE_SESSION_DEMO"'))
  assert.ok(!plain.includes('UAPA_MODULE_SESSION'))
})

test('出现不允许的外部导入时打包失败', async () => {
  const bad = join(dir, 'bad-guard.ts')
  await writeFile(
    bad,
    "import pad from 'left-pad'\nimport fs from 'fs'\n" +
      'export default { name: String(pad) + String(fs), requires: [] }\n',
  )
  await assert.rejects(
    bundle(request(bad)),
    /打包结果含不允许的外部导入：fs、left-pad（只允许 node: 内置模块）/,
  )
  // hooks 模块形态只允许 'claude-code'：测试入口导入 node: 模块，打包失败
  await assert.rejects(
    bundle({
      ...request(await guardIn('in-process')),
      external: 'claude-code',
      checks: [],
    }),
    /打包结果含不允许的外部导入：.*node:fs.*（只允许 'claude-code'）/,
  )
})

test('hooks 模块形态按 checks 替换 __UAPA_CHECKS__；未替换的打包时名称使打包失败', async () => {
  const entry = join(dir, 'checks-entry.ts')
  await writeFile(
    entry,
    'export const flags = [__UAPA_CHECKS__.beforeTool, __UAPA_CHECKS__.beforeStop]\n',
  )
  const guard = await guardIn('checks')
  const base = { ...request(guard), entry }
  const code = await bundle({
    ...base,
    external: 'claude-code',
    checks: ['beforeTool'],
  })
  assert.match(code, /\[true, false\]/)
  await assert.rejects(bundle(base), /打包结果含未替换的打包时名称：__UAPA_CHECKS__/)
})
