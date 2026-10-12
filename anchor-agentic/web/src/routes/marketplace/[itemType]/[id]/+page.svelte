<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { listQuery, listStateFromParams } from '$lib/marketplaceList';
	import { pageTitle } from '$lib/pageTitle';
	import { nextQuery, targetFromUrl } from '$lib/returnTo';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// US-057: the Log in / Register links of the anonymous notice return the visitor to this page.
	let returnQuery = $derived(nextQuery(targetFromUrl(page.url)));
	let loginHref = $derived(
		returnQuery ? resolve(`/login?${returnQuery}` as const) : resolve('/login')
	);
	let registerHref = $derived(
		returnQuery ? resolve(`/register?${returnQuery}` as const) : resolve('/register')
	);

	let displayName = $derived(
		data.itemType === 'AGENT' ? `Agent for ${data.item.role_name}` : data.item.name
	);

	// "Back to Marketplace" returns to the filtered/paginated list the visitor came from. It is
	// rebuilt from ONLY the list's four known parameters (q, type, role, page) into a same-site
	// path, never from an arbitrary URL. A direct arrival keeps the plain "/".
	let backHref = $state(resolve('/'));
	afterNavigate(({ from, type }) => {
		let source: URL | null = from?.url ?? null;
		if (!source && type === 'enter' && document.referrer) {
			try {
				source = new URL(document.referrer);
			} catch {
				source = null;
			}
		}
		// Only the four known list parameters are rebuilt, so nothing arbitrary is echoed into the link.
		const query =
			source && source.origin === location.origin && source.pathname === '/'
				? listQuery(listStateFromParams(source.searchParams))
				: '';
		backHref = query ? resolve(`/?${query}` as const) : resolve('/');
	});

	let cloning = $state(false);
</script>

<svelte:head><title>{pageTitle(displayName)}</title></svelte:head>

<h1 class="text-2xl">{displayName}</h1>
<p class="mt-1 flex items-center gap-2 text-sm">
	<a href={backHref}>&larr; Back to Marketplace</a>
	<span class="rounded-full bg-surface px-2 py-0.5 text-xs text-ink/75">{data.itemType}</span>
</p>

{#if form?.error}
	<p role="alert" class="mt-4 rounded-md border-l-4 border-attention bg-surface px-4 py-3 text-ink">
		{form.error}
	</p>
{/if}

{#if data.item.description}<p class="mt-4 text-ink/80">{data.item.description}</p>{/if}

<p class="mt-4 text-sm text-ink/75">Published version: v{data.item.published_version}</p>
{#if data.item.rating_count === 0}
	<p class="mt-1 text-sm text-ink/75">Not yet rated</p>
{:else}
	<p class="mt-1 text-sm text-ink/75">
		Rating: {data.item.rating?.toFixed(1)}/5 ({data.item.rating_count} rating{data.item
			.rating_count === 1
			? ''
			: 's'})
	</p>
{/if}

{#if data.isRegistered}
	<form method="POST" action="?/rate" use:enhance class="mt-3 flex items-end gap-3">
		<label class="flex flex-col gap-1 text-sm">
			Your rating:
			<select name="score" required class="rounded-md border border-ink/15 bg-bg px-3 py-1.5">
				{#if data.myRating == null}
					<option value="" disabled selected>Choose a rating…</option>
				{/if}
				{#each [1, 2, 3, 4, 5] as value (value)}
					<option {value} selected={data.myRating === value}>{value}</option>
				{/each}
			</select>
		</label>
		<button type="submit" class="rounded-md bg-primary px-4 py-1.5 text-white">Rate</button>
	</form>
	{#if form?.success}
		<p
			role="status"
			class="mt-3 rounded-md border-l-4 border-attention bg-surface px-4 py-3 text-ink"
		>
			Thanks, your rating is saved.
		</p>
	{/if}
{:else}
	<p
		role="status"
		class="mt-4 rounded-md border-l-4 border-attention bg-surface px-4 py-3 text-ink"
	>
		Log in or register to clone this item into your Sandbox and rate it.
		<a href={loginHref}>Log in</a> or <a href={registerHref}>Register</a>
	</p>
{/if}

{#if data.provenance}
	<p class="mt-4 text-sm text-ink/75">
		Cloned from
		{#if data.provenance.source_name}
			{data.provenance.source_name}
		{:else}
			a since-removed item
		{/if}
	</p>
{/if}

{#if data.isRegistered}
	<form
		method="POST"
		action="?/clone"
		use:enhance={() => {
			cloning = true;
			return async ({ update }) => {
				await update();
				cloning = false;
			};
		}}
		class="mt-4"
	>
		<button
			type="submit"
			disabled={cloning}
			class="rounded-md bg-primary px-4 py-1.5 text-white disabled:opacity-60"
			>{cloning ? 'Cloning…' : 'Clone into My Sandbox'}</button
		>
	</form>
{/if}

<p class="mt-4 text-sm text-ink/75">Cloned {data.item.clone_count} times</p>

{#if data.itemType === 'AGENT'}
	<h2 class="mt-8 text-lg">Task Assignments</h2>
	{#if !data.assignments || data.assignments.length === 0}
		<p class="mt-2 text-ink/75">No Tasks assigned.</p>
	{:else}
		<ul class="mt-2 flex flex-col gap-2">
			{#each data.assignments as assignment (assignment.id)}
				<li class="rounded-md border border-ink/10 p-3">
					{assignment.tasks?.name ?? assignment.task_id}
				</li>
			{/each}
		</ul>
	{/if}
{:else if data.itemType === 'SKILL'}
	<h2 class="mt-8 text-lg">Skill Files</h2>
	<ul class="mt-2 flex flex-col gap-2">
		{#each data.item.skill_files ?? [] as file (file.path)}
			<li class="rounded-md border border-ink/10 p-3">
				<strong>{file.path}</strong>
				<pre class="mt-2 overflow-x-auto rounded-md bg-surface p-3 text-xs">{file.content}</pre>
			</li>
		{/each}
	</ul>
{:else if data.itemType === 'WORKFLOW'}
	<h2 class="mt-8 text-lg">Steps</h2>
	<ol class="mt-2 flex flex-col gap-2">
		{#each data.steps ?? [] as step (step.id)}
			<li class="rounded-md border border-ink/10 p-3">[{step.step_type}] {step.label}</li>
		{/each}
	</ol>
{/if}

<details class="mt-8" open={!!form?.reported}>
	<summary class="cursor-pointer text-lg">Report this item</summary>
	{#if form?.reported}
		<p
			role="status"
			class="mt-4 rounded-md border-l-4 border-caution bg-surface px-4 py-3 text-ink"
		>
			Report submitted — thank you. This item is now pending review.
		</p>
	{/if}
	<form method="POST" action="?/report" use:enhance class="mt-2 flex max-w-sm flex-col gap-4">
		<label class="flex flex-col gap-1 text-sm">
			Reason:
			<select name="reason" required class="rounded-md border border-ink/15 bg-bg px-3 py-1.5">
				<option value="ABUSIVE">Abusive content</option>
				<option value="BROKEN">Broken / doesn't work</option>
				<option value="SPAM">Spam</option>
				<option value="OTHER">Other</option>
			</select>
		</label>
		<label class="flex flex-col gap-1 text-sm">
			Details (optional):
			<textarea
				name="detail"
				maxlength="2000"
				class="rounded-md border border-ink/15 bg-bg px-3 py-1.5"></textarea>
		</label>
		<button
			type="submit"
			class="self-start rounded-md border border-attention px-4 py-1.5 text-sm text-ink"
			>Report</button
		>
	</form>
</details>
