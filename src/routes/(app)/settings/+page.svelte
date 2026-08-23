<script lang="ts">
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<main class="mx-auto max-w-2xl px-6 py-8">
	<h1 class="text-lg font-semibold tracking-tight">Settings</h1>

	<h2 class="mt-6 text-sm font-medium">Change password</h2>
	<p class="mt-1 text-sm text-neutral-500">
		Changing your password logs out every other device. If you have forgotten it, there is no reset
		by email — run <code>bun run reset:credentials</code> on the server.
	</p>

	<form method="POST" action="?/changePassword" class="mt-4 flex flex-col gap-3">
		<label class="flex flex-col gap-1 text-sm">
			Current password
			<input
				type="password"
				name="currentPassword"
				autocomplete="current-password"
				required
				class="rounded border border-neutral-300 px-2 py-1"
			/>
		</label>

		<label class="flex flex-col gap-1 text-sm">
			New password
			<input
				type="password"
				name="newPassword"
				autocomplete="new-password"
				required
				class="rounded border border-neutral-300 px-2 py-1"
			/>
		</label>

		<label class="flex flex-col gap-1 text-sm">
			Confirm new password
			<input
				type="password"
				name="confirmPassword"
				autocomplete="new-password"
				required
				class="rounded border border-neutral-300 px-2 py-1"
			/>
		</label>

		{#if form?.error}
			<p role="alert" class="text-sm text-red-700">{form.error}</p>
		{:else if form?.success}
			<p role="status" class="text-sm text-green-700">Password changed.</p>
		{/if}

		<button
			type="submit"
			class="self-start rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white"
			>Change password</button
		>
	</form>
</main>
