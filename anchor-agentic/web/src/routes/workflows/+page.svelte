<script lang="ts">
	import { STATUS_STYLE } from '$lib/statusStyle';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<h1 class="text-2xl">Workflows</h1>
<p class="mt-2">
	<a class="rounded-md border border-ink/15 px-3 py-1.5 no-underline" href="/workflows/new"
		>+ New Workflow</a
	>
</p>

{#if data.workflows.length === 0}
	<p class="mt-6 text-ink/70">You haven't created any Workflows yet.</p>
{:else}
	<ul class="mt-6 flex flex-col gap-2">
		{#each data.workflows as workflow (workflow.id)}
			<li class="flex items-center gap-2 rounded-md border border-ink/10 p-3">
				<a class="font-semibold" href="/workflows/{workflow.id}">{workflow.name}</a>
				<span class="rounded-full px-2 py-0.5 text-xs {STATUS_STYLE[workflow.status]}"
					>{workflow.status}</span
				>
				<span class="text-sm text-ink/60">v{workflow.current_version}</span>
			</li>
		{/each}
	</ul>
{/if}
