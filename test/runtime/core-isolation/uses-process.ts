// TA-02 的反例：引用 Node 的 process。主配置（types 含 node）下合法；
// 继承 tsconfig.runtime-core.json 的配置下 tsc 必须报错
export const cwd = process.cwd()
