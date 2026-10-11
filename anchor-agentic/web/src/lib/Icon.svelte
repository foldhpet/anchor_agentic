<script lang="ts">
	import { ICONS, type IconName } from './icons';

	// Functional icon (US-054). Always place it beside the text that names the same state or action;
	// it is decorative to assistive tech and never part of an accessible name.
	let { name, class: className = '' }: { name: IconName; class?: string } = $props();

	const shape = $derived(ICONS[name]);
</script>

<svg
	class="inline-block size-[1em] shrink-0 align-[-0.125em] {className}"
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.5"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	{#each shape.paths as d, i (i)}
		<path {d} stroke-dasharray={i === 0 ? shape.dash : undefined} />
	{/each}
</svg>
