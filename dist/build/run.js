import { readGuard, readSource } from '../source/index.js';
import { compareOutputs } from './compare.js';
import { generateHosts } from './generate.js';
import { planOutputs } from './outputs.js';
import { planTargets } from './plan.js';
import { toReport, writeReport } from './report.js';
import { verifyHosts } from './verify.js';
import { writeOutputs } from './write.js';
// 比对模式与构建共用到“计划写出的文件集合”为止：比对时不写文件、不调用宿主校验、不写报告
export async function runBuild(config, root, options, deps) {
    const source = await readSource(config, root);
    const guard = await readGuard(config, root);
    if (!source.ok || !guard.ok) {
        const issues = [
            ...(source.ok ? [] : source.issues),
            ...(guard.ok ? [] : guard.issues),
        ];
        return { kind: 'input-error', issues };
    }
    const build = { config, root, source: source.value, guard: guard.value };
    const states = planTargets(config, source.value, guard.value, deps.targetCapabilities);
    const hostFiles = await generateHosts(build, states, deps);
    const outputs = await planOutputs(build, states, hostFiles);
    if (options.check) {
        const changes = await compareOutputs(root, outputs);
        return { kind: 'done', report: toReport(states), reportPath: null, changes };
    }
    await writeOutputs(root, outputs);
    await verifyHosts(config, root, states, deps.hostModules);
    const report = toReport(states);
    const reportPath = await writeReport(config, root, report);
    return { kind: 'done', report, reportPath, changes: null };
}
