<!-- PROTOTYPE — variant B, the signup-05 shape: no card, stacked lockup, form directly on
     bg-background. The social buttons and "already have an account" link are dropped — this
     planner has one account and no third-party sign-in. -->
<script lang="ts">
	import * as Field from '$lib/components/ui/field';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import Wordmark from '../Wordmark.svelte';

	let { form }: { form?: { error?: string; email?: string } | null } = $props();
	const invalid = $derived(form?.error ? true : undefined);
</script>

<div class="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
	<div class="w-full max-w-sm">
		<form method="POST">
			<Field.Group>
				<div class="flex flex-col items-center gap-2 text-center">
					<Wordmark stacked />
					<h1 class="text-xl font-bold">Log in to Planner</h1>
					<Field.Description>Enter the details you set up this planner with</Field.Description>
				</div>

				<Field.Field data-invalid={invalid}>
					<Field.Label for="email">Email</Field.Label>
					<Input
						id="email"
						name="email"
						type="email"
						value={form?.email ?? ''}
						autocomplete="username"
						aria-invalid={invalid}
						required
					/>
				</Field.Field>

				<Field.Field data-invalid={invalid}>
					<Field.Label for="password">Password</Field.Label>
					<Input
						id="password"
						name="password"
						type="password"
						autocomplete="current-password"
						aria-invalid={invalid}
						required
					/>
				</Field.Field>

				{#if form?.error}
					<Alert.Root variant="destructive">
						<Alert.Description>{form.error}</Alert.Description>
					</Alert.Root>
				{/if}

				<Field.Field>
					<Button type="submit">Log in</Button>
				</Field.Field>
			</Field.Group>
		</form>
	</div>
</div>
