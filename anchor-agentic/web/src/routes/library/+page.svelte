<script lang="ts">
	import type { LibraryItem, LibraryItemType } from '$lib/api/types';
	import { STATUS_STYLE } from '$lib/statusStyle';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let showArchived = $state(false);

	const DETAIL_ROUTE: Record<LibraryItemType, string> = {
		ROLE: '/roles',
		TASK: '/tasks',
		AGENT: '/agents',
		SKILL: '/skills',
		WORKFLOW: '/workflows'
	};

	const TYPE_LABEL: Record<LibraryItemType, string> = {
		ROLE: 'Roles',
		TASK: 'Tasks',
		AGENT: 'Agents',
		SKILL: 'Skills',
		WORKFLOW: 'Workflows'
	};

	const ORDER: LibraryItemType[] = ['ROLE', 'TASK', 'AGENT', 'SKILL', 'WORKFLOW'];

	function displayName(item: LibraryItem) {
		return item.item_type === 'AGENT' ? `Agent for ${item.name}` : item.name;
	}

	let visibleItems = $derived(data.items.filter((item) => showArchived || item.status !== 'Archived'));
	let grouped = $derived(
		ORDER.map((type) => ({
			type,
			items: visibleItems.filter((item: LibraryItem) => item.item_type === type)
		})).filter((group) => group.items.length > 0)
	);
</script>

<h1 class="text-2xl">My Sandbox</h1>
<p class="mt-1 text-ink/70">Your personal, version-controlled workspace — edit freely, publish when ready.</p>

<label class="mt-4 flex items-center gap-2 text-sm text-ink/70">
	<input type="checkbox" bind:checked={showArchived} />
	Show archived
</label>

{#if data.items.length === 0}
	<p class="mt-6 text-ink/70">You haven't created anything yet.</p>
	<p class="mt-2 flex flex-wrap gap-2 text-sm">
		<a class="rounded-md border border-ink/15 px-3 py-1.5 no-underline" href="/roles/new">+ New Role</a>
		<a class="rounded-md border border-ink/15 px-3 py-1.5 no-underline" href="/agents/new">+ New Agent</a>
		<a class="rounded-md border border-ink/15 px-3 py-1.5 no-underline" href="/skills/new">+ New Skill</a>
		<a class="rounded-md border border-ink/15 px-3 py-1.5 no-underline" href="/workflows/new"
			>+ New Workflow</a
		>
	</p>
{:else if grouped.length === 0}
	<p class="mt-6 text-ink/70">No items to show. Uncheck "show archived" or create something new.</p>
{:else}
	{#each grouped as group (group.type)}
		<h2 class="mt-8 text-lg">{TYPE_LABEL[group.type]}</h2>
		<ul class="mt-2 flex flex-col gap-2">
			{#each group.items as item (item.id)}
				<li class="flex items-center gap-2 rounded-md border border-ink/10 p-3">
					<a class="font-semibold" href="{DETAIL_ROUTE[item.item_type]}/{item.id}"
						>{displayName(item)}</a
					>
					<span class="rounded-full px-2 py-0.5 text-xs {STATUS_STYLE[item.status]}"
						>[{item.status}]</span
					>
				</li>
			{/each}
		</ul>
	{/each}
{/if}

<p class="mt-8 text-sm"><a href="/library/all">View All Sandbox</a></p>
