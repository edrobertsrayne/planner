<!-- PROTOTYPE — variant A field: no box, a ruled underline, printed-form label. -->
<script lang="ts">
	let {
		label,
		name,
		type = 'text',
		value = '',
		autocomplete,
		hint
	}: {
		label: string;
		name: string;
		type?: string;
		value?: string;
		autocomplete?: import('svelte/elements').FullAutoFill;
		hint?: string;
	} = $props();
</script>

<div class="pt-6">
	<label
		class="block font-mono text-[0.625rem] tracking-[0.16em] text-[var(--muted)] uppercase"
		for="r-{name}"
	>
		{label}
	</label>
	<input
		id="r-{name}"
		{name}
		{type}
		{value}
		{autocomplete}
		required
		class="mt-1 w-full border-0 border-b border-[var(--rule)] bg-transparent py-2 font-serif text-lg outline-none focus:border-b-2 focus:border-[var(--accent)] focus:pb-[calc(0.5rem-1px)]"
	/>
	{#if hint}
		<p class="mt-1.5 text-xs text-[var(--muted)]">{hint}</p>
	{/if}
</div>
