<script lang="ts">
	let { missing }: { missing: string[] } = $props();
</script>

{#if missing.length > 0}
	<p
		role="status"
		class="mt-4 rounded-md border-l-4 border-attention bg-surface px-4 py-3 text-ink"
	>
		Could not load {missing.join(' and ')} right now. Reload the page to try again.
	</p>
{/if}
