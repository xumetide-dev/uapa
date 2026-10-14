#!/usr/bin/env node
// 功能清单关系检查：读取 docs/feature-list/ 下的 Markdown 表格，核对编号、依赖与承接关系。
// 发现问题时逐条输出并以退出码 1 结束；全部通过时输出各模块的功能数。
//
//   node scripts/check-feature-list.mjs

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../docs/feature-list/', import.meta.url))
const PHASES = ['v0.1.0', 'v0.2.0']
const FEATURE_ID = /^F-(\d{2})-\d{2}$/
const problems = []

// 读取文件中表头以 headerPrefix 开头的表格，返回以表头为键的行对象。
// 同一文件可有多张首列相同的表（如角色表与故事表），因此按表头前几列定位。
function readTable(file, headerPrefix) {
  const lines = readFileSync(file, 'utf8').split('\n')
  const start = lines.findIndex(line => line.startsWith(headerPrefix))
  if (start < 0) throw new Error(`${file}: 找不到表头为「${headerPrefix}」的表格`)
  const cells = line => line.slice(1, -1).split(' | ').map(cell => cell.trim())
  const header = cells(lines[start])
  const rows = []
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith('|')) break
    const values = cells(line)
    if (values.length !== header.length) {
      problems.push(`${file}: 列数不符：${line.slice(0, 40)}`)
    }
    rows.push(Object.fromEntries(header.map((name, i) => [name, values[i] ?? ''])))
  }
  return rows
}

// 依赖与引用列以逗号分隔；无依赖写「—」
const splitIds = text =>
  text === '—' || text === '' ? [] : text.split(',').map(id => id.trim())

// 功能：每个模块文件一张表，文件名前两位是模块编号
const features = new Map()
for (const name of readdirSync(join(ROOT, 'modules')).sort()) {
  const moduleNumber = name.slice(0, 2)
  for (const row of readTable(join(ROOT, 'modules', name), '| 编号 | 阶段 |')) {
    const id = row['编号']
    const match = FEATURE_ID.exec(id)
    if (!match) problems.push(`${id}: 编号格式应为 F-XX-NN`)
    else if (match[1] !== moduleNumber) problems.push(`${id}: 编号与模块文件 ${name} 不符`)
    if (features.has(id)) problems.push(`${id}: 编号重复`)
    if (!PHASES.includes(row['阶段'])) problems.push(`${id}: 未知阶段「${row['阶段']}」`)
    for (const column of ['子模块', '功能名称', '验收标准']) {
      if (!row[column]) problems.push(`${id}: ${column}为空`)
    }
    features.set(id, { ...row, module: name, deps: splitIds(row['依赖']) })
  }
}

const phaseRank = id => PHASES.indexOf(features.get(id)?.['阶段'])

// 依赖：必须存在、不得指向更晚的阶段、不得成环
for (const [id, feature] of features) {
  for (const dep of feature.deps) {
    if (!features.has(dep)) problems.push(`${id}: 依赖 ${dep} 不存在`)
    else if (phaseRank(dep) > phaseRank(id)) problems.push(`${id}: 依赖更晚阶段的 ${dep}`)
  }
}
const visiting = new Set()
const done = new Set()
function visit(id, path) {
  if (done.has(id) || !features.has(id)) return
  if (visiting.has(id)) {
    problems.push(`依赖成环：${[...path, id].join(' → ')}`)
    return
  }
  visiting.add(id)
  for (const dep of features.get(id).deps) visit(dep, [...path, id])
  visiting.delete(id)
  done.add(id)
}
for (const id of features.keys()) visit(id, [])

// 承接：故事与技术验收引用的功能必须存在；每个功能至少被承接一次
const covered = new Set()
const storiesFile = join(ROOT, 'stories.md')
const personas = new Set(
  readTable(storiesFile, '| 编号 | 角色 | 目标 |').map(row => row['编号']),
)
const stories = readTable(storiesFile, '| 编号 | 角色 | 阶段 |')
for (const story of stories) {
  const id = story['编号']
  if (!personas.has(story['角色'])) problems.push(`${id}: 角色 ${story['角色']} 不存在`)
  if (!PHASES.includes(story['阶段'])) problems.push(`${id}: 未知阶段「${story['阶段']}」`)
  for (const ref of splitIds(story['功能'])) {
    if (!features.has(ref)) problems.push(`${id}: 引用的 ${ref} 不存在`)
    else if (phaseRank(ref) > PHASES.indexOf(story['阶段'])) {
      problems.push(`${id}: 引用更晚阶段的 ${ref}`)
    }
    covered.add(ref)
  }
}
const checks = readTable(join(ROOT, 'technical-acceptance.md'), '| 编号 | 名称 |')
for (const check of checks) {
  for (const ref of splitIds(check['功能'])) {
    if (!features.has(ref)) problems.push(`${check['编号']}: 引用的 ${ref} 不存在`)
    covered.add(ref)
  }
}
for (const id of features.keys()) {
  if (!covered.has(id)) problems.push(`${id}: 没有被用户故事或技术验收承接`)
}

if (problems.length) {
  for (const problem of problems) console.error(problem)
  console.error(`✗ ${problems.length} 处问题`)
  process.exitCode = 1
} else {
  const counts = {}
  for (const feature of features.values()) {
    const key = `${feature.module} ${feature['阶段']}`
    counts[key] = (counts[key] ?? 0) + 1
  }
  for (const [key, count] of Object.entries(counts)) console.log(`${key}: ${count}`)
  console.log(
    `✓ ${features.size} 个功能，${stories.length} 条用户故事，` +
      `${checks.length} 项技术验收，关系检查通过`,
  )
}
