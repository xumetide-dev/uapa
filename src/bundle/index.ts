// 打包入口（入口与打包接口第 1 节，F-04-06、F-04-07）：把守卫逻辑（uapa:guard）、目标数据
// （uapa:target-data）、runtime/core 与请求的入口打包为 ES2022 ESM 单文件，只在内存中返回。
import { isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type Plugin, rolldown } from 'rolldown'
import { GUARD_CHECKS } from '../runtime/core/types.ts'
import type { BundleRequest } from './types.ts'

const TARGET_DATA_ID = '\0uapa:target-data'

// bundle-names.d.ts 中声明、打包时替换的标识符
const BUNDLE_NAMES = [
  '__UAPA_PLUGIN_NAME__',
  '__UAPA_MODULE_SESSION_ENV__',
  '__UAPA_CHECKS__',
]

// 源码运行时本文件为 .ts，dist/ 中为编译后的 .js；入口与本文件的扩展名相同
const EXTENSION = import.meta.url.endsWith('.ts') ? '.ts' : '.js'

const ALLOWED: Readonly<
  Record<BundleRequest['external'], { test(id: string): boolean; label: string }>
> = {
  node: { test: id => id.startsWith('node:'), label: 'node: 内置模块' },
  'claude-code': { test: id => id === 'claude-code', label: "'claude-code'" },
}

// 入口名相对 src/runtime/entries/（或 dist/ 中的对应目录）；测试可传绝对路径
export function entryPath(entry: string): string {
  if (isAbsolute(entry)) return entry
  const url = new URL(`../runtime/entries/${entry}${EXTENSION}`, import.meta.url)
  return fileURLToPath(url)
}

function virtualModules(request: BundleRequest): Plugin {
  return {
    name: 'uapa-virtual-modules',
    resolveId(source) {
      if (source === 'uapa:guard') return request.guardModule
      if (source === 'uapa:target-data') return TARGET_DATA_ID
      return null
    },
    load(id) {
      if (id !== TARGET_DATA_ID) return null
      return `export default ${JSON.stringify(request.data)}\n`
    },
  }
}

// hooks 模块入口的检查开关（BundleRequest）：常量条件的分支由打包器移除
function checkDefines(request: BundleRequest): Record<string, string> {
  if (request.external !== 'claude-code') return {}
  const checks: readonly string[] = request.checks
  return Object.fromEntries(
    GUARD_CHECKS.map(check => [
      `__UAPA_CHECKS__.${check}`,
      JSON.stringify(checks.includes(check)),
    ]),
  )
}

export async function bundle(request: BundleRequest): Promise<string> {
  const allowed = ALLOWED[request.external]
  const build = await rolldown({
    input: entryPath(request.entry),
    // hooks 模块运行在没有 Node 的环境中，node: 导入不视为内置模块，由下方检查拒绝
    platform: request.external === 'node' ? 'node' : 'neutral',
    external: id => allowed.test(id),
    plugins: [virtualModules(request)],
    transform: {
      target: 'es2022',
      define: {
        __UAPA_PLUGIN_NAME__: JSON.stringify(request.data.pluginName),
        __UAPA_MODULE_SESSION_ENV__: JSON.stringify(request.data.moduleSessionEnv),
        ...checkDefines(request),
      },
    },
    // 不写 //#region 注释：注释含模块路径，产物须与本机路径无关
    experimental: { attachDebugInfo: 'none' },
    // 警告不写到构建器的终端输出；无法解析的导入保留为外部导入，由下方检查拒绝
    onLog: () => {},
  })
  try {
    const { output } = await build.generate({
      format: 'esm',
      comments: false,
      codeSplitting: false,
    })
    const [chunk, ...rest] = output
    if (chunk === undefined || chunk.type !== 'chunk' || rest.length > 0) {
      throw new Error('打包结果不是单个文件')
    }
    const imports = [...chunk.imports, ...chunk.dynamicImports]
    const disallowed = [...new Set(imports.filter(id => !allowed.test(id)))].sort()
    if (disallowed.length > 0) {
      throw new Error(
        `打包结果含不允许的外部导入：${disallowed.join('、')}（只允许 ${allowed.label}）`,
      )
    }
    // 未替换的打包时名称（如 __UAPA_CHECKS__[name] 这类写法）在宿主中是未定义的标识符
    const left = BUNDLE_NAMES.filter(name => chunk.code.includes(name))
    if (left.length > 0) {
      throw new Error(`打包结果含未替换的打包时名称：${left.join('、')}`)
    }
    return chunk.code
  } finally {
    await build.close()
  }
}
