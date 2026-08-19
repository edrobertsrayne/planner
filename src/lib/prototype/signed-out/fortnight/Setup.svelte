<!-- PROTOTYPE — variant B "Fortnight" / setup, stepped. Progress is a period row: three cells,
     the current one filled. Inactive steps stay in the DOM (focusable) so one POST carries all. -->
<script lang="ts">
	import Frame from './Frame.svelte';
	import Field from './Field.svelte';

	let { form }: { form?: { error?: string; name?: string; email?: string } | null } = $props();

	const STEPS = ['You', 'Sign-in', 'Confirm'] as const;
	let step = $state(0);

	// eslint-disable-next-line svelte/prefer-writable-derived -- prototype: seed once from the failed POST
	let name = $state(form?.name ?? '');
	let email = $state(form?.email ?? '');
	let password = $state('');
	let confirmPassword = $state('');

	const canAdvance = $derived(
		step === 0 ? name.trim().length > 0 : step === 1 ? email.trim().length > 0 : true
	);
	const off = 'pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0';
</script>

<Frame>
	<!-- the progress row, drawn as periods -->
	<div class="mb-5 grid grid-cols-3 gap-px bg-[var(--line)]">
		{#each STEPS as label, i (label)}
			<div
				class="px-2 py-1.5 text-center font-mono text-[0.5625rem] tracking-[0.14em] uppercase transition-colors"
				style={i === step
					? 'background: oklch(0.8 0.155 78); color: #000'
					: i < step
						? 'background: oklch(0.29 0.03 255); color: oklch(0.8 0.155 78)'
						: 'background: oklch(0.235 0.016 255); color: oklch(0.55 0.012 255)'}
			>
				{label}
			</div>
		{/each}
	</div>

	<h1 class="text-xl font-semibold tracking-tight">
		{['Who is this planner for?', 'How will you log in?', 'Check and confirm'][step]}
	</h1>

	<form method="POST" class="mt-1">
		<div class={step === 0 ? '' : off}>
			<Field label="Name" name="name" bind:value={name} autocomplete="name" />
		</div>

		<div class={step === 1 ? '' : off}>
			<Field label="Email" name="email" type="email" bind:value={email} autocomplete="username" />
			<Field
				label="Password"
				name="password"
				type="password"
				bind:value={password}
				autocomplete="new-password"
			/>
			<Field
				label="Confirm password"
				name="confirmPassword"
				type="password"
				bind:value={confirmPassword}
				autocomplete="new-password"
			/>
		</div>

		<div class={step === 2 ? '' : off}>
			<dl class="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)] text-sm">
				<div class="flex justify-between py-2">
					<dt class="text-[var(--muted)]">Name</dt>
					<dd>{name || '—'}</dd>
				</div>
				<div class="flex justify-between py-2">
					<dt class="text-[var(--muted)]">Email</dt>
					<dd>{email || '—'}</dd>
				</div>
				<div class="flex justify-between py-2">
					<dt class="text-[var(--muted)]">Password</dt>
					<dd>{password ? '••••••••' : '—'}</dd>
				</div>
			</dl>
			<div class="mt-4 border-l-2 border-[var(--accent)] bg-[var(--accent)]/10 px-3 py-2.5">
				<p class="text-xs font-medium text-[var(--accent)]">
					Write these down before you continue.
				</p>
				<p class="mt-1 text-[0.6875rem] leading-snug text-[var(--muted)]">
					Planner cannot email you a reset link. If you lose the password, you lose the account.
				</p>
			</div>
		</div>

		{#if form?.error}
			<p
				role="alert"
				class="mt-4 rounded-sm border-l-2 border-red-400 bg-red-500/10 px-3 py-2 text-xs text-red-300"
			>
				{form.error}
			</p>
		{/if}

		<div class="mt-6 flex gap-2">
			{#if step > 0}
				<button
					type="button"
					onclick={() => (step -= 1)}
					class="h-10 rounded-sm border border-[var(--line)] px-4 text-sm hover:bg-white/5"
				>
					Back
				</button>
			{/if}
			{#if step < STEPS.length - 1}
				<button
					type="button"
					disabled={!canAdvance}
					onclick={() => (step += 1)}
					class="h-10 flex-1 rounded-sm bg-[var(--accent)] text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
				>
					Continue
				</button>
			{:else}
				<button
					type="submit"
					class="h-10 flex-1 rounded-sm bg-[var(--accent)] text-sm font-semibold text-black transition-opacity hover:opacity-90"
				>
					Create account
				</button>
			{/if}
		</div>
	</form>
</Frame>
