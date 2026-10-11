// Console logging shared by every flow model and user action. Lines are tagged with the monochrome text
// glyphs from docs/STYLE-GUIDE.md section 7 (no emoji), one per outcome. The glyphs live in the
// Reporter's own module, which is part of core/, so this import stays inside core/.
import { GLYPH } from './reporter/icons.ts';

export const log = {
	step: (flow: string, message: string) => console.log(`${GLYPH.next} [${flow}] ${message}`),
	ok: (flow: string, message: string) => console.log(`${GLYPH.passed} [${flow}] ${message}`),
	warn: (flow: string, message: string) => console.warn(`${GLYPH.flaky} [${flow}] ${message}`),
	fail: (flow: string, message: string) => console.error(`${GLYPH.failed} [${flow}] ${message}`),
	/**
	 * One line per User Action (core/user-actions.ts), describing what the action just did.
	 * Still emoji-tagged: e2e/tests/user-actions.spec.ts asserts this exact prefix and was out of scope
	 * to edit. Change both together (docs/STYLE-GUIDE.md section 8).
	 */
	action: (message: string) => console.log(`🔹 [UserAction] ${message}`)
};
