// 加载 uapa.config.ts（F-01-02）：以 Node 类型剥离导入，取默认导出并校验（F-01-03）。
import { basename, dirname } from 'node:path'
import { importModule } from './import.ts'
import { failed, type Loaded } from './issues.ts'
import type { UapaConfig } from './types.ts'
import { validateConfig } from './validate.ts'

// configPath 为绝对路径；配置中的相对路径以它所在的目录为基准
export async function loadConfig(configPath: string): Promise<Loaded<UapaConfig>> {
  const root = dirname(configPath)
  const file = basename(configPath)
  const module = await importModule(configPath, root)
  if (!module.ok) return module
  const value = module.value.default
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return failed([{ file, field: null, message: '默认导出缺失或不是对象' }])
  }
  return validateConfig(value, file, root)
}
