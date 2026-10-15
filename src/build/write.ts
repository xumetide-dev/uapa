// 写出计划的文件集合（模块接口 §8）：默认布局先清空插件目录（F-03-05）；合并布局只写入计划的
// 文件，不删除目录中的其他文件（F-03-06）。
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { displayPath } from '../config/paths.ts'
import type { DirOutput, PlannedFile } from './outputs.ts'

export async function writeOutputs(
  root: string,
  outputs: readonly DirOutput[],
): Promise<void> {
  for (const output of outputs) {
    const dir = output.dir.path
    if (!output.merged) {
      await rm(dir, { recursive: true, force: true })
      await mkdir(dir, { recursive: true })
    }
    for (const file of output.files) await writeOutput(dir, file)
    for (const state of output.targets) state.unit = displayPath(root, dir)
  }
}

// 复制的源文件以 copyFile 写出，保留文件权限（如 skill 中的可执行脚本）
async function writeOutput(dir: string, file: PlannedFile): Promise<void> {
  const target = join(dir, ...file.path.split('/'))
  await mkdir(dirname(target), { recursive: true })
  if (file.copyFrom === null) await writeFile(target, file.content)
  else await copyFile(file.copyFrom, target)
}
