// 守卫能力检查（F-03-13、F-02-04，TA-04 以合成的能力数据）与写出后的宿主校验（F-03-14）
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import type { BuildOutcome } from '../../src/build/index.ts'
import { claudeCodeSubprocess } from '../../src/capabilities/claude-code-subprocess.ts'
import type { TargetCapabilities } from '../../src/capabilities/types.ts'
import type { Capability, GuardCheck } from '../../src/runtime/core/types.ts'
import type { HostModule, TargetPlan, VerifyResult } from '../../src/targets/types.ts'
import { buildIn, deps, fakeHost, TARGET, writesManifest } from '../helpers/build.ts'

const METHODS: Readonly<Record<GuardCheck, string>> = {
  beforeTool: "beforeTool: () => ({ kind: 'allow' })",
  beforePrompt: "beforePrompt: () => ({ kind: 'allow' })",
  beforeStop: "beforeStop: () => ({ kind: 'stop' })",
  afterTool: "afterTool: () => ({ kind: 'keep' })",
}

function guardFile(requires: readonly Capability[], checks: readonly GuardCheck[]) {
  const methods = checks.map(check => `  ${METHODS[check]},\n`).join('')
  const head = `export default {\n  name: 'g',\n  requires: ${JSON.stringify(requires)},\n`
  return { 'guard.ts': `${head}${methods}}\n` }
}

function withCapabilities(
  values: Partial<Record<Capability, boolean>>,
): TargetCapabilities {
  const capabilities = { ...claudeCodeSubprocess.capabilities, ...values }
  return { ...claudeCodeSubprocess, capabilities }
}

function lacking(...missing: Capability[]): TargetCapabilities {
  return withCapabilities(Object.fromEntries(missing.map(c => [c, false])))
}

// 记录宿主模块收到的 TargetPlan
function recordingHost(plans: TargetPlan[]): HostModule {
  return fakeHost(async input => {
    plans.push(...input.plans)
    return {
      ok: true,
      files: [{ path: 'manifest.json', content: '{}\n' }],
      residualRisks: [],
    }
  })
}

function report(outcome: BuildOutcome) {
  assert.equal(outcome.kind, 'done')
  const [entry] = (outcome as Extract<BuildOutcome, { kind: 'done' }>).report.targets
  assert.ok(entry !== undefined)
  return entry
}

const ALL: readonly GuardCheck[] = ['beforeTool', 'beforePrompt', 'beforeStop']
const withGuard = { guard: 'guard.ts' }

test('requires 中有目标缺失的能力时该目标失败，不调用宿主模块', async () => {
  const plans: TargetPlan[] = []
  await buildIn(
    guardFile(['promptGate'], ALL),
    deps(recordingHost(plans), lacking('promptGate')),
    async (_root, outcome) => {
      const entry = report(outcome)
      assert.equal(entry.status, 'failed')
      assert.deepEqual(entry.errors, [
        '守卫的 requires 声明了 promptGate，本目标缺少该能力',
      ])
      assert.deepEqual(entry.units, [])
      assert.deepEqual(entry.residualRisks, [])
      assert.equal(plans.length, 0)
    },
    withGuard,
  )
})

test('未列入 requires 的缺失能力：rewriteInput 记为降级，stopGate、promptGate 省略检查', async () => {
  const plans: TargetPlan[] = []
  await buildIn(
    guardFile([], ALL),
    deps(recordingHost(plans), {
      ...lacking('rewriteInput', 'promptGate', 'stopGate'),
      hookTimeoutSeconds: null,
    }),
    async (_root, outcome) => {
      const entry = report(outcome)
      assert.equal(entry.status, 'ok')
      assert.deepEqual(plans[0]?.checks, ['beforeTool'])
      assert.deepEqual(entry.degraded, [
        {
          decision: 'rewrite',
          as: 'deny',
          reason: '本目标不能改写入参，rewrite 按 fallbackReason 拒绝',
        },
      ])
      // 顺序：入口无法启动、省略的检查、未写超时（构建报告文档 residualRisks）
      assert.deepEqual(entry.residualRisks, [
        '缺少 Node ≥ 22 或入口无法启动时，执行前检查不生效（宿主在 hook 出错时放行）',
        '本目标缺少 promptGate，未生成提示提交前检查的 hook：提示不受检查',
        '本目标缺少 stopGate，未生成停机前检查的 hook：停机不受检查',
        'hooks 配置未写超时，沿用宿主默认超时 600 秒',
      ])
    },
    withGuard,
  )
})

test('目标具备全部能力且写超时时检查按守卫实现的方法生成，不记降级与超时风险', async () => {
  const plans: TargetPlan[] = []
  const all = withCapabilities({})
  await buildIn(
    guardFile(['rewriteInput', 'stopGate'], ALL),
    deps(recordingHost(plans), all),
    async (_root, outcome) => {
      const entry = report(outcome)
      assert.deepEqual(plans[0]?.checks, ALL)
      assert.deepEqual(entry.degraded, [])
      assert.equal(claudeCodeSubprocess.hookTimeoutSeconds, 30)
      assert.equal(entry.residualRisks.length, 3)
      assert.ok(entry.residualRisks.every(risk => risk.startsWith('缺少 Node ≥ 22')))
    },
    withGuard,
  )
})

test('检查全部被省略时 TargetPlan.checks 为空，不写入口与超时的残余风险', async () => {
  const plans: TargetPlan[] = []
  await buildIn(
    guardFile([], ['beforeStop']),
    deps(recordingHost(plans), lacking('stopGate')),
    async (_root, outcome) => {
      const entry = report(outcome)
      assert.deepEqual(plans[0]?.checks, [])
      assert.deepEqual(entry.residualRisks, [
        '本目标缺少 stopGate，未生成停机前检查的 hook：停机不受检查',
      ])
    },
    withGuard,
  )
})

