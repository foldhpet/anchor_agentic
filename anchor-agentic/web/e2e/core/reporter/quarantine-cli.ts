// Human side of quarantine. Run from anchor-agentic/web:
//   node e2e/core/reporter/quarantine-cli.ts list              show decisions and tests waiting for one
//   node e2e/core/reporter/quarantine-cli.ts decide            warn about each candidate and ask
//   node e2e/core/reporter/quarantine-cli.ts release "<key>"   drop a decision (un-quarantine / ask again)
// Options: --reports <dir> (default e2e/reports)   --file <path> (default e2e/quarantine.json)
import { join } from 'node:path';
import { loadHistory } from './history.ts';
import {
	applyAnswers,
	DEFAULT_RULES,
	findCandidates,
	loadDecisions,
	releaseDecision,
	saveDecisions
} from './quarantine.ts';
import { askDecisions, canAsk, warningText } from './quarantine-prompt.ts';

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
	const i = args.indexOf(`--${name}`);
	return i === -1 ? fallback : (args[i + 1] ?? fallback);
};
const reportsDir = option('reports', 'e2e/reports');
const file = option('file', 'e2e/quarantine.json');
const [command = 'list', ...rest] = args.filter(
	(a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')
);

const decisions = loadDecisions(file);
const candidates = findCandidates(loadHistory(reportsDir), decisions, DEFAULT_RULES);

if (command === 'list') {
	console.log(`Decisions in ${file}:`);
	if (decisions.length === 0) console.log('  (none)');
	for (const d of decisions)
		console.log(`  ${d.decision.padEnd(14)} ${d.key}   (${d.decidedAt.slice(0, 10)})`);
	console.log(`Waiting for a decision (${candidates.length}):`);
	for (const c of candidates)
		console.log(`  ${c.title}  flaky ${c.flakyRuns}/${c.window}\n    key: ${c.key}`);
} else if (command === 'decide') {
	if (candidates.length === 0) {
		console.log('Nothing is waiting for a decision.');
	} else if (!canAsk()) {
		for (const c of candidates) console.log(warningText(c));
		console.log('\nRun this command in an interactive terminal to answer.');
		process.exitCode = 1;
	} else {
		const answers = await askDecisions(candidates);
		saveDecisions(file, applyAnswers(decisions, candidates, answers));
		console.log(`\nSaved to ${join(file)}`);
	}
} else if (command === 'release') {
	const key = rest[0];
	if (!key || !decisions.some((d) => d.key === key)) {
		console.error('Give the exact key of an existing decision (see "list").');
		process.exitCode = 1;
	} else {
		saveDecisions(file, releaseDecision(decisions, key));
		console.log(`Released: ${key}`);
	}
} else {
	console.error(`Unknown command "${command}". Use list, decide or release.`);
	process.exitCode = 1;
}
