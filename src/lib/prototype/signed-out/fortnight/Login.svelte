<!-- PROTOTYPE — variant B "Fortnight" / login -->
<script lang="ts">
	import Frame from './Frame.svelte';
	import Field from './Field.svelte';
	let { form }: { form?: { error?: string; email?: string } | null } = $props();
</script>

<Frame>
	<h1 class="text-xl font-semibold tracking-tight">Log in</h1>
	<p class="mt-1 text-xs text-[var(--muted)]">Week B · Autumn 1</p>

	<form method="POST" class="mt-3">
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
				class="mt-4 rounded-sm border-l-2 border-red-400 bg-red-500/10 px-3 py-2 text-xs text-red-300"
			>
				{form.error}
			</p>
		{/if}

		<button
			type="submit"
			class="mt-6 h-10 w-full rounded-sm bg-[var(--accent)] text-sm font-semibold text-black transition-opacity hover:opacity-90"
		>
			Log in
		</button>
	</form>
</Frame>
