// 组件 frontmatter 的读取（F-01-04、F-01-07、F-01-10、F-01-11）与其中的目标限定（F-01-05）：
// 各组件共用。
import { parse } from 'yaml'
import { failed, type InputIssue, type Loaded, loaded } from '../config/issues.ts'
import { isTargetName, type TargetName } from '../config/targets.ts'

// frontmatter 为文件开头两行 `---` 之间的 YAML 映射
export function readFrontmatter(
  text: string,
  file: string,
): Loaded<Record<string, unknown>> {
  const lines = text.split(/\r?\n/)
  const end = lines[0] === '---' ? lines.indexOf('---', 1) : -1
  if (end < 0) {
    return failed([{ file, field: null, message: '缺少以 --- 包围的 frontmatter' }])
  }
  let value: unknown
  try {
    value = parse(lines.slice(1, end).join('\n'))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return failed([
      { file, field: null, message: `frontmatter 不是有效的 YAML：${message}` },
    ])
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return failed([{ file, field: null, message: 'frontmatter 应为映射' }])
  }
  return loaded(value as Record<string, unknown>)
}

// frontmatter 与其后的正文（rules，F-01-10）：正文为结束行 `---` 之后的原文，换行符不变
export function readFrontmatterAndBody(
  text: string,
  file: string,
): Loaded<{ readonly meta: Record<string, unknown>; readonly body: string }> {
  const meta = readFrontmatter(text, file)
  if (!meta.ok) return meta
  return loaded({ meta: meta.value, body: text.slice(bodyStart(text)) })
}

// 结束行之后第一个字符的位置。按与 readFrontmatter 相同的方式分行（\r?\n），从第二行起找第一个
// 等于 `---` 的行；调用前 readFrontmatter 已确认该行存在，它是最后一行且没有换行符时为文本末尾
function bodyStart(text: string): number {
  let lineStart = 0
  let lineIndex = 0
  for (const match of text.matchAll(/\r?\n/g)) {
    const lineEnd = match.index
    const next = lineEnd + match[0].length
    if (lineIndex > 0 && text.slice(lineStart, lineEnd) === '---') return next
    lineStart = next
    lineIndex += 1
  }
  return text.length
}

// 未写 targets 时为 null（适用于全部目标）；写了就必须是非空的已登记目标名列表
export function readTargets(
  value: unknown,
  file: string,
  issues: InputIssue[],
): readonly TargetName[] | null {
  if (value === undefined) return null
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ file, field: 'targets', message: '应为非空的目标名列表' })
    return null
  }
  value.forEach((target, index) => {
    if (!isTargetName(target)) {
      const shown = JSON.stringify(target)
      issues.push({ file, field: `targets[${index}]`, message: `未知目标名 ${shown}` })
    }
  })
  return value.filter(isTargetName)
}
