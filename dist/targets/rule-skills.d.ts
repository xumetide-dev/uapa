import type { Rule } from '../source/types.ts';
import type { OutputFile, TargetNote, TargetPlan } from './types.ts';
export declare function plannedRules(plans: readonly TargetPlan[]): Rule[];
export declare function ruleSkillFile(rule: Rule): OutputFile;
export declare function alwaysRulesText(rules: readonly Rule[]): string | null;
export declare function rulesScript(text: string): string;
export declare function sharedRuleRisks(plans: readonly TargetPlan[], written: readonly Rule[]): TargetNote[];
