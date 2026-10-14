// 读取源项目（F-01-04、F-01-05）。只读，不写文件；
// 覆盖目录 overrides/<宿主>/ 由 F-01-06 读取。
import type { Loaded } from '../config/issues.ts'
import type { UapaConfig } from '../config/types.ts'
import { readSkills } from './skills.ts'
import type { SourceProject } from './types.ts'

export { readGuard } from './guard.ts'

export async function readSource(
  _config: UapaConfig,
  root: string,
): Promise<Loaded<SourceProject>> {
  const skills = await readSkills(root)
  if (!skills.ok) return skills
  return { ok: true, value: { root, skills: skills.value, overrides: {} } }
}
