<script lang="ts">
	import type { DomainStatus } from './api/types';
	import Icon from './Icon.svelte';
	import { STATUS_STYLE } from './statusStyle';

	// The icon half of a lifecycle badge (US-054). The badge keeps its own text; this is decorative.
	let { status }: { status: DomainStatus } = $props();
</script>

<Icon name={STATUS_STYLE[status].icon} class={STATUS_STYLE[status].iconClass} />
