// 工具输出的文本形式与替换（入口与打包接口第 4 节，F-04-08）：子进程入口与 hooks 模块入口
// 共用。按输出的形状判断，不按工具名，宿主改动输出形状时落到「其他」一行而不出错。
type Fields = Readonly<Record<string, unknown>>

function isRecord(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Claude Code 的 Bash：{ stdout, stderr, ... }
function hasStdout(output: unknown): output is Fields & { stdout: string } {
  return isRecord(output) && typeof output.stdout === 'string'
}

// Claude Code 的 Read：{ type, file: { content, ... } }
function fileOf(output: unknown): (Fields & { content: string }) | null {
  if (!isRecord(output) || !isRecord(output.file)) return null
  const file = output.file
  return typeof file.content === 'string'
    ? (file as Fields & { content: string })
    : null
}

export function outputText(output: unknown): string {
  if (typeof output === 'string') return output
  if (hasStdout(output)) {
    const stderr = output.stderr
    return typeof stderr === 'string' && stderr !== ''
      ? `${output.stdout}\n${stderr}`
      : output.stdout
  }
  const file = fileOf(output)
  if (file !== null) return file.content
  // undefined 与函数没有 JSON 文本，按空串交给守卫
  return JSON.stringify(output) ?? ''
}

// 返回替换后的宿主输出（新对象，不改原值）；形状不能替换时返回 null，由调用方按扣留写出
export function replacedOutput(output: unknown, text: string): unknown {
  if (hasStdout(output)) {
    // stderr 已并入 text，置空以免模型读到未经替换的部分
    return 'stderr' in output
      ? { ...output, stdout: text, stderr: '' }
      : { ...output, stdout: text }
  }
  const file = fileOf(output)
  if (file !== null && isRecord(output)) {
    return { ...output, file: { ...file, content: text } }
  }
  return null
}
