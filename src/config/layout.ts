// 插件目录解析（模块接口 §2，F-01-03）：配置校验与构建编排共用。
import { join, resolve } from 'node:path'
import type { InputIssue } from './issues.ts'
import { displayPath, isInside } from './paths.ts'
import { HOSTS, type HostName, hostOf } from './targets.ts'
import type { UapaConfig } from './types.ts'

export interface PluginDir {
  readonly path: string // 绝对路径
  readonly hosts: readonly HostName[] // 写入该目录的已配置宿主，按 targets.ts 中的顺序
}

const DEFAULT_OUT_DIR = 'dist'

export function outDirOf(config: UapaConfig, root: string): string {
  return resolve(root, config.outDir ?? DEFAULT_OUT_DIR)
}

export function configuredHosts(config: UapaConfig): readonly HostName[] {
  const used = new Set(config.targets.map(hostOf))
  return HOSTS.filter(host => used.has(host))
}

function hostDir(config: UapaConfig, root: string, host: HostName): string {
  const dir = config.hosts?.[host]?.dir
  return dir === undefined ? join(outDirOf(config, root), host) : resolve(root, dir)
}

// 解析为同一路径的宿主合为一个目录；两个以上宿主的目录为合并布局，其余为默认布局
export function resolvePluginDirs(
  config: UapaConfig,
  root: string,
): readonly PluginDir[] {
  const byPath = new Map<string, HostName[]>()
  for (const host of configuredHosts(config)) {
    const path = hostDir(config, root, host)
    const hosts = byPath.get(path) ?? []
    hosts.push(host)
    byPath.set(path, hosts)
  }
  return [...byPath].map(([path, hosts]) => ({ path, hosts }))
}

// 默认布局写入前清空插件目录，因此其目录不得等于或包含源项目根目录、
// outDir 或另一插件目录
export function checkPluginDirs(
  config: UapaConfig,
  root: string,
  file: string,
): InputIssue[] {
  const dirs = resolvePluginDirs(config, root)
  const outDir = outDirOf(config, root)
  const issues: InputIssue[] = []
  for (const dir of dirs) {
    const [host] = dir.hosts
    if (host === undefined || dir.hosts.length > 1) continue
    const field =
      config.hosts?.[host]?.dir === undefined ? 'outDir' : `hosts.${host}.dir`
    const shown = displayPath(root, dir.path)
    const covers = (other: string) => dir.path === other || isInside(dir.path, other)
    const conflicts: string[] = []
    if (covers(root)) conflicts.push('源项目根目录')
    if (covers(outDir)) conflicts.push(`outDir（${displayPath(root, outDir)}）`)
    for (const other of dirs) {
      if (other !== dir && covers(other.path)) {
        conflicts.push(
          `${other.hosts.join('、')} 的插件目录（${displayPath(root, other.path)}）`,
        )
      }
    }
    for (const what of conflicts) {
      issues.push({
        file,
        field,
        message: `${host} 的插件目录 ${shown} 写入前会被清空，不能等于或包含${what}`,
      })
    }
  }
  return issues
}
