<script lang="ts">
	import { resolve } from '$app/paths';
	import { pageTitle } from '$lib/pageTitle';
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>{pageTitle('All Generic Sandbox Items')}</title></svelte:head>

<h1>All Generic Sandbox Items</h1>
<p>Every registered user's items are listed here. You can only edit items you own.</p>

{#if form?.error}
	<p role="alert">{form.error}</p>
{/if}

{#if data.items.length === 0}
	<p>No sandbox items exist yet.</p>
{:else}
	<ul>
		{#each data.items as item (item.id)}
			<li>
				{item.title} ({item.status}) — owner: {item.owner_id}
				{#if item.owner_id !== data.user?.id}
					<form method="POST" action="?/attemptUpdate" use:enhance style="display:inline">
						<input type="hidden" name="id" value={item.id} />
						<input type="hidden" name="title" value={`${item.title} (edited)`} />
						<button type="submit">Try editing (expect forbidden)</button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<p><a href={resolve('/sandbox')}>Back to My Sandbox</a></p>
