// 构建编排测试的公共部分：测试用的宿主模块、能力数据与临时源项目中的一次构建
import type { BuildOutcome } from '../../src/build/index.ts'
import { type BuildDeps, runBuild } from '../../src/build/run.ts'
import { agySubprocess } from '../../src/capabilities/agy-subprocess.ts'
import { claudeCodeSubprocess } from '../../src/capabilities/claude-code-subprocess.ts'
import { codexSubprocess } from '../../src/capabilities/codex-subprocess.ts'
import type { TargetCapabilities } from '../../src/capabilities/types.ts'
import type { HostName } from '../../src/config/targets.ts'
import type { UapaConfig } from '../../src/config/types.ts'
import { agy } from '../../src/targets/agy/index.ts'
import { codex } from '../../src/targets/codex/index.ts'
import type { HostModule, OutputFile } from '../../src/targets/types.ts'
import { baseConfig, tempProject } from './project.ts'

export const TARGET = 'claude-code:subprocess'
export const SKILL = (extra = '') => `---\nname: review\ndescription: d\n${extra}---\n`

export function fakeHost(
  generate: HostModule['generate'],
  verify?: HostModule['verify'],
): HostModule {
  return verify === undefined
    ? { host: 'claude-code', generate }
    : { host: 'claude-code', generate, verify }
}

export const writesManifest = fakeHost(async () => ({
  ok: true,
  files: [{ path: 'manifest.json', content: '{}\n' }],
  residualRisks: [{ target: TARGET, message: '宿主模块给出的风险' }],
}))

// codex 与 agy 为真实宿主模块与能力数据；只配置 claude-code 目标的用例不会调用它们
export function deps(
  host: HostModule = writesManifest,
  capabilities: TargetCapabilities = claudeCodeSubprocess,
  agyHost: HostModule = agy,
): BuildDeps {
  return {
    hostModules: { 'claude-code': host, codex, agy: agyHost },
    targetCapabilities: {
      [TARGET]: capabilities,
      'codex:subprocess': codexSubprocess,
      'agy:subprocess': agySubprocess,
    },
    bundle: async () => {
      throw new Error('测试中不打包')
    },
  }
}

export async function buildIn(
  files: Record<string, string>,
  buildDeps: BuildDeps,
  inspect: (root: string, outcome: BuildOutcome) => Promise<void>,
  config: Partial<UapaConfig> = {},
): Promise<void> {
  const project = await tempProject(files)
  try {
    const outcome = await runBuild(
      { ...baseConfig, ...config } as UapaConfig,
      project.root,
      { check: false },
      buildDeps,
    )
    await inspect(project.root, outcome)
  } finally {
    await project.cleanup()
  }
}

// 只返回给定文件的宿主模块，不读取输入
export function returning(host: HostName, files: readonly OutputFile[]): HostModule {
  return { host, generate: async () => ({ ok: true, files, residualRisks: [] }) }
}

// 三个宿主都换成测试用的宿主模块，能力数据取真实数据
export function hostDeps(modules: Readonly<Record<HostName, HostModule>>): BuildDeps {
  return { ...deps(), hostModules: modules }
}

// 在已有的源项目中构建一次；check 为 true 时只比对
export function buildAt(
  root: string,
  buildDeps: BuildDeps,
  config: Partial<UapaConfig>,
  options: { readonly check: boolean } = { check: false },
): Promise<BuildOutcome> {
  return runBuild({ ...baseConfig, ...config } as UapaConfig, root, options, buildDeps)
}
