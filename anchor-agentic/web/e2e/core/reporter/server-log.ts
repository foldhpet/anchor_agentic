// Server-side error capture. The Playwright web servers' output reaches the reporter as text;
// this finds the structured error lines an application writes when a request fails with a 5xx.
// Expected shape (one JSON object per line):  {"requestId":"…","path":"/api/…","method":"GET","error":"…"}
// Lines without `path`, `method` and `error` (request logs, rejections) are ignored.

export interface ServerErrorSample {
	path: string;
	method: string;
	error: string;
	requestId?: string;
}

export interface ServerErrorReport {
	count: number;
	/** The first few distinct errors, to keep reports small. */
	samples: ServerErrorSample[];
}

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;
const MAX_SAMPLES = 10;

export function parseServerErrors(text: string): ServerErrorSample[] {
	const found: ServerErrorSample[] = [];
	for (const line of text.replace(ANSI, '').split('\n')) {
		const start = line.indexOf('{');
		const end = line.lastIndexOf('}');
		if (start === -1 || end <= start) continue;
		try {
			const entry = JSON.parse(line.slice(start, end + 1)) as Record<string, unknown>;
			if (
				typeof entry.path === 'string' &&
				typeof entry.method === 'string' &&
				typeof entry.error === 'string'
			) {
				found.push({
					path: entry.path,
					method: entry.method,
					error: entry.error,
					requestId: typeof entry.requestId === 'string' ? entry.requestId : undefined
				});
			}
		} catch {
			// Not JSON; ordinary server output.
		}
	}
	return found;
}

/** Feed it the raw output chunks; it buffers partial lines and de-duplicates by request. */
export class ServerErrorCollector {
	private buffer = '';
	private count = 0;
	private readonly seen = new Set<string>();
	private readonly samples: ServerErrorSample[] = [];

	add(chunk: string | Buffer) {
		this.buffer += chunk.toString();
		const lastNewline = this.buffer.lastIndexOf('\n');
		if (lastNewline === -1) return;
		const complete = this.buffer.slice(0, lastNewline);
		this.buffer = this.buffer.slice(lastNewline + 1);
		for (const sample of parseServerErrors(complete)) {
			const id = sample.requestId ?? `${sample.method} ${sample.path} ${sample.error}`;
			if (this.seen.has(id)) continue;
			this.seen.add(id);
			this.count++;
			if (this.samples.length < MAX_SAMPLES) this.samples.push(sample);
		}
	}

	report(): ServerErrorReport {
		this.add('\n'); // flush a last line that had no trailing newline
		return { count: this.count, samples: [...this.samples] };
	}
}
