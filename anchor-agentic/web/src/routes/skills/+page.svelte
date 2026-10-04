<script lang="ts">
	import { STATUS_STYLE } from '$lib/statusStyle';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<h1 class="text-2xl">Skills</h1>
<p class="mt-2">
	<a class="rounded-md border border-ink/15 px-3 py-1.5 no-underline" href="/skills/new"
		>+ New Skill</a
	>
</p>

{#if data.skills.length === 0}
	<p class="mt-6 text-ink/70">You haven't created any Skills yet.</p>
{:else}
	<ul class="mt-6 flex flex-col gap-2">
		{#each data.skills as skill (skill.id)}
			<li class="flex items-center gap-2 rounded-md border border-ink/10 p-3">
				<a class="font-semibold" href="/skills/{skill.id}">{skill.name}</a>
				<span class="rounded-full px-2 py-0.5 text-xs {STATUS_STYLE[skill.status]}">{skill.status}</span>
				<span class="text-sm text-ink/60">v{skill.current_version}</span>
			</li>
		{/each}
	</ul>
{/if}
