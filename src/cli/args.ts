// 命令行参数解析（F-09-01、F-09-03）。只认 build 命令与下列选项，其余为用法错误。
export type Command =
  | { readonly kind: 'help' }
  | { readonly kind: 'version' }
  | { readonly kind: 'build'; readonly config: string | null }
  | { readonly kind: 'usage-error'; readonly message: string }

export const HELP = `用法：uapa build [--config <路径>]
      uapa --help | --version

命令：
  build            从源项目构建各目标的插件目录，并写出构建报告

选项：
  --config <路径>  构建配置文件，默认为当前目录下的 uapa.config.ts
  --help           显示本帮助
  --version        显示版本
`

export function parseCommand(argv: readonly string[]): Command {
  if (argv.includes('--help')) return { kind: 'help' }
  if (argv.includes('--version')) return { kind: 'version' }
  const [command, ...rest] = argv
  if (command === undefined) return usage('缺少命令')
  if (command !== 'build') return usage(`未知命令 ${command}`)
  let config: string | null = null
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i] as string
    if (arg === '--config' || arg.startsWith('--config=')) {
      const value = arg === '--config' ? rest[++i] : arg.slice('--config='.length)
      if (value === undefined || value === '') return usage('--config 缺少路径')
      config = value
    } else if (arg.startsWith('-')) return usage(`未知选项 ${arg}`)
    else return usage(`多余的参数 ${arg}`)
  }
  return { kind: 'build', config }
}

function usage(message: string): Command {
  return { kind: 'usage-error', message: `${message}（运行 uapa --help 查看用法）` }
}
