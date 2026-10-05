<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { backLink } from '$lib/backLink';
	import { downloadExport } from '$lib/export';
	import { STATUS_STYLE } from '$lib/statusStyle';
	import type { VersionSnapshot } from '$lib/api/types';
	import type { ActionData, PageProps } from './$types';

	let { data, form }: PageProps & { form: ActionData } = $props();

	let back = $derived(backLink(page.url.searchParams.get('from'), data.isOwner));

	let exportError = $state<string | null>(null);

	async function handleExport() {
		exportError = null;
		try {
			await downloadExport('WORKFLOW', data.workflow.id, data.workflow.name);
		} catch (err) {
			exportError = err instanceof Error ? err.message : 'Export failed';
		}
	}

	let addStepType = $state<'TASK' | 'AGENT' | 'SKILL'>('TASK');
	let editingStepId = $state<string | null>(null);
	let editStepType = $state<'TASK' | 'AGENT' | 'SKILL'>('TASK');

	function startEdit(stepId: string, stepType: 'TASK' | 'AGENT' | 'SKILL') {
		editingStepId = stepId;
		editStepType = stepType;
	}

	let canEdit = $derived(data.isOwner && data.workflow.status !== 'Archived');

	let viewingVersion = $state<VersionSnapshot | null>(null);
	let versionsTotalPages = $derived(Math.max(1, Math.ceil(data.versionsTotal / data.versionsPageSize)));
</script>

<h1 class="text-2xl">{data.workflow.name}</h1>
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
			<a href="/workflows/{data.provenance.source_item_id}">{data.provenance.source_name}</a>
		{:else}
			a since-removed item
		{/if}
	</p>
{/if}

