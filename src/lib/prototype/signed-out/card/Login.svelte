<!-- PROTOTYPE — variant A, the signup-03 shape: wordmark lockup above a centred Card on bg-muted. -->
<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Field from '$lib/components/ui/field';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import Wordmark from '../Wordmark.svelte';

	let { form }: { form?: { error?: string; email?: string } | null } = $props();
</script>

<div class="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
	<div class="flex w-full max-w-sm flex-col gap-6">
		<Wordmark />

		<Card.Root>
			<Card.Header class="text-center">
				<Card.Title class="text-xl">Log in</Card.Title>
				<Card.Description>Enter the details you set up this planner with</Card.Description>
			</Card.Header>
			<Card.Content>
				<form method="POST">
					<Field.Group>
						<Field.Field data-invalid={form?.error ? true : undefined}>
							<Field.Label for="email">Email</Field.Label>
							<Input
								id="email"
								name="email"
								type="email"
								value={form?.email ?? ''}
								autocomplete="username"
								aria-invalid={form?.error ? true : undefined}
								required
							/>
						</Field.Field>

						<Field.Field data-invalid={form?.error ? true : undefined}>
							<Field.Label for="password">Password</Field.Label>
							<Input
								id="password"
								name="password"
								type="password"
								autocomplete="current-password"
								aria-invalid={form?.error ? true : undefined}
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
			</Card.Content>
		</Card.Root>
	</div>
</div>
