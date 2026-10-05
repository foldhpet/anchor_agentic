import { readFileSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

// Load .env ourselves (no dotenv dependency) so spec files can read
// PUBLIC_SUPABASE_URL via process.env and skip themselves when it's still
// the placeholder value from .env.example.
try {
	for (const line of readFileSync('.env', 'utf-8').split('\n')) {
		const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
		if (match && !(match[1] in process.env)) process.env[match[1]] = match[2];
	}
} catch {
	// No .env present — specs requiring live Supabase will skip themselves.
}

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.spec.ts',
	globalSetup: './e2e/global-setup.ts',
	globalTeardown: './e2e/global-teardown.ts',
	// Dev-server routes compile on first hit, which easily exceeds the 5s/30s defaults.
	timeout: 90_000,
	expect: { timeout: 15_000 },
	use: { baseURL: 'http://localhost:5173' },
	webServer: [
		{
			command: 'npm run dev',
			cwd: '../api',
			url: 'http://localhost:8787/api/v1/healthz',
			reuseExistingServer: !process.env.CI
		},
		{
			command: 'npm run dev',
			port: 5173,
			reuseExistingServer: !process.env.CI
		}
	]
});
