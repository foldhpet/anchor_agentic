<script lang="ts">
	import { resolve } from '$app/paths';
	import { pageTitle } from '$lib/pageTitle';
</script>

<svelte:head><title>{pageTitle('Demo')}</title></svelte:head>

<a href={resolve('/demo/playwright')}>playwright</a>
