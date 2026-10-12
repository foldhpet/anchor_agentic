<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { pageTitle } from '$lib/pageTitle';

	// Only the status picks the wording: the raw error message or stack is never shown.
	let notFound = $derived(page.status === 404);
	let heading = $derived(notFound ? 'Page not found' : 'Something went wrong');
</script>

<svelte:head><title>{pageTitle(heading)}</title></svelte:head>

<h1 class="text-2xl">{heading}</h1>
<p class="mt-2 text-ink/75">
	{#if notFound}
		We couldn't find that page. This item may have been removed or unpublished.
	{:else}
		Something went wrong on our side. Please try again in a moment.
	{/if}
</p>
<p class="mt-4 flex gap-4 text-sm">
	<a href={resolve('/')}>Go to the Marketplace</a>
	<a href={resolve('/login')}>Log in</a>
</p>
