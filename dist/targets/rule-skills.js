// rules 的换算（F-05-19、F-06-11，SD-38）：Claude Code 与 Codex 的宿主模块共用，本文件不出现
// 具体宿主名。model 与 glob 规则写为技能，always 规则写入由 SessionStart 命令 hook 运行的输出
// 脚本（入口与打包接口 §2）。
import { stringify } from 'yaml';
import { compare } from '../source/files.js';
// plans 中各目标 TargetPlan.rules 的并集，按名称排序
export function plannedRules(plans) {
    const byName = new Map(plans.flatMap(plan => plan.rules.map(rule => [rule.name, rule])));
    return [...byName.values()].sort((a, b) => compare(a.name, b.name));
}
// skills/<name>/SKILL.md：frontmatter 依次为 name、description（有值时）、paths（glob 规则，
// YAML 列表，模式原样）与 user-invocable: false，正文为 Rule.body。两个宿主为同一条规则生成的
// 文件逐字一致，合并布局中不冲突；与源项目 skill 同路径时由构建编排按同路径冲突处理。
// lineWidth 为 0 使长字符串不折行
export function ruleSkillFile(rule) {
    const meta = { name: rule.name };
    if (rule.description !== null)
        meta.description = rule.description;
    if (rule.activation === 'glob')
        meta.paths = [...rule.globs];
    meta['user-invocable'] = false;
    return {
        path: `skills/${rule.name}/SKILL.md`,
        content: `---\n${stringify(meta, { lineWidth: 0 })}---\n${rule.body}`,
        conflictHint: `rule ${rule.name} 写为同名技能，改名 rule 或 skill 之一`,
    };
}
// always 规则的输出文本：按名称排序，各自的正文去掉首尾换行后以一个空行连接，末尾一个换行；
// 没有 always 规则时为 null
export function alwaysRulesText(rules) {
    const bodies = rules
        .filter(rule => rule.activation === 'always')
        .map(rule => trimNewlines(rule.body));
    return bodies.length === 0 ? null : `${bodies.join('\n\n')}\n`;
}
// 规则输出脚本：不导入任何模块，文本在生成时写成字面量，运行时不读取环境与输入
export function rulesScript(text) {
    return `process.stdout.write(${JSON.stringify(text)})\n`;
}
// 写出而不在某目标 TargetPlan.rules 中的规则：宿主按目录加载，仍对该目标生效（与 skills 相同）
export function sharedRuleRisks(plans, written) {
    return plans.flatMap(plan => {
        const own = new Set(plan.rules.map(rule => rule.name));
        return written
            .filter(rule => !own.has(rule.name))
            .map(rule => ({
            target: plan.target,
            message: `rule ${rule.name} 不适用于本目标，但与其他目标共用插件目录，宿主仍会加载`,
        }));
    });
}
function trimNewlines(text) {
    let start = 0;
    let end = text.length;
    while (start < end && (text[start] === '\n' || text[start] === '\r'))
        start += 1;
    while (end > start && (text[end - 1] === '\n' || text[end - 1] === '\r'))
        end -= 1;
    return text.slice(start, end);
}
