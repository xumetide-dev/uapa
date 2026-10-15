// 构建编排的入口（模块接口 §8）：cli 与构建编排之间的契约。
import { bundle } from '../bundle/index.js';
import { targetCapabilities } from '../capabilities/index.js';
import { hostModules } from '../targets/index.js';
import { runBuild } from './run.js';
// root 为配置文件所在目录的绝对路径
export function build(config, root, options) {
    return runBuild(config, root, options, { hostModules, targetCapabilities, bundle });
}
