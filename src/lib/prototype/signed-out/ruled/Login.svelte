<!-- PROTOTYPE — variant A "Ruled" / login -->
<script lang="ts">
	import Sheet from './Sheet.svelte';
	import Field from './Field.svelte';
	let { form }: { form?: { error?: string; email?: string } | null } = $props();
</script>

<Sheet title="Log in">
	{#snippet margin()}
		One account.<br />No sign-up.
	{/snippet}

	<form method="POST" class="mt-2">
		<Field
			label="Email"
			name="email"
			type="email"
			value={form?.email ?? ''}
			autocomplete="username"
		/>
		<Field label="Password" name="password" type="password" autocomplete="current-password" />

		{#if form?.error}
			<p
				role="alert"
				class="mt-5 border-l-2 border-[var(--margin)] pl-3 text-sm text-[var(--margin)]"
			>
				{form.error}
			</p>
		{/if}

		<button
			type="submit"
			class="mt-8 w-full rounded-[2px] bg-[var(--ink)] px-4 py-3 font-mono text-[0.6875rem] tracking-[0.16em] text-[var(--paper)] uppercase transition-colors hover:bg-[var(--accent)]"
		>
			Log in
		</button>
	</form>
</Sheet>
