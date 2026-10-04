<script lang="ts">
	import type { MarketplaceItemType } from '$lib/api/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function displayName(item: { item_type: MarketplaceItemType; name: string | null }) {
		return item.item_type === 'AGENT' ? `Agent for ${item.name}` : item.name;
	}

	let totalPages = $derived(Math.max(1, Math.ceil(data.total / data.pageSize)));
</script>

<h1 class="text-2xl">Marketplace</h1>
<p class="mt-1 text-ink/70">Browse published Agents, Skills, and Workflows from the community.</p>

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
				<option value={type} selected={data.type === type}>{type}</option>
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

{#if data.items.length === 0}
	<p class="mt-6 text-ink/70">No published items yet. Check back soon.</p>
{:else}
	<ul class="mt-6 flex flex-col gap-3">
		{#each data.items as item (`${item.item_type}-${item.id}`)}
			<li class="rounded-md border border-ink/10 p-4">
				<div class="flex items-center gap-2">
					<a class="font-semibold" href="/marketplace/{item.item_type}/{item.id}"
						>{displayName(item)}</a
					>
					<span class="rounded-full bg-surface px-2 py-0.5 text-xs text-ink/70">{item.item_type}</span>
				</div>
				{#if item.description}<p class="mt-1 text-ink/80">{item.description}</p>{/if}
				<p class="mt-2 text-sm text-ink/60">
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

{#if totalPages > 1}
	<p class="mt-6 flex items-center gap-3 text-sm text-ink/70">
		Page {data.page} of {totalPages}
		{#if data.page > 1}
			<a href="?q={data.q}&type={data.type}&role={data.role}&page={data.page - 1}">← Prev</a>
		{/if}
		{#if data.page < totalPages}
			<a href="?q={data.q}&type={data.type}&role={data.role}&page={data.page + 1}">Next →</a>
		{/if}
	</p>
{/if}
