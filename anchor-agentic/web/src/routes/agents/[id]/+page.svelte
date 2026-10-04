<script lang="ts">
	import { enhance } from '$app/forms';
	import { downloadExport } from '$lib/export';
	import { STATUS_STYLE } from '$lib/statusStyle';
	import type { VersionSnapshot } from '$lib/api/types';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let viewingVersion = $state<VersionSnapshot | null>(null);
	let versionsTotalPages = $derived(Math.max(1, Math.ceil(data.versionsTotal / data.versionsPageSize)));

	let exportError = $state<string | null>(null);

	async function handleExport() {
		exportError = null;
		try {
			await downloadExport('AGENT', data.agent.id, `agent-for-${data.role.name}`);
		} catch (err) {
			exportError = err instanceof Error ? err.message : 'Export failed';
		}
	}
</script>

<h1 class="text-2xl">Agent for {data.role.name}</h1>
<p class="mt-1 text-sm">
	<a href="/agents">&larr; All Agents</a> &middot; <a href="/roles/{data.role.id}">View Role</a>
</p>

{#if form?.error}
	<p role="alert" class="mt-4 rounded-md border-l-4 border-attention bg-surface px-4 py-3 text-ink">
		{form.error}
	</p>
{/if}

{#if data.provenance}
	<p class="mt-2 text-sm text-ink/70">
		Cloned from
		{#if data.provenance.source_name}
			<a href="/agents/{data.provenance.source_item_id}">{data.provenance.source_name}</a>
		{:else}
			a since-removed item
		{/if}
	</p>
{/if}

{#if data.agent.status === 'Published'}
	<form method="POST" action="?/clone" use:enhance class="mt-4">
		<button type="submit" class="rounded-md bg-primary px-4 py-1.5 text-white"
			>Clone into My Sandbox</button
		>
	</form>
{/if}

{#if data.isOwner}
	<p class="mt-4 text-sm text-ink/70">Cloned {data.cloneCount} times</p>
	<button type="button" onclick={handleExport} class="mt-2 rounded-md border border-ink/15 px-3 py-1.5 text-sm"
		>Export to .claude</button
	>
	{#if exportError}
		<p role="alert" class="mt-2 rounded-md border-l-4 border-attention bg-surface px-4 py-3 text-ink">
			{exportError}
		</p>
	{/if}
{/if}

{#if data.isOwner && data.agent.status !== 'Archived'}
	<form
		method="POST"
		action="?/update"
		use:enhance={() => {
			return async ({ update }) => {
				await update({ reset: false });
			};
		}}
		class="mt-6 flex max-w-lg flex-col gap-4"
	>
		<label class="flex flex-col gap-1 text-sm">
			System prompt
			<textarea name="system_prompt" class="rounded-md border border-ink/15 bg-bg px-3 py-1.5"
				>{data.agent.system_prompt ?? ''}</textarea
			>
		</label>
		<p class="text-sm text-ink/70">
			Status: <span class="rounded-full px-2 py-0.5 text-xs {STATUS_STYLE[data.agent.status]}"
				>{data.agent.status}</span
			>
		</p>
		<button type="submit" class="self-start rounded-md bg-primary px-4 py-1.5 text-white">Save</button>
	</form>
	{#if data.agent.published_version == null}
		<p class="mt-2 text-sm text-ink/70">No published version yet.</p>
	{:else}
		<p class="mt-2 text-sm text-ink/70">Published at v{data.agent.published_version}.</p>
	{/if}
	{#if data.agent.published_version == null || data.agent.current_version > data.agent.published_version}
		<form method="POST" action="?/publish" use:enhance class="mt-2">
			<button type="submit" class="rounded-md bg-primary px-4 py-1.5 text-white"
				>{data.agent.published_version == null ? 'Publish' : 'Re-publish'}</button
			>
		</form>
	{/if}
	{#if data.agent.status === 'Draft'}
		<form method="POST" action="?/archive" use:enhance class="mt-2">
			<button type="submit" class="rounded-md border border-attention px-3 py-1.5 text-sm text-ink"
				>Archive</button
			>
		</form>
	{/if}

	<h2 class="mt-8 text-lg">Task Assignments</h2>
	{#if data.tasks.length === 0}
		<p class="mt-2 text-ink/70">
			This Role has no Tasks yet. <a href="/roles/{data.role.id}">Add one</a>.
		</p>
	{:else}
		<ul class="mt-2 flex flex-col gap-2">
			{#each data.tasks as task (task.id)}
				<li class="flex items-center gap-2 rounded-md border border-ink/10 p-3">
					<span>{task.name}</span>
					{#if data.assignedTaskIds.includes(task.id)}
						<form method="POST" action="?/unassign" use:enhance style="display:inline">
							<input type="hidden" name="task_id" value={task.id} />
							<button type="submit" class="rounded-md border border-ink/15 px-2 py-1 text-xs"
								>Unassign</button
							>
						</form>
					{:else}
						<form method="POST" action="?/assign" use:enhance style="display:inline">
							<input type="hidden" name="task_id" value={task.id} />
							<button type="submit" class="rounded-md bg-primary px-2 py-1 text-xs text-white"
								>Assign</button
							>
						</form>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
{:else}
	<p class="mt-4 text-ink/80">{data.agent.system_prompt ?? ''}</p>
	<p class="mt-2 text-sm text-ink/70">
		Status: <span class="rounded-full px-2 py-0.5 text-xs {STATUS_STYLE[data.agent.status]}"
			>{data.agent.status}</span
		>
	</p>
	{#if data.agent.status === 'Archived'}
		<p class="mt-2 rounded-md bg-surface px-4 py-3 text-sm text-ink/70">
			This item is archived — clone it to resume work.
		</p>

		<h2 class="mt-8 text-lg">Task Assignments</h2>
		{#if data.tasks.length === 0}
			<p class="mt-2 text-ink/70">This Role has no Tasks.</p>
		{:else}
			<ul class="mt-2 flex flex-col gap-2">
				{#each data.tasks as task (task.id)}
					<li class="rounded-md border border-ink/10 p-3">
						{task.name}
						{#if data.assignedTaskIds.includes(task.id)}
							<span class="text-sm text-ink/60">(assigned)</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
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
