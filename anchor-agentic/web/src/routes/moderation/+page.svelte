<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<h1 class="text-2xl">Moderation Queue</h1>

{#if form?.error}
	<p role="alert" class="mt-4 rounded-md border-l-4 border-attention bg-surface px-4 py-3 text-ink">
		{form.error}
	</p>
{/if}

{#if data.queue.length === 0}
	<p class="mt-6 text-ink/70">Nothing is currently under review.</p>
{:else}
	<ul class="mt-6 flex flex-col gap-4">
		{#each data.queue as item (item.item_type + item.id)}
			<li class="rounded-md border border-ink/10 p-4">
				<h2 class="text-lg">
					<span class="rounded-full bg-surface px-2 py-0.5 text-xs text-ink/70">[{item.item_type}]</span>
					{item.name ?? item.id}
				</h2>
				{#if item.description}<p class="mt-2 text-ink/80">{item.description}</p>{/if}
				{#if item.system_prompt}<pre
						class="mt-2 overflow-x-auto rounded-md bg-surface p-3 text-xs">{item.system_prompt}</pre
					>{/if}

				{#if item.reports.length === 0}
					<p class="mt-2 text-sm text-ink/60"><em>Voluntary review request (US-044).</em></p>
					<form method="POST" action="?/approve" use:enhance class="mt-3 inline-block">
						<input type="hidden" name="item_type" value={item.item_type} />
						<input type="hidden" name="id" value={item.id} />
						<button type="submit" class="rounded-md bg-primary px-3 py-1.5 text-sm text-white"
							>Approve</button
						>
					</form>
					<form method="POST" action="?/reject" use:enhance class="mt-3 flex flex-col gap-3">
						<input type="hidden" name="item_type" value={item.item_type} />
						<input type="hidden" name="id" value={item.id} />
						<label class="flex flex-col gap-1 text-sm">
							Feedback:
							<textarea name="feedback" class="rounded-md border border-ink/15 bg-bg px-3 py-1.5"
							></textarea>
						</label>
						<button
							type="submit"
							class="self-start rounded-md border border-attention px-3 py-1.5 text-sm text-ink"
							>Reject</button
						>
					</form>
				{:else}
					<h3 class="mt-4 text-base font-semibold">Reports</h3>
					<ul class="mt-2 flex flex-col gap-2">
						{#each item.reports as report (report.id)}
							<li class="flex items-center gap-2 rounded-md bg-surface px-3 py-2 text-sm">
								<span>[{report.reason}]{#if report.detail} {report.detail}{/if}</span>
								<form method="POST" action="?/dismiss" use:enhance style="display:inline">
									<input type="hidden" name="report_id" value={report.id} />
									<button type="submit" class="rounded-md border border-ink/15 px-2 py-1 text-xs"
										>Dismiss report</button
									>
								</form>
							</li>
						{/each}
					</ul>
					<form method="POST" action="?/remove" use:enhance class="mt-3">
						<input type="hidden" name="item_type" value={item.item_type} />
						<input type="hidden" name="id" value={item.id} />
						<button type="submit" class="rounded-md border border-attention px-3 py-1.5 text-sm text-ink"
							>Remove (terminal)</button
						>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
