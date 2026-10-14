// 写出产物：默认布局（F-03-05）与放置 skills（F-03-04）。
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { resolvePluginDirs } from '../config/layout.ts'
import { displayPath } from '../config/paths.ts'
import { type HostName, hostOf } from '../config/targets.ts'
import type { UapaConfig } from '../config/types.ts'
import type { Skill } from '../source/types.ts'
import type { OutputFile } from '../targets/types.ts'
import { succeeded, type TargetState } from './state.ts'

export async function writeOutputs(
  config: UapaConfig,
  root: string,
  states: readonly TargetState[],
  hostFiles: ReadonlyMap<HostName, readonly OutputFile[]>,
): Promise<void> {
  for (const dir of resolvePluginDirs(config, root)) {
    const written = states.filter(
      state => dir.hosts.includes(hostOf(state.target)) && succeeded(state),
    )
    // 该目录的目标全部失败时目录保持原状
    if (written.length === 0) continue
    // 合并布局不清空目录，在 F-03-06 中实现；此前不得按默认布局清空
    if (dir.hosts.length > 1) throw new Error('合并布局尚未实现（F-03-06）')
    await rm(dir.path, { recursive: true, force: true })
    await mkdir(dir.path, { recursive: true })
    for (const host of dir.hosts) {
      for (const file of hostFiles.get(host) ?? []) await writeOutput(dir.path, file)
    }
    await placeSkills(root, dir.path, written)
    for (const state of written) state.unit = displayPath(root, dir.path)
  }
}

async function writeOutput(dir: string, file: OutputFile): Promise<void> {
  const segments = file.path.split('/')
  const valid =
    file.path !== '' &&
    !file.path.startsWith('/') &&
    !file.path.includes('\\') &&
    !segments.includes('..')
  if (!valid) throw new Error(`宿主模块返回了无效的文件路径：${file.path}`)
  const target = join(dir, ...segments)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, file.content)
}

// 复制写入该目录的成功目标所适用 skill 的并集；
// 同目录中不适用该 skill 的目标记为残余风险
async function placeSkills(
  root: string,
  dir: string,
  states: readonly TargetState[],
): Promise<void> {
  const union = new Map<string, Skill>()
  for (const state of states) {
    for (const skill of state.plan?.skills ?? []) union.set(skill.name, skill)
  }
  const names = [...union.keys()].sort()
  for (const name of names) {
    const skill = union.get(name) as Skill
    for (const file of skill.files) {
      const target = join(dir, 'skills', name, ...file.split('/'))
      await mkdir(dirname(target), { recursive: true })
      await copyFile(join(root, skill.dir, ...file.split('/')), target)
    }
  }
  for (const state of states) {
    const own = new Set(state.plan?.skills.map(skill => skill.name))
    for (const name of names.filter(n => !own.has(n))) {
      state.sharedSkillRisks.push(
        `skill ${name} 不适用于本目标，但与其他目标共用插件目录，宿主仍会加载`,
      )
    }
  }
}
