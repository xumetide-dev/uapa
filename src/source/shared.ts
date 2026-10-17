// 读取共用文件（F-01-12，SD-37）：递归列出 files/ 下的文件，不读取内容，不复制；复制由构建编排
// 完成（构建产物「写出与比对」）。
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { failed, type InputIssue, type Loaded, loaded } from '../config/issues.ts'
import { listFiles, orMissing } from './files.ts'

export const SHARED_DIR = 'files'

// 相对 files/、POSIX 分隔、按字典序；没有 files/ 时为空列表，不是目录时失败
export async function readSharedFiles(root: string): Promise<Loaded<string[]>> {
  const dir = join(root, SHARED_DIR)
  const info = await orMissing(stat(dir))
  if (info === null) return loaded([])
  if (!info.isDirectory()) {
    return failed([
      { file: SHARED_DIR, field: null, message: `${SHARED_DIR} 应为目录` },
    ])
  }
  const issues: InputIssue[] = []
  const files = await listFiles(dir, SHARED_DIR, issues)
  return issues.length > 0 ? failed(issues) : loaded(files)
}
