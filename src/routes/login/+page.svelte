<script lang="ts">
	import * as Alert from '$lib/ui/alert';
	import { Button, Input } from '$lib/ui';
	import * as Card from '$lib/ui/card';
	import * as Field from '$lib/ui/field';
	import BuildInfo from '$lib/components/build-info.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>Log in</title></svelte:head>

<main
	class="flex min-h-svh flex-col items-center gap-6 p-4 pt-10 sm:justify-center sm:bg-muted sm:p-6 md:p-10"
>
	<div class="flex w-full max-w-sm flex-col gap-6">
		<span class="self-center text-2xl font-bold tracking-tight">Planner</span>

		<!-- Below `sm` the card loses its frame and the page its centring and backdrop (story
		     122): on a phone the form starts at the top, so the keyboard does not push it about. -->
		<Card.Root class="max-sm:border-0 max-sm:bg-transparent max-sm:p-0">
			<Card.Header>
				<Card.Title class="text-2xl leading-8">Log in</Card.Title>
			</Card.Header>
			<Card.Content class="flex flex-col gap-6">
				{#if form?.error}
					<Alert.Root variant="destructive">
						<Alert.Description>{form.error}</Alert.Description>
					</Alert.Root>
				{/if}

				<form method="POST">
					<Field.Group>
						<Field.Root data-invalid={form?.error ? true : undefined}>
							<Field.Label for="email">Email</Field.Label>
							<Input
								id="email"
								type="email"
								name="email"
								value={form?.email ?? ''}
								required
								aria-invalid={form?.error ? 'true' : undefined}
							/>
						</Field.Root>

						<Field.Root data-invalid={form?.error ? true : undefined}>
							<Field.Label for="password">Password</Field.Label>
							<Input
								id="password"
								type="password"
								name="password"
								required
								aria-invalid={form?.error ? 'true' : undefined}
							/>
						</Field.Root>

						<Button type="submit" class="w-full">Log in</Button>
					</Field.Group>
				</form>
			</Card.Content>
		</Card.Root>

		<BuildInfo class="text-center" />
	</div>
</main>
