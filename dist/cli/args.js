export const HELP = `用法：uapa build [--config <路径>] [--check]
      uapa --help | --version

命令：
  build            从源项目构建各目标的插件目录，并写出构建报告

选项：
  --config <路径>  构建配置文件，默认为当前目录下的 uapa.config.ts
  --check          只比对产物与磁盘，不写文件；列出差异，有差异时以退出码 1 结束
  --help           显示本帮助
  --version        显示版本
`;
export function parseCommand(argv) {
    if (argv.includes('--help'))
        return { kind: 'help' };
    if (argv.includes('--version'))
        return { kind: 'version' };
    const [command, ...rest] = argv;
    if (command === undefined)
        return usage('缺少命令');
    if (command !== 'build')
        return usage(`未知命令 ${command}`);
    let config = null;
    let check = false;
    for (let i = 0; i < rest.length; i++) {
        const arg = rest[i];
        if (arg === '--check')
            check = true;
        else if (arg === '--config' || arg.startsWith('--config=')) {
            const value = arg === '--config' ? rest[++i] : arg.slice('--config='.length);
            if (value === undefined || value === '')
                return usage('--config 缺少路径');
            config = value;
        }
        else if (arg.startsWith('-'))
            return usage(`未知选项 ${arg}`);
        else
            return usage(`多余的参数 ${arg}`);
    }
    return { kind: 'build', config, check };
}
function usage(message) {
    return { kind: 'usage-error', message: `${message}（运行 uapa --help 查看用法）` };
}
