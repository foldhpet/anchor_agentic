<script lang="ts">
	import { searchWith } from '$lib/searchWith';
	import { detailHref } from '$lib/detailHref';
	import { resolve } from '$app/paths';
	import { pageTitle } from '$lib/pageTitle';
	import Icon from '$lib/Icon.svelte';
	import type { LibraryItemType } from '$lib/api/types';
	import { STATUS_STYLE } from '$lib/statusStyle';
	import ClonedTag from '$lib/ClonedTag.svelte';
	import StatusIcon from '$lib/StatusIcon.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function displayName(item: { item_type: LibraryItemType; name: string }) {
		return item.item_type === 'AGENT' ? `Agent for ${item.name}` : item.name;
	}

	let totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));
	// Previous/next page of the same search.
	function pageHref(page: number) {
		const query = searchWith(new URLSearchParams(), { q: data.q, type: data.type, page });
		return resolve(`/library/all?${query}` as const);
	}
</script>

<svelte:head><title>{pageTitle('All Sandbox')}</title></svelte:head>

<h1 class="text-2xl">All Sandbox</h1>
<p class="mt-1 text-ink/75">
	Read-only — everyone's in-progress work, across all users. Clone a published item from the
	Marketplace to edit your own copy.
</p>

<form method="GET" class="mt-6 flex flex-wrap items-end gap-4 rounded-md bg-surface p-4">
	<label class="flex flex-col gap-1 text-sm">
		Search
		<input
			type="search"
			name="q"
			value={data.q}
			placeholder="Search by name..."
			class="rounded-md border border-ink/15 bg-bg px-3 py-1.5"
		/>
	</label>
	<label class="flex flex-col gap-1 text-sm">
		Type
		<select name="type" class="rounded-md border border-ink/15 bg-bg px-3 py-1.5">
			<option value="" selected={data.type === ''}>All types</option>
			{#each ['ROLE', 'TASK', 'AGENT', 'SKILL', 'WORKFLOW'] as type (type)}
				<option value={type} selected={data.type === type}>{type}</option>
			{/each}
		</select>
	</label>
	<button type="submit" class="rounded-md bg-primary px-4 py-1.5 text-white">Search</button>
</form>

{#if data.items.length === 0}
	<p class="mt-6 text-ink/75">No items match your search.</p>
{:else}
	<ul class="mt-6 flex flex-col gap-2">
		{#each data.items as item (item.id)}
			<li class="flex items-center gap-2 rounded-md border border-ink/10 p-3">
				<a class="font-semibold" href={detailHref(item.item_type, item.id, 'all')}
					>{displayName(item)}</a
				>
				<span class="rounded-full bg-surface px-2 py-0.5 text-xs text-ink/75"
					>[{item.item_type}]</span
				>
				<span
					class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs {STATUS_STYLE[
						item.status
					].classes}"><StatusIcon status={item.status} />[{item.status}]</span
				>
				{#if item.cloned}
					<ClonedTag />
				{/if}
			</li>
		{/each}
	</ul>
{/if}

{#if totalPages > 1}
	<p class="mt-6 flex items-center gap-3 text-sm text-ink/75">
		Page {data.page} of {totalPages}
		{#if data.page > 1}
			<a class="inline-flex items-center gap-1" href={pageHref(data.page - 1)}
				><Icon name="previous" />Prev</a
			>
		{/if}
		{#if data.page < totalPages}
			<a class="inline-flex items-center gap-1" href={pageHref(data.page + 1)}
				>Next<Icon name="next" /></a
			>
		{/if}
	</p>
{/if}

<p class="mt-8 text-sm"><a href={resolve('/library')}>← Back to My Sandbox</a></p>
