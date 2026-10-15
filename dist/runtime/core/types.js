// 守卫公共类型（hooks 适配 §2）与目标运行时数据的类型。
// 本目录不做 I/O、不引用 Node 类型，由 tsconfig.runtime-core.json 检查。
// 包入口只导出插件作者用到的部分（F-02-01、F-02-02）。
export const CAPABILITIES = [
    'rewriteInput',
    'replaceOutput',
    'withholdOutput',
    'stopGate',
    'promptGate',
];
export const GUARD_CHECKS = [
    'beforeTool',
    'beforePrompt',
    'beforeStop',
];