{#if data.workflow.status === 'Published'}
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

{#if canEdit}
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
				value={data.workflow.name}
				required
				class="rounded-md border border-ink/15 bg-bg px-3 py-1.5"
			/>
		</label>
		<label class="flex flex-col gap-1 text-sm">
			Description
			<input
				name="description"
				value={data.workflow.description ?? ''}
				class="rounded-md border border-ink/15 bg-bg px-3 py-1.5"
			/>
		</label>
		<p class="text-sm text-ink/70">
			Status: <span class="rounded-full px-2 py-0.5 text-xs {STATUS_STYLE[data.workflow.status]}"
				>{data.workflow.status}</span
			>
		</p>
		<button type="submit" class="self-start rounded-md bg-primary px-4 py-1.5 text-white">Save</button>
	</form>
	{#if data.workflow.published_version == null}
		<p class="mt-2 text-sm text-ink/70">No published version yet.</p>
	{:else}
		<p class="mt-2 text-sm text-ink/70">Published at v{data.workflow.published_version}.</p>
	{/if}
	{#if data.workflow.published_version == null || data.workflow.current_version > data.workflow.published_version}
		<form method="POST" action="?/publish" use:enhance class="mt-2">
			<button type="submit" class="rounded-md bg-primary px-4 py-1.5 text-white"
				>{data.workflow.published_version == null ? 'Publish' : 'Re-publish'}</button
			>
		</form>
	{/if}
	{#if data.workflow.status === 'Draft'}
		<form method="POST" action="?/archive" use:enhance class="mt-2">
			<button type="submit" class="rounded-md border border-attention px-3 py-1.5 text-sm text-ink"
				>Archive</button
			>
		</form>
	{/if}
{:else}
	<p class="mt-4 text-ink/80">{data.workflow.description}</p>
	<p class="mt-2 text-sm text-ink/70">
		Status: <span class="rounded-full px-2 py-0.5 text-xs {STATUS_STYLE[data.workflow.status]}"
			>{data.workflow.status}</span
		>
	</p>
	{#if data.workflow.status === 'Archived'}
		<p class="mt-2 rounded-md bg-surface px-4 py-3 text-sm text-ink/70">
			This item is archived — clone it to resume work.
		</p>
	{:else if !data.isOwner}
		<p class="mt-2 rounded-md bg-surface px-4 py-3 text-sm text-ink/70">
			Read-only — you're viewing another user's Sandbox item.
		</p>
	{/if}
{/if}

<h2 class="mt-8 text-lg">Steps (v{data.workflow.current_version})</h2>

{#if data.steps.length === 0}
	<p class="mt-2 text-ink/70">No steps yet.</p>
{:else}
	<ol class="mt-2 flex flex-col gap-2">
		{#each data.steps as step, i (step.id)}
			<li class="rounded-md border border-ink/10 p-3">
				{#if editingStepId === step.id}
					<form
						method="POST"
						action="?/editStep"
						use:enhance
						onsubmit={() => (editingStepId = null)}
						class="flex flex-wrap items-center gap-2"
					>
						<input type="hidden" name="step_id" value={step.id} />
						<select
							name="step_type"
							bind:value={editStepType}
							class="rounded-md border border-ink/15 bg-bg px-2 py-1 text-sm"
						>
							<option value="TASK">Task</option>
							<option value="AGENT">Agent</option>
							<option value="SKILL">Skill</option>
						</select>
						<select name="reference_id" class="rounded-md border border-ink/15 bg-bg px-2 py-1 text-sm">
							{#each data.referenceOptions[editStepType] as option (option.id)}
								<option value={option.id}>{option.label}</option>
							{/each}
						</select>
						<button type="submit" class="rounded-md bg-primary px-3 py-1 text-sm text-white">Save</button>
						<button
							type="button"
							onclick={() => (editingStepId = null)}
							class="rounded-md border border-ink/15 px-3 py-1 text-sm">Cancel</button
						>
					</form>
				{:else}
					<div class="flex flex-wrap items-center gap-2">
						<span><strong>{step.step_type}</strong>: {step.label}</span>
						{#if canEdit}
							<form method="POST" action="?/move" use:enhance style="display:inline">
								<input type="hidden" name="step_id" value={step.id} />
								<input type="hidden" name="direction" value="up" />
								<button
									type="submit"
									disabled={i === 0}
									class="rounded-md border border-ink/15 px-2 py-1 text-sm disabled:opacity-40"
									>↑</button
								>
							</form>
							<form method="POST" action="?/move" use:enhance style="display:inline">
								<input type="hidden" name="step_id" value={step.id} />
								<input type="hidden" name="direction" value="down" />
								<button
									type="submit"
									disabled={i === data.steps.length - 1}
									class="rounded-md border border-ink/15 px-2 py-1 text-sm disabled:opacity-40"
									>↓</button
								>
							</form>
							<button
								type="button"
								onclick={() => startEdit(step.id, step.step_type)}
								class="rounded-md border border-ink/15 px-2 py-1 text-sm">Edit</button
							>
							<form method="POST" action="?/removeStep" use:enhance style="display:inline">
								<input type="hidden" name="step_id" value={step.id} />
								<button type="submit" class="rounded-md border border-attention px-2 py-1 text-sm text-ink"
									>Remove</button
								>
							</form>
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ol>
{/if}

{#if canEdit}
	<h3 class="mt-6 text-base font-semibold">Add Step</h3>
	<form method="POST" action="?/addStep" use:enhance class="mt-2 flex flex-wrap items-center gap-2">
		<select name="step_type" bind:value={addStepType} class="rounded-md border border-ink/15 bg-bg px-3 py-1.5">
			<option value="TASK">Task</option>
			<option value="AGENT">Agent</option>
			<option value="SKILL">Skill</option>
		</select>
		{#if data.referenceOptions[addStepType].length === 0}
			<p class="text-sm text-ink/70">No referenceable {addStepType.toLowerCase()}s available yet.</p>
		{:else}
			<select name="reference_id" class="rounded-md border border-ink/15 bg-bg px-3 py-1.5">
				{#each data.referenceOptions[addStepType] as option (option.id)}
					<option value={option.id}>{option.label}</option>
				{/each}
			</select>
			<button type="submit" class="rounded-md bg-primary px-4 py-1.5 text-white">Add Step</button>
		{/if}
	</form>
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
				<a href="?vpage={data.versionsPage - 1}">← Prev</a>
			{/if}
			{#if data.versionsPage < versionsTotalPages}
				<a href="?vpage={data.versionsPage + 1}">Next →</a>
			{/if}
		</p>
	{/if}
{/if}
