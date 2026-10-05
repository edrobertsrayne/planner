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

	// Create account is the page (story 120). Restore from a Backup hides behind the line under
	// the card (story 121), because the common path is a new planner, not a move from one.
	let showRestore = $state(false);
	// An upload is in flight, as distinct from the Restore form being open.
	let restoring = $state(false);
	let restoreError = $state('');

	// The file itself is the request body, so the browser streams it from disk and the server
	// streams it to disk: a Backup with a great many Attachments is never held in memory.
	async function restore(event: SubmitEvent) {
		event.preventDefault();
		if (restoring) return;
		const file = new FormData(event.currentTarget as HTMLFormElement).get('backup');
		if (!(file instanceof File) || file.size === 0) {
			restoreError = 'Choose a Backup file.';
			return;
		}

		restoring = true;
		restoreError = '';
		try {
			// Manual: once an account exists the guard redirects this request, and following the
			// redirect would show the login page's 200 as if the Restore had worked.
			const response = await fetch('/setup/restore', {
				method: 'POST',
				body: file,
				redirect: 'manual'
			});
			if (response.type === 'opaqueredirect') {
				restoreError = 'This planner already has an account, so nothing was restored.';
			} else if (response.ok) {
				window.location.assign('/login');
				return;
			} else {
				restoreError = await failureMessage(response);
			}
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

	// One alert serves both forms: whichever form is on the card owns the error shown above it.
	const activeError = $derived(showRestore ? restoreError : form?.error);
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

<main
	class="flex min-h-svh flex-col items-center gap-6 p-4 pt-10 sm:justify-center sm:bg-muted sm:p-6 md:p-10"
>
	<div class="flex w-full max-w-sm flex-col gap-6">
		<div class="flex items-center gap-2 self-center font-medium">
			<div
				class="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"
			>
				<CalendarDaysIcon class="size-4" />
			</div>
			<span class="text-sm font-semibold tracking-tight">Planner</span>
		</div>

		<!-- Below `sm` the card loses its frame and the page its centring and backdrop (story
		     122), as Login's does: on a phone the form starts at the top. -->
		<Card.Root class="max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none max-sm:ring-0">
			<Card.Header class="text-center max-sm:px-0">
				<Card.Title class="text-xl">
					{showRestore ? 'Restore from a Backup' : 'Set up Planner'}
				</Card.Title>
			</Card.Header>
			<Card.Content class="flex flex-col gap-6 max-sm:px-0">
				{#if activeError}
					<Alert.Root variant="destructive">
						<Alert.Description>{activeError}</Alert.Description>
					</Alert.Root>
				{/if}

				{#if showRestore}
					<form onsubmit={restore}>
						<Field.FieldGroup>
							<Field.Field>
								<Field.FieldLabel for="backup">Backup file</Field.FieldLabel>
								<Input id="backup" type="file" name="backup" accept=".tar" required />
								<!-- The instructions sit under the file field (story 121), not in a card
								     description: the swap line under the card already names the move. -->
								<Field.FieldDescription>
									Choose the file that Back up saved there. You sign in with the password from that
									planner.
								</Field.FieldDescription>
							</Field.Field>

							<Button type="submit" variant="outline" class="w-full" disabled={restoring}>
								{restoring ? 'Restoring…' : 'Restore'}
							</Button>
						</Field.FieldGroup>
					</form>
				{:else}
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
				{/if}
			</Card.Content>
		</Card.Root>

		<p class="text-center text-sm text-muted-foreground">
			{#if showRestore}
				<Button variant="link" onclick={() => (showRestore = false)}>
					Set up a new planner instead
				</Button>
			{:else}
				Moving from another planner?
				<Button variant="link" onclick={() => (showRestore = true)}>Restore from a Backup</Button>
			{/if}
		</p>

		<BuildInfo class="text-center" />
	</div>
</main>
