// 宿主校验（F-05-09）：运行 claude plugin validate --strict <插件目录>。
// 输出中的插件目录绝对路径换为“<插件目录>”，构建报告不含绝对路径。
import { spawnSync } from 'node:child_process';
const COMMAND = 'claude';
const ARGS = ['plugin', 'validate', '--strict'];
const TIMEOUT_MS = 120_000;
export function validatePlugin(dir) {
    const result = spawnSync(COMMAND, [...ARGS, dir], {
        encoding: 'utf8',
        timeout: TIMEOUT_MS,
    });
    const code = result.error?.code;
    if (code === 'ENOENT')
        return { status: 'skipped', reason: 'PATH 中没有 claude' };
    const shown = `${COMMAND} ${ARGS.join(' ')}`;
    if (result.error !== undefined) {
        return {
            status: 'failed',
            errors: [`宿主校验失败：${shown} 未能运行：${result.error.message}`],
        };
    }
    if (result.status === 0)
        return { status: 'passed' };
    const output = `${result.stdout}\n${result.stderr}`
        .split('\n')
        .map(line => line.split(dir).join('<插件目录>').trim())
        .filter(line => line !== '');
    const exit = result.status === null
        ? `被信号 ${result.signal} 终止`
        : `以退出码 ${result.status} 结束`;
    return { status: 'failed', errors: [`宿主校验失败：${shown} ${exit}`, ...output] };
}
