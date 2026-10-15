// 读取覆盖目录（F-01-06）：列出 overrides/<宿主>/ 下的文件，不复制。目录名不是 targets 中已配置
// 的宿主时为输入错误；overrides/ 下不是目录的项（如说明文件）忽略。
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { failed, type InputIssue, type Loaded, loaded } from '../config/issues.ts'
import { configuredHosts } from '../config/layout.ts'
import type { HostName } from '../config/targets.ts'
import type { UapaConfig } from '../config/types.ts'
import { compare, listFiles, orMissing } from './files.ts'
import type { SourceProject } from './types.ts'

export const OVERRIDES_DIR = 'overrides'

export async function readOverrides(
  config: UapaConfig,
  root: string,
): Promise<Loaded<SourceProject['overrides']>> {
  const dir = join(root, OVERRIDES_DIR)
  const info = await orMissing(stat(dir))
  if (info === null) return loaded({})
  if (!info.isDirectory()) {
    return failed([{ file: OVERRIDES_DIR, field: null, message: 'overrides 应为目录' }])
  }
  const hosts = configuredHosts(config)
  const entries = await readdir(dir, { withFileTypes: true })
  const names = entries.filter(e => e.isDirectory()).map(e => e.name)
  const overrides: Partial<Record<HostName, readonly string[]>> = {}
  const issues: InputIssue[] = []
  for (const name of names.sort(compare)) {
    const file = `${OVERRIDES_DIR}/${name}`
    const host = hosts.find(h => h === name)
    if (host === undefined) {
      const shown = hosts.join('、')
      issues.push({
        file,
        field: null,
        message: `不是已配置的宿主（已配置：${shown}）`,
      })
      continue
    }
    overrides[host] = await listFiles(join(dir, name), file, issues)
  }
  return issues.length > 0 ? failed(issues) : loaded(overrides)
}
