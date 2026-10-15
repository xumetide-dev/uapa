// agy 的 rules（F-11-09，SD-32）：按 TargetPlan.rules 生成 rules/<name>.md。frontmatter 换为
// agy 的写法，正文为 Rule.body 原文；依据 agy-plugins.md「rules（1.3.5，容器）」与文档 [A5]。
import { stringify } from 'yaml';
// 文档记载的单个规则文件上限，超出部分被截断（agy-plugins.md [A5]）
const MAX_RULE_BYTES = 24_000;
const TRIGGERS = {
    always: 'always_on',
    model: 'model_decision',
    glob: 'glob',
};
// 生成的文件与残余风险：生成后超过上限的规则、globs 中有模式加了 **/ 前缀的规则各写一条
export function ruleFiles(rules) {
    const encoder = new TextEncoder();
    const files = [];
    const risks = [];
    for (const rule of rules) {
        const path = `rules/${rule.name}.md`;
        const content = ruleText(rule);
        files.push({ path, content });
        if (encoder.encode(content).length > MAX_RULE_BYTES) {
            risks.push(`${path} 超过 agy 规则文件的 24,000 字节上限，超出部分被宿主截断`);
        }
        if (rule.globs.some(pattern => agyGlob(pattern) !== pattern)) {
            risks.push(`${path} 的 globs 中含目录的模式写为 **/ 开头：agy 按文件的绝对路径匹配，` +
                '这些模式也匹配其他位置的同名目录');
        }
    }
    return { files, risks };
}
// agy 按被读文件的绝对路径匹配 globs（agy-plugins.md「rules（1.3.5，容器）」）：不含 / 的模式
// 匹配文件名，原样写出；按工作区相对路径写的含 / 的模式（如 src/**/*.tsx）不生效，加 **/ 前缀。
// 已以 / 或 **/ 开头的模式原样写出，开头的 ./ 先去掉
export function agyGlob(pattern) {
    if (!pattern.includes('/'))
        return pattern;
    if (pattern.startsWith('/') || pattern.startsWith('**/'))
        return pattern;
    const relative = pattern.startsWith('./') ? pattern.slice(2) : pattern;
    return `**/${relative}`;
}
// 键依次为 trigger、description（有值时）、globs（glob 时为以 , 连接的一个字符串：YAML 列表
// 不生效，已实测）。lineWidth 为 0 使长字符串不折行
function ruleText(rule) {
    const meta = { trigger: TRIGGERS[rule.activation] };
    if (rule.description !== null)
        meta.description = rule.description;
    if (rule.activation === 'glob')
        meta.globs = rule.globs.map(agyGlob).join(',');
    return `---\n${stringify(meta, { lineWidth: 0 })}---\n${rule.body}`;
}
