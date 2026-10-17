// 读取 commands（F-01-11，SD-33）：commands/ 下一层的 <name>.md 与 frontmatter。
// 只校验 description 与 targets；其他键留在文件中原样复制，各宿主自行解释。
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { failed, type InputIssue, type Loaded, loaded } from '../config/issues.ts'
import { compare, listMarkdownFiles } from './files.ts'
import { readFrontmatterAndBody, readTargets } from './frontmatter.ts'
import type { Command } from './types.ts'

const EXTENSION = '.md'
const COMPONENT_NAME = /^[A-Za-z0-9_-]+$/

export async function readCommands(root: string): Promise<Loaded<readonly Command[]>> {
  const fileNames = await listMarkdownFiles(root, 'commands')
  if (!fileNames.ok) return fileNames
  const commands: Command[] = []
  const issues: InputIssue[] = []
  for (const fileName of fileNames.value) {
    const result = await readCommand(root, fileName)
    if (result.ok) commands.push(result.value)
    else issues.push(...result.issues)
  }
  if (issues.length > 0) return failed(issues)
  return loaded(commands.sort((a, b) => compare(a.name, b.name)))
}

async function readCommand(root: string, fileName: string): Promise<Loaded<Command>> {
  const path = `commands/${fileName}`
  const name = fileName.slice(0, -EXTENSION.length)
  if (!COMPONENT_NAME.test(name)) {
    return failed([
      { file: path, field: null, message: '文件名只能含字母、数字、_、-' },
    ])
  }
  const parsed = readFrontmatterAndBody(await readFile(join(root, path), 'utf8'), path)
  if (!parsed.ok) return parsed
  const { meta, body } = parsed.value
  const issues: InputIssue[] = []
  const description = meta.description
  if (typeof description !== 'string' || description.trim() === '') {
    issues.push({ file: path, field: 'description', message: '应为非空字符串' })
  }
  const targets = readTargets(meta.targets, path, issues)
  // description 不是字符串时已记入 issues；第二个条件只用于类型收窄
  if (issues.length > 0 || typeof description !== 'string') return failed(issues)
  return loaded({ name, path, description, body, targets })
}
