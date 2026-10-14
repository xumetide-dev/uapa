// 打包时由 bundle 解析的模块名与替换的标识符（入口与打包接口第 1 节，F-04-06）。
// 入口源码在调用处直接使用两个标识符，不经变量、对象属性或函数参数转手。

declare module 'uapa:guard' {
  const guard: import('../core/types.ts').GuardPlugin
  export default guard
}

declare module 'uapa:target-data' {
  const data: import('../core/types.ts').TargetRuntimeData
  export default data
}

declare const __UAPA_PLUGIN_NAME__: string
declare const __UAPA_MODULE_SESSION_ENV__: string | null
