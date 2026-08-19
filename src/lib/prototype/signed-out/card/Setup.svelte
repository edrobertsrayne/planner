<!-- PROTOTYPE — variant A / setup. One screen; the no-reset warning is a Field.Description under
     the password, as settled on #56. -->
<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Field from '$lib/components/ui/field';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import Wordmark from '../Wordmark.svelte';

	let { form }: { form?: { error?: string; name?: string; email?: string } | null } = $props();
	const invalid = $derived(form?.error ? true : undefined);
</script>

<div class="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
	<div class="flex w-full max-w-sm flex-col gap-6">
		<Wordmark />

		<Card.Root>
			<Card.Header class="text-center">
				<Card.Title class="text-xl">Set up Planner</Card.Title>
				<Card.Description
					>This planner has one account. Choose the details you will log in with.</Card.Description
				>
			</Card.Header>
			<Card.Content>
				<form method="POST">
					<Field.Group>
						<Field.Field>
							<Field.Label for="name">Name</Field.Label>
							<Input
								id="name"
								name="name"
								type="text"
								value={form?.name ?? ''}
								autocomplete="name"
								required
							/>
						</Field.Field>

						<Field.Field>
							<Field.Label for="email">Email</Field.Label>
							<Input
								id="email"
								name="email"
								type="email"
								value={form?.email ?? ''}
								autocomplete="username"
								required
							/>
						</Field.Field>

						<Field.Field data-invalid={invalid}>
							<Field.Label for="password">Password</Field.Label>
							<Input
								id="password"
								name="password"
								type="password"
								autocomplete="new-password"
								aria-invalid={invalid}
								required
							/>
							<Field.Description>
								At least 12 characters. Keep it somewhere safe — Planner cannot email you a reset
								link.
							</Field.Description>
						</Field.Field>

						<Field.Field data-invalid={invalid}>
							<Field.Label for="confirmPassword">Confirm password</Field.Label>
							<Input
								id="confirmPassword"
								name="confirmPassword"
								type="password"
								autocomplete="new-password"
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
							<Button type="submit">Create account</Button>
						</Field.Field>
					</Field.Group>
				</form>
			</Card.Content>
		</Card.Root>
	</div>
</div>
