<!-- PROTOTYPE — variant B field: filled, dense, 40px — mira's h-7 raised to a thumb-sized target. -->
<script lang="ts">
	let {
		label,
		name,
		type = 'text',
		value = $bindable(''),
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

<div class="pt-4">
	<label class="mb-1.5 block text-xs font-medium tracking-wide text-[var(--muted)]" for="f-{name}">
		{label}
	</label>
	{#if type === 'password'}
		<input
			id="f-{name}"
			{name}
			type="password"
			{autocomplete}
			bind:value
			required
			class="h-10 w-full rounded-sm border border-[var(--line)] bg-black/25 px-3 text-sm transition-colors outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/25"
		/>
	{:else}
		<input
			id="f-{name}"
			{name}
			{type}
			{autocomplete}
			bind:value
			required
			class="h-10 w-full rounded-sm border border-[var(--line)] bg-black/25 px-3 text-sm transition-colors outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/25"
		/>
	{/if}
	{#if hint}
		<p class="mt-1.5 text-[0.6875rem] leading-snug text-[var(--muted)]">{hint}</p>
	{/if}
</div>
