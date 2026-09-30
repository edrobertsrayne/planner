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

	let restoring = $state(false);
	let restoreError = $state('');

	// The file itself is the request body, so the browser streams it from disk and the server
	// streams it to disk: a Backup with a great many Attachments is never held in memory.
	async function restore(event: SubmitEvent) {
		event.preventDefault();
		const file = new FormData(event.currentTarget as HTMLFormElement).get('backup');
		if (!(file instanceof File) || file.size === 0) {
			restoreError = 'Choose a Backup file.';
			return;
		}

		restoring = true;
		restoreError = '';
		try {
			const response = await fetch('/setup/restore', { method: 'POST', body: file });
			if (response.ok) {
				window.location.assign('/login');
				return;
			}
			restoreError = await failureMessage(response);
		} catch {
			restoreError = 'The upload did not reach the server. Check your connection and try again.';
		}
		restoring = false;
	}

	async function failureMessage(response: Response) {
		if (response.status === 413) {
			return 'A proxy in front of the planner refused a file this large. Reach the planner directly, or raise the proxy limit.';
		}
		try {
			return (await response.json()).error ?? 'The Restore failed.';
		} catch {
			return 'The Restore failed.';
		}
	}

	const isNameInvalid = $derived(
		Boolean(form?.error === 'Name and email are required.' && !form.name)
	);
	const isEmailInvalid = $derived(
		Boolean(form?.error === 'Name and email are required.' && !form.email)
	);
	const isPasswordInvalid = $derived(
		Boolean(
			form?.error &&
			(form.error.includes('least') || form.error === 'The two passwords do not match.')
		)
	);
	const isConfirmPasswordInvalid = $derived(
		Boolean(form?.error === 'The two passwords do not match.')
	);
</script>

<svelte:head><title>Set up Planner</title></svelte:head>

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
				<Card.Title class="text-xl">Set up Planner</Card.Title>
			</Card.Header>
			<Card.Content class="flex flex-col gap-6">
				{#if form?.error}
					<Alert.Root variant="destructive">
						<Alert.Description>{form.error}</Alert.Description>
					</Alert.Root>
				{/if}

				<form method="POST">
					<Field.FieldGroup>
						<Field.Field data-invalid={isNameInvalid ? true : undefined}>
							<Field.FieldLabel for="name">Name</Field.FieldLabel>
							<Input
								id="name"
								type="text"
								name="name"
								value={form?.name ?? ''}
								required
								aria-invalid={isNameInvalid ? 'true' : undefined}
							/>
						</Field.Field>

						<Field.Field data-invalid={isEmailInvalid ? true : undefined}>
							<Field.FieldLabel for="email">Email</Field.FieldLabel>
							<Input
								id="email"
								type="email"
								name="email"
								value={form?.email ?? ''}
								required
								aria-invalid={isEmailInvalid ? 'true' : undefined}
							/>
						</Field.Field>

						<Field.Field data-invalid={isPasswordInvalid ? true : undefined}>
							<Field.FieldLabel for="password">Password</Field.FieldLabel>
							<Input
								id="password"
								type="password"
								name="password"
								autocomplete="new-password"
								required
								aria-invalid={isPasswordInvalid ? 'true' : undefined}
							/>
							<Field.FieldDescription>
								There is no password reset by email — keep it somewhere safe.
							</Field.FieldDescription>
						</Field.Field>

						<Field.Field data-invalid={isConfirmPasswordInvalid ? true : undefined}>
							<Field.FieldLabel for="confirmPassword">Confirm password</Field.FieldLabel>
							<Input
								id="confirmPassword"
								type="password"
								name="confirmPassword"
								autocomplete="new-password"
								required
								aria-invalid={isConfirmPasswordInvalid ? 'true' : undefined}
							/>
						</Field.Field>

						<Button type="submit" class="w-full">Create account</Button>
					</Field.FieldGroup>
				</form>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="text-center">
				<Card.Title class="text-xl">Restore from a Backup</Card.Title>
				<Card.Description>
					Moving from another planner? Choose the file that Back up saved there. You sign in with
					the password from that planner.
				</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-6">
				{#if restoreError}
					<Alert.Root variant="destructive">
						<Alert.Description>{restoreError}</Alert.Description>
					</Alert.Root>
				{/if}

				<form onsubmit={restore}>
					<Field.FieldGroup>
						<Field.Field>
							<Field.FieldLabel for="backup">Backup file</Field.FieldLabel>
							<Input id="backup" type="file" name="backup" accept=".tar" required />
						</Field.Field>

						<Button type="submit" variant="outline" class="w-full" disabled={restoring}>
							{restoring ? 'Restoring…' : 'Restore'}
						</Button>
					</Field.FieldGroup>
				</form>
			</Card.Content>
		</Card.Root>

		<BuildInfo class="text-center" />
	</div>
</main>
