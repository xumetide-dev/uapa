export type Command = {
    readonly kind: 'help';
} | {
    readonly kind: 'version';
} | {
    readonly kind: 'build';
    readonly config: string | null;
    readonly check: boolean;
} | {
    readonly kind: 'usage-error';
    readonly message: string;
};
export declare const HELP = "\u7528\u6CD5\uFF1Auapa build [--config <\u8DEF\u5F84>] [--check]\n      uapa --help | --version\n\n\u547D\u4EE4\uFF1A\n  build            \u4ECE\u6E90\u9879\u76EE\u6784\u5EFA\u5404\u76EE\u6807\u7684\u63D2\u4EF6\u76EE\u5F55\uFF0C\u5E76\u5199\u51FA\u6784\u5EFA\u62A5\u544A\n\n\u9009\u9879\uFF1A\n  --config <\u8DEF\u5F84>  \u6784\u5EFA\u914D\u7F6E\u6587\u4EF6\uFF0C\u9ED8\u8BA4\u4E3A\u5F53\u524D\u76EE\u5F55\u4E0B\u7684 uapa.config.ts\n  --check          \u53EA\u6BD4\u5BF9\u4EA7\u7269\u4E0E\u78C1\u76D8\uFF0C\u4E0D\u5199\u6587\u4EF6\uFF1B\u5217\u51FA\u5DEE\u5F02\uFF0C\u6709\u5DEE\u5F02\u65F6\u4EE5\u9000\u51FA\u7801 1 \u7ED3\u675F\n  --help           \u663E\u793A\u672C\u5E2E\u52A9\n  --version        \u663E\u793A\u7248\u672C\n";
export declare function parseCommand(argv: readonly string[]): Command;
