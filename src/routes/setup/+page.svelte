<script lang="ts">
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<main>
	<h1>Set up Planner</h1>

	<p>
		This planner has one account. Choose the details you will log in with — there is no password
		reset by email, so keep them somewhere safe.
	</p>

	<form method="POST">
		<label>
			Name
			<input type="text" name="name" value={form?.name ?? ''} required />
		</label>

		<label>
			Email
			<input type="email" name="email" value={form?.email ?? ''} required />
		</label>

		<label>
			Password
			<input type="password" name="password" autocomplete="new-password" required />
		</label>

		<label>
			Confirm password
			<input type="password" name="confirmPassword" autocomplete="new-password" required />
		</label>

		{#if form?.error}
			<p role="alert">{form.error}</p>
		{/if}

		<button type="submit">Create account</button>
	</form>
</main>
