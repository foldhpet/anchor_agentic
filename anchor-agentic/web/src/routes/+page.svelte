<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$lib/Icon.svelte';
	import type { MarketplaceItemType } from '$lib/api/types';
	import {
		describeFilters,
		itemCount,
		isPastLastPage,
		listQuery,
		pageCount,
		typeLabel
	} from '$lib/marketplaceList';
	import { marketplaceTitle } from '$lib/pageTitle';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function displayName(item: { item_type: MarketplaceItemType; name: string | null }) {
		return item.item_type === 'AGENT' ? `Agent for ${item.name}` : item.name;
	}

	let totalPages = $derived(pageCount(data.total, data.pageSize));
	let pastEnd = $derived(isPastLastPage(data.items.length, data.total));
	let filters = $derived(describeFilters(data));

	// Link to another page of the same list (page 1 omits the page parameter). resolve() accepts a
	// route with a query string, and its ResolvedPathname result is what no-navigation-without-resolve wants.
	function pageHref(page: number) {
		const query = listQuery({ q: data.q, type: data.type, role: data.role, page });
		return query ? resolve(`/?${query}` as const) : resolve('/');
	}
</script>

<svelte:head><title>{marketplaceTitle(data.q, data.page)}</title></svelte:head>

<h1 class="text-2xl">Marketplace</h1>
<p class="mt-1 text-ink/75">Browse published Agents, Skills, and Workflows from the community.</p>

<form method="GET" class="mt-6 flex flex-wrap items-end gap-4 rounded-md bg-surface p-4">
	<label class="flex flex-col gap-1 text-sm">
		Search
		<input
			type="search"
			name="q"
			value={data.q}
			placeholder="Search by name or description..."
			class="rounded-md border border-ink/15 bg-bg px-3 py-1.5"
		/>
	</label>
	<label class="flex flex-col gap-1 text-sm">
		Type
		<select name="type" class="rounded-md border border-ink/15 bg-bg px-3 py-1.5">
			<option value="" selected={data.type === ''}>All types</option>
			{#each ['AGENT', 'SKILL', 'WORKFLOW'] as type (type)}
				<option value={type} selected={data.type === type}>{typeLabel(type)}</option>
			{/each}
		</select>
	</label>
	<label class="flex flex-col gap-1 text-sm">
		Role
		<input
			type="text"
			name="role"
			value={data.role}
			placeholder="Filter Agents by Role..."
			class="rounded-md border border-ink/15 bg-bg px-3 py-1.5"
		/>
	</label>
	<button type="submit" class="rounded-md bg-primary px-4 py-1.5 text-white">Search</button>
</form>

{#if pastEnd}
	<p class="mt-6 text-ink/75">
		There is no page {data.page}. {filters ? `Results for ${filters}` : 'The Marketplace'}
		{totalPages === 1 ? 'fit on one page' : `have ${totalPages} pages`}.
		<a href={pageHref(1)}>Go to the first page</a>
		{#if totalPages > 1}
			<a href={pageHref(totalPages)}>Go to the last page</a>
		{/if}
	</p>
{:else if data.items.length === 0}
	{#if filters}
		<p class="mt-6 text-ink/75">
			No items match {filters}.
			<a href={resolve('/')}>Clear filters</a>
		</p>
	{:else}
		<p class="mt-6 text-ink/75">No published items yet. Check back soon.</p>
	{/if}
{:else}
	<p class="mt-6 text-sm text-ink/75">
		{itemCount(data.total)}{filters ? ` matching ${filters}` : ''}
	</p>
	<ul class="mt-3 flex flex-col gap-3">
		{#each data.items as item (`${item.item_type}-${item.id}`)}
			<li class="rounded-md border border-ink/10 p-4">
				<div class="flex items-center gap-2">
					<a
						class="font-semibold"
						href={resolve('/marketplace/[itemType]/[id]', {
							itemType: item.item_type,
							id: item.id
						})}>{displayName(item)}</a
					>
					<span class="rounded-full bg-surface px-2 py-0.5 text-xs text-ink/75"
						>{item.item_type}</span
					>
				</div>
				{#if item.description}<p class="mt-1 text-ink/80">{item.description}</p>{/if}
				<p class="mt-2 text-sm text-ink/75">
					{#if item.rating_count === 0}
						Not yet rated
					{:else}
						Rating: {item.rating?.toFixed(1)}/5 ({item.rating_count} rating{item.rating_count === 1
							? ''
							: 's'})
					{/if}
					· Cloned {item.clone_count} times
				</p>
			</li>
		{/each}
	</ul>
{/if}

{#if totalPages > 1 && !pastEnd}
	<nav aria-label="Marketplace pages" class="mt-6 flex items-center gap-3 text-sm text-ink/75">
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
	</nav>
{/if}
