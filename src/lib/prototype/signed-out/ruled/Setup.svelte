<!-- PROTOTYPE — variant A "Ruled" / setup. One screen: a paper form is one page. -->
<script lang="ts">
	import Sheet from './Sheet.svelte';
	import Field from './Field.svelte';
	let { form }: { form?: { error?: string; name?: string; email?: string } | null } = $props();
</script>

<Sheet title="Set up Planner">
	{#snippet margin()}
		Keep these<br />somewhere safe.<br /><br />There is no<br />reset by email.
	{/snippet}

	<p class="mt-3 max-w-prose font-serif text-[1.0625rem] leading-relaxed text-[var(--muted)]">
		This planner has one account. Choose the details you will log in with.
	</p>

	<form method="POST" class="mt-2">
		<Field label="Name" name="name" value={form?.name ?? ''} autocomplete="name" />
		<Field
			label="Email"
			name="email"
			type="email"
			value={form?.email ?? ''}
			autocomplete="username"
		/>
		<Field label="Password" name="password" type="password" autocomplete="new-password" />
		<Field
			label="Confirm password"
			name="confirmPassword"
			type="password"
			autocomplete="new-password"
		/>

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
			Create account
		</button>
	</form>
</Sheet>
