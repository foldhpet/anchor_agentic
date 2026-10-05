<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { backLink } from '$lib/backLink';
	import { downloadExport } from '$lib/export';
	import { STATUS_STYLE } from '$lib/statusStyle';
	import type { VersionSnapshot } from '$lib/api/types';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let back = $derived(backLink(page.url.searchParams.get('from'), data.isOwner));

	let exportError = $state<string | null>(null);

	async function handleExport() {
		exportError = null;
		try {
			await downloadExport('SKILL', data.skill.id, data.skill.name);
		} catch (err) {
			exportError = err instanceof Error ? err.message : 'Export failed';
		}
	}

	let files = $state(data.skill.skill_files.map((f) => ({ ...f })));

	$effect(() => {
		files = data.skill.skill_files.map((f) => ({ ...f }));
	});

	function addFile() {
		files.push({ path: '', content: '' });
	}

	function removeFile(index: number) {
		files.splice(index, 1);
	}

	let viewingVersion = $state<VersionSnapshot | null>(null);
	let versionsTotalPages = $derived(Math.max(1, Math.ceil(data.versionsTotal / data.versionsPageSize)));
</script>

<h1 class="text-2xl">{data.skill.name}</h1>
<p class="mt-1 text-sm"><a href={back.href}>&larr; {back.label}</a></p>

{#if form?.error}
	<p role="alert" class="mt-4 rounded-md border-l-4 border-attention bg-surface px-4 py-3 text-ink">
		{form.error}
	</p>
{/if}

{#if data.provenance}
	<p class="mt-2 text-sm text-ink/70">
		Cloned from
		{#if data.provenance.source_name}
			<a href="/skills/{data.provenance.source_item_id}">{data.provenance.source_name}</a>
		{:else}
			a since-removed item
		{/if}
	</p>
{/if}

{#if data.skill.status === 'Published'}
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

{#if data.isOwner && data.skill.status !== 'Archived'}
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
			Name
			<input
				name="name"
				value={data.skill.name}
				required
				class="rounded-md border border-ink/15 bg-bg px-3 py-1.5"
			/>
		</label>
		<label class="flex flex-col gap-1 text-sm">
			Description
			<input
				name="description"
				value={data.skill.description ?? ''}
				class="rounded-md border border-ink/15 bg-bg px-3 py-1.5"
			/>
		</label>

		<h2 class="mt-2 text-lg">Skill files</h2>
		{#each files as file, index (index)}
			<fieldset class="flex flex-col gap-3 rounded-md border border-ink/10 p-3">
				<label class="flex flex-col gap-1 text-sm">
					Path
					<input
						bind:value={file.path}
						placeholder="SKILL.md"
						class="rounded-md border border-ink/15 bg-bg px-3 py-1.5"
					/>
				</label>
				<label class="flex flex-col gap-1 text-sm">
					Content
					<textarea
						bind:value={file.content}
						class="rounded-md border border-ink/15 bg-bg px-3 py-1.5"
					></textarea>
				</label>
				<button
					type="button"
					onclick={() => removeFile(index)}
					class="self-start rounded-md border border-attention px-3 py-1.5 text-sm text-ink"
					>Remove file</button
				>
			</fieldset>
		{/each}
		<button
			type="button"
			onclick={addFile}
			class="self-start rounded-md border border-ink/15 px-3 py-1.5 text-sm">+ Add file</button
		>
		<input type="hidden" name="skill_files" value={JSON.stringify(files)} />

		<p class="text-sm text-ink/70">
			Status: <span class="rounded-full px-2 py-0.5 text-xs {STATUS_STYLE[data.skill.status]}"
				>{data.skill.status}</span
			>
		</p>
		<button type="submit" class="self-start rounded-md bg-primary px-4 py-1.5 text-white">Save</button>
	</form>
	{#if data.skill.published_version == null}
		<p class="mt-2 text-sm text-ink/70">No published version yet.</p>
	{:else}
		<p class="mt-2 text-sm text-ink/70">Published at v{data.skill.published_version}.</p>
	{/if}
	{#if data.skill.published_version == null || data.skill.current_version > data.skill.published_version}
		<form method="POST" action="?/publish" use:enhance class="mt-2">
			<button type="submit" class="rounded-md bg-primary px-4 py-1.5 text-white"
				>{data.skill.published_version == null ? 'Publish' : 'Re-publish'}</button
			>
		</form>
	{/if}
	{#if data.skill.status === 'Draft'}
		<form method="POST" action="?/archive" use:enhance class="mt-2">
			<button type="submit" class="rounded-md border border-attention px-3 py-1.5 text-sm text-ink"
				>Archive</button
			>
		</form>
	{/if}
{:else}
	<p class="mt-4 text-ink/80">{data.skill.description ?? ''}</p>
	<p class="mt-2 text-sm text-ink/70">
		Status: <span class="rounded-full px-2 py-0.5 text-xs {STATUS_STYLE[data.skill.status]}"
			>{data.skill.status}</span
		>
	</p>
	{#if data.skill.status === 'Archived'}
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
