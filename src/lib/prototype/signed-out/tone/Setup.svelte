<!-- PROTOTYPE — variant C "Tone" / setup, one screen. -->
<script lang="ts">
	import Split from './Split.svelte';
	import Field from './Field.svelte';
	let { form }: { form?: { error?: string; name?: string; email?: string } | null } = $props();
</script>

<Split
	title="Set up Planner"
	lead="This planner has one account — yours. Choose the details you will log in with."
>
	<form method="POST">
		<Field label="Name" name="name" value={form?.name ?? ''} autocomplete="name" />
		<Field
			label="Email"
			name="email"
			type="email"
			value={form?.email ?? ''}
			autocomplete="username"
		/>
		<Field
			label="Password"
			name="password"
			type="password"
			autocomplete="new-password"
			hint="Keep this somewhere safe — Planner cannot email you a reset link."
		/>
		<Field
			label="Confirm password"
			name="confirmPassword"
			type="password"
			autocomplete="new-password"
		/>

		{#if form?.error}
			<p role="alert" class="mt-4 rounded-lg bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
				{form.error}
			</p>
		{/if}

		<button
			type="submit"
			class="mt-7 h-11 w-full rounded-lg bg-[var(--ink)] text-sm font-semibold text-white transition-opacity hover:opacity-90"
		>
			Create account
		</button>
	</form>
</Split>
