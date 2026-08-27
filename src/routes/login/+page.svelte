<script lang="ts">
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import BuildInfo from '$lib/components/build-info.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>Log in</title></svelte:head>

<main class="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
	<div class="flex w-full max-w-sm flex-col gap-6">
		<div class="flex items-center gap-2 self-center font-medium">
			<div
				class="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"
			>
				<CalendarDaysIcon class="size-4" />
			</div>
			<span class="text-sm font-semibold tracking-tight">Planner</span>
		</div>

		<Card.Root>
			<Card.Header class="text-center">
				<Card.Title class="text-xl">Log in</Card.Title>
			</Card.Header>
			<Card.Content class="flex flex-col gap-6">
				{#if form?.error}
					<Alert.Root variant="destructive">
						<Alert.Description>{form.error}</Alert.Description>
					</Alert.Root>
				{/if}

				<form method="POST">
					<Field.FieldGroup>
						<Field.Field data-invalid={form?.error ? true : undefined}>
							<Field.FieldLabel for="email">Email</Field.FieldLabel>
							<Input
								id="email"
								type="email"
								name="email"
								value={form?.email ?? ''}
								required
								aria-invalid={form?.error ? 'true' : undefined}
							/>
						</Field.Field>

						<Field.Field data-invalid={form?.error ? true : undefined}>
							<Field.FieldLabel for="password">Password</Field.FieldLabel>
							<Input
								id="password"
								type="password"
								name="password"
								required
								aria-invalid={form?.error ? 'true' : undefined}
							/>
						</Field.Field>

						<Button type="submit" class="w-full">Log in</Button>
					</Field.FieldGroup>
				</form>
			</Card.Content>
		</Card.Root>

		<BuildInfo class="text-center" />
	</div>
</main>
