<!--
	PROTOTYPE ONLY (issue #306): a name you rename in place. The pencil shows on hover from
	tablet up; a phone never shows it, because nothing on Courses is written there.
-->
<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import { Input } from '$lib/components/ui/input/index.js';

	let {
		value,
		onsave,
		class: className = '',
		inputClass = 'h-8'
	}: { value: string; onsave: (v: string) => void; class?: string; inputClass?: string } = $props();

	let editing = $state(false);

	function commit(e: Event) {
		const v = (e.currentTarget as HTMLInputElement).value.trim();
		if (v) onsave(v);
		editing = false;
	}
</script>

{#if editing}
	<Input
		autofocus
		class={inputClass}
		{value}
		onblur={commit}
		onkeydown={(e) => {
			if (e.key === 'Enter') commit(e);
			if (e.key === 'Escape') editing = false;
		}}
	/>
{:else}
	<span class="group/name inline-flex max-w-full items-baseline gap-1.5">
		<span class="min-w-0 {className}">{value}</span>
		<button
			type="button"
			class="shrink-0 self-center rounded p-1 text-muted-foreground opacity-0 group-hover/name:opacity-100 hover:bg-muted hover:text-foreground focus:opacity-100 max-md:hidden"
			aria-label="Rename {value}"
			onclick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				editing = true;
			}}
		>
			<PencilIcon class="size-3.5" />
		</button>
	</span>
{/if}
