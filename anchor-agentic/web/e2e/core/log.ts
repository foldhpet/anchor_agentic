// Emoji-tagged console logging shared by every flow model and user action.

export const log = {
	step: (flow: string, message: string) => console.log(`▶️  [${flow}] ${message}`),
	ok: (flow: string, message: string) => console.log(`✅ [${flow}] ${message}`),
	warn: (flow: string, message: string) => console.warn(`⚠️  [${flow}] ${message}`),
	fail: (flow: string, message: string) => console.error(`❌ [${flow}] ${message}`),
	/** One line per User Action (core/user-actions.ts), describing what the action just did. */
	action: (message: string) => console.log(`🔹 [UserAction] ${message}`)
};
