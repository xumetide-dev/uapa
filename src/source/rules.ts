// 读取 rules（F-01-10，SD-32）：rules/ 下一层的 <name>.md、frontmatter 与正文。
// frontmatter 只允许下列四个键：宿主模块按自身格式重写 frontmatter，未知键会被静默丢弃，
// 因此一律拒绝。
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { failed, type InputIssue, type Loaded, loaded } from '../config/issues.ts'
import { compare, listMarkdownFiles } from './files.ts'
import { readFrontmatterAndBody, readTargets } from './frontmatter.ts'
import type { Rule, RuleActivation } from './types.ts'

const EXTENSION = '.md'
const COMPONENT_NAME = /^[A-Za-z0-9_-]+$/
const ALLOWED_KEYS = ['activation', 'description', 'globs', 'targets']
const ACTIVATIONS: readonly RuleActivation[] = ['always', 'model', 'glob']

export async function readRules(root: string): Promise<Loaded<readonly Rule[]>> {
  const fileNames = await listMarkdownFiles(root, 'rules')
  if (!fileNames.ok) return fileNames
  const rules: Rule[] = []
  const issues: InputIssue[] = []
  for (const fileName of fileNames.value) {
    const result = await readRule(root, fileName)
    if (result.ok) rules.push(result.value)
    else issues.push(...result.issues)
  }
  if (issues.length > 0) return failed(issues)
  return loaded(rules.sort((a, b) => compare(a.name, b.name)))
}

async function readRule(root: string, fileName: string): Promise<Loaded<Rule>> {
  const path = `rules/${fileName}`
  const name = fileName.slice(0, -EXTENSION.length)
  if (!COMPONENT_NAME.test(name)) {
    return failed([
      { file: path, field: null, message: '文件名只能含字母、数字、_、-' },
    ])
  }
  const read = readFrontmatterAndBody(await readFile(join(root, path), 'utf8'), path)
  if (!read.ok) return read
  const { meta, body } = read.value
  const issues: InputIssue[] = []
  for (const key of Object.keys(meta).filter(k => !ALLOWED_KEYS.includes(k))) {
    issues.push({ file: path, field: key, message: '不支持的键' })
  }
  const activation = readActivation(meta.activation, path, issues)
  const description = readDescription(meta.description, activation, path, issues)
  const globs = readGlobs(meta.globs, activation, path, issues)
  const targets = readTargets(meta.targets, path, issues)
  if (issues.length > 0 || activation === null) return failed(issues)
  return loaded({ name, path, activation, description, globs, body, targets })
}

function readActivation(
  value: unknown,
  file: string,
  issues: InputIssue[],
): RuleActivation | null {
  const activation = ACTIVATIONS.find(candidate => candidate === value)
  if (activation !== undefined) return activation
  issues.push({ file, field: 'activation', message: '应为 always、model 或 glob' })
  return null
}

// 出现时为非空单行字符串；activation 为 model 时必填（模型按它决定是否读取）
function readDescription(
  value: unknown,
  activation: RuleActivation | null,
  file: string,
  issues: InputIssue[],
): string | null {
  if (value === undefined) {
    if (activation === 'model') {
      issues.push({ file, field: 'description', message: 'activation 为 model 时必填' })
    }
    return null
  }
  if (!isSingleLine(value)) {
    issues.push({ file, field: 'description', message: '应为非空单行字符串' })
    return null
  }
  return value
}

// activation 为 glob 时为非空字符串数组；宿主以逗号连接多个模式，元素因此不得含 `,` 与换行。
// 其他 activation 不得写 globs
function readGlobs(
  value: unknown,
  activation: RuleActivation | null,
  file: string,
  issues: InputIssue[],
): string[] {
  if (activation !== 'glob') {
    if (value !== undefined && activation !== null) {
      issues.push({ file, field: 'globs', message: 'activation 为 glob 时才能写' })
    }
    return []
  }
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ file, field: 'globs', message: '应为非空的字符串列表' })
    return []
  }
  value.forEach((glob, index) => {
    if (!isSingleLine(glob) || glob.includes(',')) {
      const message = '应为非空单行字符串，且不含 ,'
      issues.push({ file, field: `globs[${index}]`, message })
    }
  })
  return value.filter(isSingleLine)
}

function isSingleLine(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim() !== '' &&
    !value.includes('\n') &&
    !value.includes('\r')
  )
}
