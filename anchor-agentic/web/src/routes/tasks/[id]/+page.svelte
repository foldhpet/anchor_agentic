<script lang="ts">
	import { enhance } from '$app/forms';
	import { STATUS_STYLE } from '$lib/statusStyle';
	import type { VersionSnapshot } from '$lib/api/types';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let viewingVersion = $state<VersionSnapshot | null>(null);
	let versionsTotalPages = $derived(Math.max(1, Math.ceil(data.versionsTotal / data.versionsPageSize)));
</script>

<h1 class="text-2xl">{data.task.name}</h1>
<p class="mt-1 text-sm"><a href="/roles/{data.role.id}">&larr; {data.role.name}</a></p>

{#if form?.error}
	<p role="alert" class="mt-4 rounded-md border-l-4 border-attention bg-surface px-4 py-3 text-ink">
		{form.error}
	</p>
{/if}

{#if data.isOwner && data.task.status !== 'Archived'}
	<form
		method="POST"
		action="?/update"
		use:enhance={() => {
			return async ({ update }) => {
				await update({ reset: false });
			};
		}}
		class="mt-6 flex max-w-sm flex-col gap-4"
	>
		<label class="flex flex-col gap-1 text-sm">
			Name
			<input
				name="name"
				value={data.task.name}
				required
				class="rounded-md border border-ink/15 bg-bg px-3 py-1.5"
			/>
		</label>
		<label class="flex flex-col gap-1 text-sm">
			Instructions
			<textarea name="instructions" class="rounded-md border border-ink/15 bg-bg px-3 py-1.5"
				>{data.task.instructions ?? ''}</textarea
			>
		</label>
		<label class="flex flex-col gap-1 text-sm">
			Role
			<input
				value={data.role.name}
				disabled
				readonly
				class="rounded-md border border-ink/15 bg-surface px-3 py-1.5 text-ink/60"
			/>
			<span class="text-xs text-ink/60">(a Task cannot be moved to a different Role)</span>
		</label>
		<p class="text-sm text-ink/70">
			Status: <span class="rounded-full px-2 py-0.5 text-xs {STATUS_STYLE[data.task.status]}"
				>{data.task.status}</span
			>
		</p>
		<button type="submit" class="self-start rounded-md bg-primary px-4 py-1.5 text-white">Save</button>
	</form>
	{#if data.task.status === 'Draft'}
		<form method="POST" action="?/archive" use:enhance class="mt-2">
			<button type="submit" class="rounded-md border border-attention px-3 py-1.5 text-sm text-ink"
				>Archive</button
			>
		</form>
	{/if}
{:else}
	<p class="mt-4 text-ink/80">{data.task.instructions ?? ''}</p>
	<p class="mt-2 text-sm text-ink/70">Role: {data.role.name}</p>
	<p class="mt-2 text-sm text-ink/70">
		Status: <span class="rounded-full px-2 py-0.5 text-xs {STATUS_STYLE[data.task.status]}"
			>{data.task.status}</span
		>
	</p>
	{#if data.task.status === 'Archived'}
		<p class="mt-2 rounded-md bg-surface px-4 py-3 text-sm text-ink/70">
			This item is archived — clone it to resume work.
		</p>
	{:else if !data.isOwner}
		<p class="mt-2 rounded-md bg-surface px-4 py-3 text-sm text-ink/70">
			Read-only — you're viewing another user's Sandbox item.
		</p>
	{/if}
{/if}

<h2 class="mt-8 text-lg">Version History</h2>
{#if data.versions.length === 0}
	<p class="mt-2 text-ink/70">No version history yet.</p>
{:else}
	<ul class="mt-2 flex flex-col gap-1">
		{#each data.versions as version (version.id)}
			<li>
				<button
					type="button"
					onclick={() => (viewingVersion = version)}
					class="rounded-md border border-ink/10 px-3 py-1.5 text-sm hover:bg-surface"
				>
					v{version.version_number} — {version.created_at}
				</button>
			</li>
		{/each}
	</ul>
	{#if viewingVersion}
		<pre class="mt-2 overflow-x-auto rounded-md bg-surface p-4 text-xs">{JSON.stringify(
				viewingVersion.snapshot_data,
				null,
				2
			)}</pre>
		<button
			type="button"
			onclick={() => (viewingVersion = null)}
			class="mt-2 rounded-md border border-ink/15 px-3 py-1.5 text-sm">Close</button
		>
	{/if}
	{#if versionsTotalPages > 1}
		<p class="mt-4 flex items-center gap-3 text-sm text-ink/70">
			Version page {data.versionsPage} of {versionsTotalPages}
			{#if data.versionsPage > 1}
				<a href="?vpage={data.versionsPage - 1}">&larr; Prev</a>
			{/if}
			{#if data.versionsPage < versionsTotalPages}
				<a href="?vpage={data.versionsPage + 1}">Next &rarr;</a>
			{/if}
		</p>
	{/if}
{/if}
