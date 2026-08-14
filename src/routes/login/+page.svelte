<script lang="ts">
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<main>
	<h1>Log in</h1>

	<form method="POST">
		<label>
			Email
			<input type="email" name="email" value={form?.email ?? ''} required />
		</label>

		<label>
			Password
			<input type="password" name="password" required />
		</label>

		{#if form?.error}
			<p role="alert">{form.error}</p>
		{/if}

		<button type="submit">Log in</button>
	</form>
</main>