test('执行后检查：requires 含缺失的 withholdOutput 或 replaceOutput 时目标失败', async () => {
  for (const capability of ['withholdOutput', 'replaceOutput'] as const) {
    const plans: TargetPlan[] = []
    await buildIn(
      guardFile([capability], ['afterTool']),
      deps(recordingHost(plans), lacking(capability)),
      async (_root, outcome) => {
        const entry = report(outcome)
        assert.equal(entry.status, 'failed')
        assert.deepEqual(entry.errors, [
          `守卫的 requires 声明了 ${capability}，本目标缺少该能力`,
        ])
        assert.equal(plans.length, 0)
      },
      withGuard,
    )
  }
})

test('执行后检查：未列入 requires 的 withholdOutput 缺失时省略检查，不记 replace 的降级', async () => {
  const plans: TargetPlan[] = []
  await buildIn(
    guardFile([], ['beforeTool', 'afterTool']),
    deps(recordingHost(plans), lacking('withholdOutput', 'replaceOutput')),
    async (_root, outcome) => {
      const entry = report(outcome)
      assert.equal(entry.status, 'ok')
      assert.deepEqual(plans[0]?.checks, ['beforeTool'])
      assert.deepEqual(entry.degraded, [])
      assert.deepEqual(entry.residualRisks, [
        '缺少 Node ≥ 22 或入口无法启动时，执行前检查不生效（宿主在 hook 出错时放行）',
        '本目标缺少 withholdOutput，未生成执行后检查的 hook：执行后检查不生效，' +
          '模型能读到原始输出',
      ])
    },
    withGuard,
  )
})

test('执行后检查：未列入 requires 的 replaceOutput 缺失时 replace 记为按扣留写出的降级', async () => {
  const plans: TargetPlan[] = []
  await buildIn(
    guardFile(['withholdOutput'], ['afterTool']),
    deps(recordingHost(plans), lacking('replaceOutput')),
    async (_root, outcome) => {
      const entry = report(outcome)
      assert.equal(entry.status, 'ok')
      assert.deepEqual(plans[0]?.checks, ['afterTool'])
      assert.deepEqual(entry.degraded, [
        {
          decision: 'replace',
          as: 'withhold',
          reason: '本目标不能替换输出，replace 的 text 作为扣留说明写出',
        },
      ])
      assert.deepEqual(entry.residualRisks, [
        '缺少 Node ≥ 22 或入口无法启动时，执行后检查不生效（宿主在 hook 出错时放行）',
      ])
    },
    withGuard,
  )
})

test('执行后检查：目标具备两项能力时生成检查，不记降级', async () => {
  const plans: TargetPlan[] = []
  await buildIn(
    guardFile(['replaceOutput', 'withholdOutput'], [...ALL, 'afterTool']),
    deps(recordingHost(plans), withCapabilities({})),
    async (_root, outcome) => {
      const entry = report(outcome)
      assert.deepEqual(plans[0]?.checks, [...ALL, 'afterTool'])
      assert.deepEqual(entry.degraded, [])
    },
    withGuard,
  )
})

function verifying(verify: (dir: string) => Promise<VerifyResult>, dirs: string[]) {
  return fakeHost(writesManifest.generate, async dir => {
    dirs.push(dir)
    return verify(dir)
  })
}

test('写出后以插件目录的绝对路径调用一次 verify，结果写入 hostValidation', async () => {
  const results: VerifyResult[] = [
    { status: 'passed' },
    { status: 'skipped', reason: 'PATH 中没有 claude' },
  ]
  for (const result of results) {
    const dirs: string[] = []
    await buildIn(
      {},
      deps(verifying(async () => result, dirs)),
      async (root, outcome) => {
        const entry = report(outcome)
        assert.equal(entry.status, 'ok')
        assert.equal(entry.hostValidation, result.status)
        assert.deepEqual(dirs, [join(root, 'dist/claude-code')])
      },
    )
  }
})

test('verify 失败或抛错时该宿主的目标失败，已写出的文件保留', async () => {
  const cases: [() => Promise<VerifyResult>, string[]][] = [
    [
      async () => ({ status: 'failed', errors: ['校验输出 1', '校验输出 2'] }),
      ['校验输出 1', '校验输出 2'],
    ],
    [
      async () => {
        throw new Error('无法启动校验命令')
      },
      ['无法启动校验命令'],
    ],
  ]
  for (const [verify, errors] of cases) {
    await buildIn({}, deps(verifying(verify, [])), async (root, outcome) => {
      const entry = report(outcome)
      assert.equal(entry.status, 'failed')
      assert.deepEqual(entry.errors, errors)
      assert.equal(entry.hostValidation, 'failed')
      assert.deepEqual(entry.units, [{ kind: 'plugin', path: 'dist/claude-code' }])
      const written = await readFile(
        join(root, 'dist/claude-code/manifest.json'),
        'utf8',
      )
      assert.equal(written, '{}\n')
    })
  }
})

test('宿主未写出文件时不调用 verify，hostValidation 为 none', async () => {
  const dirs: string[] = []
  const failing = fakeHost(
    async () => ({ ok: false, errors: [{ target: TARGET, message: '名称不合规' }] }),
    async dir => {
      dirs.push(dir)
      return { status: 'passed' }
    },
  )
  await buildIn({}, deps(failing), async (_root, outcome) => {
    assert.equal(report(outcome).hostValidation, 'none')
    assert.deepEqual(dirs, [])
  })
})
