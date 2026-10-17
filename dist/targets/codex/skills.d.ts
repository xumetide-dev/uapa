import type { Skill } from '../../source/types.ts';
import type { TargetSkip } from '../types.ts';
export declare function skillNameReason(pluginName: string, name: string): string | null;
export declare function skillSkips(target: TargetSkip['target'], pluginName: string, skills: readonly Skill[]): TargetSkip[];
export declare function nestedSkillRisks(skills: readonly Skill[]): string[];
