import { createInterface } from 'node:readline/promises';
import type { Readable, Writable } from 'node:stream';
import { GLYPH } from './icons.ts';
import type { Candidate, DecisionKind } from './quarantine.ts';

export type Answer = DecisionKind | 'later';

export interface PromptIO {
	input: Readable;
	output: Writable;
}

/** True when a person can answer: both ends are a terminal and this is not CI. */
export function canAsk(
	stdin: { isTTY?: boolean } = process.stdin,
	stdout: { isTTY?: boolean } = process.stdout,
	env: NodeJS.ProcessEnv = process.env
): boolean {
	return Boolean(stdin.isTTY && stdout.isTTY && !env.CI);
}

export function warningText(candidate: Candidate): string {
	return [
		'',
		`${GLYPH.quarantined} QUARANTINE DECISION NEEDED: "${candidate.title}"`,
		`   It was flaky in ${candidate.flakyRuns} of its last ${candidate.window} runs.`,
		'   Quarantine keeps running it and reporting it, but its failures stop failing the build,',
		'   so a real regression in it could slip through. Only a person can make this call.'
	].join('\n');
}

const CHOICES: Record<string, Answer> = {
	q: 'quarantined',
	k: 'keep-blocking',
	l: 'later'
};

/**
 * Warns about each candidate and asks what to do; anything unrecognised, or the input ending,
 * means "later". Lines are read through an iterator so answers typed (or piped) ahead are not lost.
 */
export async function askDecisions(
	candidates: Candidate[],
	io: PromptIO = { input: process.stdin, output: process.stdout }
): Promise<Map<string, Answer>> {
	const answers = new Map<string, Answer>();
	const rl = createInterface({ input: io.input, output: io.output });
	const lines = rl[Symbol.asyncIterator]();
	rl.setPrompt('   [q]uarantine / [k]eep blocking (do not ask again) / [l]ater: ');
	try {
		for (const candidate of candidates) {
			io.output.write(`${warningText(candidate)}\n`);
			rl.prompt();
			const next = await lines.next();
			const reply = next.done ? '' : next.value.trim().toLowerCase();
			answers.set(candidate.key, CHOICES[reply[0] ?? ''] ?? 'later');
		}
	} finally {
		rl.close();
	}
	return answers;
}
