// 测试用的临时源项目：按路径 → 内容写入文件，
// 返回真实路径（与 Node 报告的模块路径一致）。
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

export interface TempProject {
  readonly root: string
  cleanup(): Promise<void>
}

export async function tempProject(files: Record<string, string>): Promise<TempProject> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'uapa-test-')))
  for (const [path, content] of Object.entries(files)) {
    const target = join(root, ...path.split('/'))
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, content)
  }
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) }
}

// 合法的最小配置，测试按需覆盖字段
export const baseConfig = {
  name: 'demo',
  version: '0.1.0',
  description: '测试用插件',
  author: { name: 'Tester' },
  targets: ['claude-code:subprocess'],
} as const
