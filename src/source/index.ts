// 读取源项目（F-01-04～F-01-06）。只读，不写文件。
import type { Loaded } from '../config/issues.ts'
import type { UapaConfig } from '../config/types.ts'
import { readOverrides } from './overrides.ts'
import { readSkills } from './skills.ts'
import type { SourceProject } from './types.ts'

export { readGuard } from './guard.ts'

export async function readSource(
  config: UapaConfig,
  root: string,
): Promise<Loaded<SourceProject>> {
  const skills = await readSkills(root)
  const overrides = await readOverrides(config, root)
  if (!skills.ok || !overrides.ok) {
    const issues = [
      ...(skills.ok ? [] : skills.issues),
      ...(overrides.ok ? [] : overrides.issues),
    ]
    return { ok: false, issues }
  }
  return { ok: true, value: { root, skills: skills.value, overrides: overrides.value } }
}
