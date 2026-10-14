// 列出一个 ESM 文件的全部导入（含动态导入）：以 rolldown 重新解析，所有导入都视为外部导入
import { rolldown } from 'rolldown'

export async function importsOf(file: string): Promise<string[]> {
  const build = await rolldown({ input: file, external: () => true, onLog: () => {} })
  try {
    const { output } = await build.generate({ format: 'esm', codeSplitting: false })
    const [chunk] = output
    if (chunk === undefined || chunk.type !== 'chunk')
      throw new Error(`无法解析 ${file}`)
    return [...chunk.imports, ...chunk.dynamicImports].sort()
  } finally {
    await build.close()
  }
}
