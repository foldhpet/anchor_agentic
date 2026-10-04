<script lang="ts">
	import type { PageData } from './$types'

	let { data, form }: { data: PageData; form: { success?: boolean; error?: string } | null } = $props()

	let showGithubConnected = $state(false)
	let showGithubError = $state(false)
	let githubErrorReason = $state<string | null>(null)

	$effect(() => {
		const params = new URLSearchParams(window.location.search)
		if (params.get('github') === 'connected') {
			showGithubConnected = true
			window.history.replaceState({}, '', window.location.pathname)
		}
		if (params.get('github') === 'error') {
			showGithubError = true
			githubErrorReason = params.get('reason')
			window.history.replaceState({}, '', window.location.pathname)
		}
	})
</script>

<h1 class="text-2xl">Account Settings</h1>
<p class="mt-1 text-sm"><a href="/">← Back to Home</a></p>

{#if form?.error}
	<p role="alert" class="mt-4 rounded-md border-l-4 border-attention bg-surface px-4 py-3 text-ink">
		{form.error}
	</p>
{/if}

{#if showGithubConnected}
	<p role="alert" class="mt-4 rounded-md border-l-4 border-primary bg-surface px-4 py-3 text-ink">
		GitHub account connected successfully!
	</p>
{/if}

{#if showGithubError}
	<p role="alert" class="mt-4 rounded-md border-l-4 border-attention bg-surface px-4 py-3 text-ink">
		GitHub connection failed{githubErrorReason ? `: ${githubErrorReason}` : '.'}
	</p>
{/if}

<section class="mt-6 rounded-md border border-ink/10 p-4">
	<h2 class="text-lg">GitHub Export</h2>
	{#if data.github.connected}
		<p class="mt-2 text-ink/80">✓ Connected as <strong>{data.github.username}</strong></p>
		<p class="mt-1 text-sm text-ink/70">
			Your GitHub account is authorized to receive exports of your Agents, Skills, and Workflows.
		</p>
		<form method="POST" action="?/revoke" class="mt-3">
			<button type="submit" class="rounded-md border border-ink/15 px-3 py-1.5 text-sm">
				Revoke GitHub Access
			</button>
		</form>
		<p class="mt-2 text-sm text-ink/60">
			You can also revoke app access directly on <a
				href="https://github.com/settings/applications"
				target="_blank">GitHub's settings page</a
			>.
		</p>
	{:else}
		<p class="mt-2 text-ink/80">
			Not connected. Connect your GitHub account to export your work directly to a repository.
		</p>
		<form method="POST" action="?/connect" class="mt-3">
			<button type="submit" class="rounded-md bg-primary px-4 py-1.5 text-white"> Connect GitHub </button>
		</form>
	{/if}
</section>
