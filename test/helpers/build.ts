// 构建编排测试的公共部分：测试用的宿主模块、能力数据与临时源项目中的一次构建
import type { BuildOutcome } from '../../src/build/index.ts'
import { type BuildDeps, runBuild } from '../../src/build/run.ts'
import { agySubprocess } from '../../src/capabilities/agy-subprocess.ts'
import { claudeCodeSubprocess } from '../../src/capabilities/claude-code-subprocess.ts'
import type { TargetCapabilities } from '../../src/capabilities/types.ts'
import type { UapaConfig } from '../../src/config/types.ts'
import { agy } from '../../src/targets/agy/index.ts'
import type { HostModule } from '../../src/targets/types.ts'
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

// agy 默认为真实宿主模块与能力数据；只配置 claude-code 目标的用例不会调用它
export function deps(
  host: HostModule = writesManifest,
  capabilities: TargetCapabilities = claudeCodeSubprocess,
  agyHost: HostModule = agy,
): BuildDeps {
  return {
    hostModules: { 'claude-code': host, agy: agyHost },
    targetCapabilities: { [TARGET]: capabilities, 'agy:subprocess': agySubprocess },
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
