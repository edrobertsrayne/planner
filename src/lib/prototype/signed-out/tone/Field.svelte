<!-- PROTOTYPE — variant C field: 44px, rounded, bordered. Generous by default. -->
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

<div class="pt-5">
	<label class="mb-1.5 block text-sm font-medium" for="t-{name}">{label}</label>
	<input
		id="t-{name}"
		{name}
		{type}
		{value}
		{autocomplete}
		required
		class="h-11 w-full rounded-lg border border-[var(--line)] bg-white px-3.5 text-[0.9375rem] transition-shadow outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15"
	/>
	{#if hint}
		<p class="mt-1.5 text-xs leading-snug text-[var(--muted)]">{hint}</p>
	{/if}
</div>
