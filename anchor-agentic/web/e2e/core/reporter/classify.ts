export type FailureCategory = 'product-bug' | 'test-automation-bug' | 'server-error';

export interface Annotation {
	type: string;
	description?: string;
}

/**
 * A test can pin its own category when the heuristics below get it wrong:
 *   test.info().annotations.push({ type: 'failure-category', description: 'product-bug' });
 */
export const CATEGORY_ANNOTATION = 'failure-category';

const CATEGORIES: readonly FailureCategory[] = [
	'product-bug',
	'test-automation-bug',
	'server-error'
];

// The system under test (or its network path) answered badly or not at all.
const SERVER_ERROR = [
	/internal_error/i,
	/Internal Server Error/i,
	/\b(?:status|HTTP|response)\b[^\n]{0,30}\b5\d{2}\b/i,
	/\bReceived:\s*5\d{2}\b/,
	/\bexpected 5\d{2} to\b/i,
	/\bECONN(?:REFUSED|RESET)\b/,
	/\bfetch failed\b/i,
	/net::ERR_(?:CONNECTION|EMPTY_RESPONSE)/
];

// The test code (or its locators/waits) is broken, not the product.
const TEST_AUTOMATION = [
	/strict mode violation/i,
	/\b(?:TypeError|ReferenceError|SyntaxError|RangeError)\b/,
	/is not a function|is not defined|Cannot read propert/i,
	/Target (?:page|context|browser)[^\n]*closed/i,
	/\b(?:locator|page|frame|browserContext)\.[A-Za-z]+: /,
	/Test timeout of \d+ms exceeded/
];

const matchesAny = (patterns: RegExp[], text: string) => patterns.some((p) => p.test(text));

/**
 * Sorts a failed test into one of three buckets from its error text. It is a heuristic:
 * 1. an explicit `failure-category` annotation wins;
 * 2. server-side symptoms (5xx, internal_error, connection failures) -> server-error;
 * 3. broken test code or a failed wait on a locator/action -> test-automation-bug;
 * 4. anything else, i.e. an assertion that did not hold -> product-bug.
 */
export function classifyFailure(error: string, annotations: Annotation[] = []): FailureCategory {
	const pinned = annotations.find((a) => a.type === CATEGORY_ANNOTATION)?.description;
	const override = CATEGORIES.find((c) => c === pinned);
	if (override) return override;

	if (matchesAny(SERVER_ERROR, error)) return 'server-error';
	if (matchesAny(TEST_AUTOMATION, error)) return 'test-automation-bug';
	return 'product-bug';
}
