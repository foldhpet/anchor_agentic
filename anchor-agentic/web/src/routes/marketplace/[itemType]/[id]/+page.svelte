<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let displayName = $derived(
		data.itemType === 'AGENT' ? `Agent for ${data.item.role_name}` : data.item.name
	);
</script>

<h1 class="text-2xl">{displayName}</h1>
<p class="mt-1 flex items-center gap-2 text-sm">
	<a href="/">&larr; Back to Marketplace</a>
	<span class="rounded-full bg-surface px-2 py-0.5 text-xs text-ink/70">[{data.itemType}]</span>
</p>

{#if form?.error}
	<p role="alert" class="mt-4 rounded-md border-l-4 border-attention bg-surface px-4 py-3 text-ink">
		{form.error}
	</p>
{/if}
{#if form?.reported}
	<p role="status" class="mt-4 rounded-md border-l-4 border-caution bg-surface px-4 py-3 text-ink">
		Report submitted — thank you. This item is now pending review.
	</p>
{/if}

{#if data.item.description}<p class="mt-4 text-ink/80">{data.item.description}</p>{/if}

<p class="mt-4 text-sm text-ink/70">Published version: v{data.item.published_version}</p>
{#if data.item.rating_count === 0}
	<p class="mt-1 text-sm text-ink/70">Not yet rated</p>
{:else}
	<p class="mt-1 text-sm text-ink/70">
		Rating: {data.item.rating?.toFixed(1)}/5 ({data.item.rating_count} rating{data.item.rating_count ===
		1
			? ''
			: 's'})
	</p>
{/if}

{#if data.isRegistered}
	<form method="POST" action="?/rate" use:enhance class="mt-3 flex items-end gap-3">
		<label class="flex flex-col gap-1 text-sm">
			Your rating:
			<select name="score" class="rounded-md border border-ink/15 bg-bg px-3 py-1.5">
				{#each [1, 2, 3, 4, 5] as value (value)}
					<option value={value} selected={data.myRating === value}>{value}</option>
				{/each}
			</select>
		</label>
		<button type="submit" class="rounded-md bg-primary px-4 py-1.5 text-white">Rate</button>
	</form>
{/if}

{#if data.provenance}
	<p class="mt-4 text-sm text-ink/70">
		Cloned from
		{#if data.provenance.source_name}
			{data.provenance.source_name}
		{:else}
			a since-removed item
		{/if}
	</p>
{/if}

{#if data.isRegistered}
	<form method="POST" action="?/clone" use:enhance class="mt-4">
		<button type="submit" class="rounded-md bg-primary px-4 py-1.5 text-white"
			>Clone into My Sandbox</button
		>
	</form>
{/if}

<p class="mt-4 text-sm text-ink/70">Cloned {data.item.clone_count} times</p>

<h2 class="mt-8 text-lg">Report this item</h2>
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
		<textarea name="detail" maxlength="2000" class="rounded-md border border-ink/15 bg-bg px-3 py-1.5"
		></textarea>
	</label>
	<button type="submit" class="self-start rounded-md border border-attention px-4 py-1.5 text-sm text-ink"
		>Report</button
	>
</form>

{#if data.itemType === 'AGENT'}
	<h2 class="mt-8 text-lg">Task Assignments</h2>
	{#if !data.assignments || data.assignments.length === 0}
		<p class="mt-2 text-ink/70">No Tasks assigned.</p>
	{:else}
		<ul class="mt-2 flex flex-col gap-2">
			{#each data.assignments as assignment (assignment.id)}
				<li class="rounded-md border border-ink/10 p-3">{assignment.tasks?.name ?? assignment.task_id}</li>
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
