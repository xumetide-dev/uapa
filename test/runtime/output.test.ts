// 工具输出的文本形式与替换（F-04-08，入口与打包接口第 4 节）：按形状判断，不改原值
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { outputText, replacedOutput } from '../../src/runtime/core/output.ts'

const bash = { stdout: 'out', stderr: 'err', interrupted: false }
const read = { type: 'text', file: { filePath: 'a.txt', content: '正文', numLines: 1 } }

test('outputText：字符串原样，stdout 接非空 stderr，file.content，其他取 JSON 文本', () => {
  assert.equal(outputText('Exit code: 0\nok'), 'Exit code: 0\nok')
  assert.equal(outputText(bash), 'out\nerr')
  assert.equal(outputText({ ...bash, stderr: '' }), 'out')
  assert.equal(outputText({ stdout: 'out' }), 'out')
  assert.equal(outputText({ stdout: 'out', stderr: 1 }), 'out')
  assert.equal(outputText(read), '正文')
  const mcp = { content: [{ type: 'text', text: 'x' }], isError: false }
  assert.equal(outputText(mcp), JSON.stringify(mcp))
  assert.equal(outputText({ file: { content: 1 } }), '{"file":{"content":1}}')
  assert.equal(outputText(null), 'null')
  assert.equal(outputText(['a']), '["a"]')
  assert.equal(outputText(undefined), '')
})

test('replacedOutput：替换 stdout 并清空 stderr，替换 file.content；不改原值', () => {
  assert.deepEqual(replacedOutput(bash, '新'), {
    stdout: '新',
    stderr: '',
    interrupted: false,
  })
  assert.deepEqual(replacedOutput({ stdout: 'out' }, '新'), { stdout: '新' })
  assert.deepEqual(replacedOutput(read, '新'), {
    type: 'text',
    file: { filePath: 'a.txt', content: '新', numLines: 1 },
  })
  assert.deepEqual(bash, { stdout: 'out', stderr: 'err', interrupted: false })
  assert.equal(read.file.content, '正文')
})

test('replacedOutput：字符串与其他形状返回 null', () => {
  const cases: unknown[] = [
    'text',
    null,
    undefined,
    [],
    { stdout: 1 },
    { file: { content: 1 } },
    { file: 'a' },
    { content: [{ type: 'text', text: 'x' }] },
  ]
  for (const value of cases) assert.equal(replacedOutput(value, '新'), null)
})
