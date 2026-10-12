<script lang="ts">
	import { pageTitle } from '$lib/pageTitle';
	import { enhance } from '$app/forms';
</script>

<svelte:head><title>{pageTitle('Log out')}</title></svelte:head>

<h1>Log out</h1>
<form method="POST" use:enhance>
	<button type="submit">Confirm log out</button>
</form>
