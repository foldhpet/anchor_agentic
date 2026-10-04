<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex min-h-screen flex-col">
	<header class="border-b border-ink/10 bg-surface">
		<nav class="mx-auto flex max-w-4xl flex-wrap items-center gap-4 px-4 py-3 text-sm">
			<a class="font-semibold no-underline" href="/">AnchorAgentic</a>
			<a href="/">Marketplace</a>
			<a href="/library">My Sandbox</a>
			<a href="/library/all">All Sandbox</a>
			<span class="flex-1"></span>
			{#if data.session}
				<details class="relative">
					<summary class="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-white marker:text-white">
						+ New
					</summary>
					<div
						class="absolute right-0 z-10 mt-1 flex flex-col gap-1 rounded-md border border-ink/10 bg-bg p-2 shadow-sm"
					>
						<a href="/roles/new">New Role</a>
						<a href="/agents/new">New Agent</a>
						<a href="/skills/new">New Skill</a>
						<a href="/workflows/new">New Workflow</a>
					</div>
				</details>
				<a href="/settings">Settings</a>
				<form method="POST" action="/logout">
					<button type="submit" class="rounded-md px-2 py-1.5 hover:bg-ink/5">Log out</button>
				</form>
			{:else}
				<a href="/login">Log in</a>
				<a href="/register" class="rounded-md bg-primary px-3 py-1.5 text-white no-underline">Register</a>
			{/if}
		</nav>
	</header>

	<main class="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
		{@render children()}
	</main>

	<footer class="mx-auto w-full max-w-4xl px-4 py-6 text-sm text-ink/70">
		<a href="https://github.com/sponsors/foldhpet" target="_blank" rel="noopener noreferrer">
			♥ Support this project
		</a>
	</footer>
</div>
