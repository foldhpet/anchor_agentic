// Emoji-tagged console logging shared by every flow model.

export const log = {
	step: (flow: string, message: string) => console.log(`▶️  [${flow}] ${message}`),
	ok: (flow: string, message: string) => console.log(`✅ [${flow}] ${message}`),
	warn: (flow: string, message: string) => console.warn(`⚠️  [${flow}] ${message}`),
	fail: (flow: string, message: string) => console.error(`❌ [${flow}] ${message}`)
};
