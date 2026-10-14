#!/usr/bin/env node
// uapa 命令行入口（package.json 的 bin）。逻辑在 run.ts，
// 本文件只接上进程的参数、输出与退出码。
import { run } from './run.ts'

process.exitCode = await run(process.argv.slice(2), process.cwd(), {
  stdout: text => process.stdout.write(text),
  stderr: text => process.stderr.write(text),
})
