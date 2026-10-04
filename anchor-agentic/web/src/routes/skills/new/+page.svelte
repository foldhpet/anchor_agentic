<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let files = $state<{ path: string; content: string }[]>([{ path: '', content: '' }]);

	function addFile() {
		files.push({ path: '', content: '' });
	}

	function removeFile(index: number) {
		files.splice(index, 1);
	}
</script>

<h1 class="text-2xl">New Skill</h1>

{#if form?.error}
	<p role="alert" class="mt-4 rounded-md border-l-4 border-attention bg-surface px-4 py-3 text-ink">
		{form.error}
	</p>
{/if}

<form method="POST" action="?/create" use:enhance class="mt-6 flex max-w-lg flex-col gap-4">
	<label class="flex flex-col gap-1 text-sm">
		Name
		<input name="name" required class="rounded-md border border-ink/15 bg-bg px-3 py-1.5" />
	</label>
	<label class="flex flex-col gap-1 text-sm">
		Description
		<input name="description" class="rounded-md border border-ink/15 bg-bg px-3 py-1.5" />
	</label>

	<h2 class="mt-2 text-lg">Skill files</h2>
	{#each files as file, index (index)}
		<fieldset class="flex flex-col gap-3 rounded-md border border-ink/10 p-3">
			<label class="flex flex-col gap-1 text-sm">
				Path
				<input
					bind:value={file.path}
					placeholder="SKILL.md"
					class="rounded-md border border-ink/15 bg-bg px-3 py-1.5"
				/>
			</label>
			<label class="flex flex-col gap-1 text-sm">
				Content
				<textarea bind:value={file.content} class="rounded-md border border-ink/15 bg-bg px-3 py-1.5"
				></textarea>
			</label>
			<button
				type="button"
				onclick={() => removeFile(index)}
				class="self-start rounded-md border border-attention px-3 py-1.5 text-sm text-ink"
				>Remove file</button
			>
		</fieldset>
	{/each}
	<button type="button" onclick={addFile} class="self-start rounded-md border border-ink/15 px-3 py-1.5 text-sm"
		>+ Add file</button
	>

	<input type="hidden" name="skill_files" value={JSON.stringify(files)} />
	<button type="submit" class="self-start rounded-md bg-primary px-4 py-1.5 text-white"
		>Create Skill</button
	>
</form>
