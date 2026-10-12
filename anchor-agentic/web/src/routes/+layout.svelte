<script lang="ts">
	import { resolve } from '$app/paths';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Icon from '$lib/Icon.svelte';
	import { navCurrent } from '$lib/navCurrent';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const current = (href: string) => navCurrent(page.url.pathname, href);
	// The current page is also marked by weight, so it is never colour alone.
	const CURRENT = 'aria-[current=page]:font-semibold';
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex min-h-screen flex-col">
	<!-- First tab stop: lets keyboard and screen-reader users skip the repeated nav (WCAG 2.4.1). -->
	<a
		href="#main"
		class="sr-only rounded-md bg-primary px-3 py-1.5 text-white no-underline focus:not-sr-only focus:absolute focus:top-2 focus:left-4 focus:z-20"
		>Skip to content</a
	>
	<header class="border-b border-ink/10 bg-surface">
		<nav
			aria-label="Main"
			class="mx-auto flex max-w-4xl flex-wrap items-center gap-4 px-4 py-3 text-sm"
		>
			<a class="font-semibold no-underline" href={resolve('/')}>AnchorAgentic</a>
			<a class={CURRENT} href={resolve('/')} aria-current={current('/')}>Marketplace</a>
			<a class={CURRENT} href={resolve('/library')} aria-current={current('/library')}>My Sandbox</a
			>
			<a class={CURRENT} href={resolve('/library/all')} aria-current={current('/library/all')}
				>All Sandbox</a
			>
			<span class="flex-1"></span>
			{#if data.session}
				<details class="relative">
					<summary
						class="flex cursor-pointer items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-white marker:content-none"
					>
						<Icon name="new" />New
					</summary>
					<div
						class="absolute right-0 z-10 mt-1 flex flex-col gap-1 rounded-md border border-ink/10 bg-bg p-2 shadow-sm"
					>
						<a href={resolve('/roles/new')}>New Role</a>
						<a href={resolve('/agents/new')}>New Agent</a>
						<a href={resolve('/skills/new')}>New Skill</a>
						<a href={resolve('/workflows/new')}>New Workflow</a>
					</div>
				</details>
				<a class={CURRENT} href={resolve('/settings')} aria-current={current('/settings')}
					>Settings</a
				>
				<form method="POST" action="/logout">
					<button type="submit" class="rounded-md px-2 py-1.5 hover:bg-ink/5">Log out</button>
				</form>
			{:else}
				<a class={CURRENT} href={resolve('/login')} aria-current={current('/login')}>Log in</a>
				<a
					href={resolve('/register')}
					aria-current={current('/register')}
					class="{CURRENT} rounded-md bg-primary px-3 py-1.5 text-white no-underline">Register</a
				>
			{/if}
		</nav>
	</header>

	<main
		id="main"
		tabindex="-1"
		class="mx-auto w-full max-w-4xl flex-1 px-4 py-6 focus:outline-none"
	>
		{@render children()}
	</main>

	<footer class="mx-auto w-full max-w-4xl px-4 py-6 text-sm text-ink/75">
		<a
			class="inline-flex items-center gap-1"
			href="https://github.com/sponsors/foldhpet"
			target="_blank"
			rel="noopener noreferrer"
		>
			<Icon name="support" />Support this project<Icon name="external-link" />
		</a>
	</footer>
</div>
