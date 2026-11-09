<script lang="ts">
	import * as Alert from '$lib/ui/alert';
	import { Button, Input } from '$lib/ui';
	import * as Card from '$lib/ui/card';
	import * as Field from '$lib/ui/field';
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
</script>

<svelte:head><title>Set up Planner</title></svelte:head>

<main
	class="flex min-h-svh flex-col items-center gap-6 p-4 pt-10 sm:justify-center sm:bg-muted sm:p-6 md:p-10"
>
	<div class="flex w-full max-w-sm flex-col gap-6">
		<span class="self-center text-2xl font-bold tracking-tight">Planner</span>

		<!-- Below `sm` the card loses its frame and the page its centring and backdrop (story
		     122), as Login's does: on a phone the form starts at the top. -->
		<Card.Root class="max-sm:border-0 max-sm:bg-transparent max-sm:p-0">
			<Card.Header class="text-center">
				<Card.Title class="text-xl">
					{showRestore ? 'Restore from a Backup' : 'Set up Planner'}
				</Card.Title>
			</Card.Header>
			<Card.Content class="flex flex-col gap-6">
				{#if activeError}
					<Alert.Root variant="destructive">
						<Alert.Description>{activeError}</Alert.Description>
					</Alert.Root>
				{/if}

				{#if showRestore}
					<form onsubmit={restore}>
						<Field.Group>
							<Field.Root>
								<Field.Label for="backup">Backup file</Field.Label>
								<Input id="backup" type="file" name="backup" accept=".tar" required />
								<!-- The instructions sit under the file field (story 121), not in a card
								     description: the swap line under the card already names the move. -->
								<Field.Description>
									Choose the file that Back up saved there. You sign in with the password from that
									planner.
								</Field.Description>
							</Field.Root>

							<Button type="submit" variant="outline" class="w-full" disabled={restoring}>
								{restoring ? 'Restoring…' : 'Restore'}
							</Button>
						</Field.Group>
					</form>
				{:else}
					<form method="POST">
						<Field.Group>
							<Field.Root data-invalid={form?.field === 'name' || undefined}>
								<Field.Label for="name">Name</Field.Label>
								<Input
									id="name"
									type="text"
									name="name"
									value={form?.name ?? ''}
									required
									aria-invalid={form?.field === 'name' || undefined}
								/>
							</Field.Root>

							<Field.Root data-invalid={form?.field === 'email' || undefined}>
								<Field.Label for="email">Email</Field.Label>
								<Input
									id="email"
									type="email"
									name="email"
									value={form?.email ?? ''}
									required
									aria-invalid={form?.field === 'email' || undefined}
								/>
							</Field.Root>

							<Field.Root data-invalid={form?.field === 'password' || undefined}>
								<Field.Label for="password">Password</Field.Label>
								<Input
									id="password"
									type="password"
									name="password"
									autocomplete="new-password"
									required
									aria-invalid={form?.field === 'password' || undefined}
								/>
								<Field.Description>
									There is no password reset by email — keep it somewhere safe.
								</Field.Description>
							</Field.Root>

							<Field.Root data-invalid={form?.field === 'confirmPassword' || undefined}>
								<Field.Label for="confirmPassword">Confirm password</Field.Label>
								<Input
									id="confirmPassword"
									type="password"
									name="confirmPassword"
									autocomplete="new-password"
									required
									aria-invalid={form?.field === 'confirmPassword' || undefined}
								/>
							</Field.Root>

							<Button type="submit" class="w-full">Create account</Button>
						</Field.Group>
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
