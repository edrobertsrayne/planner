<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { toast } from '$lib/ui/toast';
	import { failureReason } from '$lib/client/enhance';
	import * as Card from '$lib/ui/card';
	import * as Field from '$lib/ui/field';
	import { Button, Input } from '$lib/ui';
	import * as Dialog from '$lib/ui/dialog';
	import { formatSize } from '$lib/format-size';
	import PageHeader from '$lib/components/page-header.svelte';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CheckIcon from '@lucide/svelte/icons/check';
	import RefreshIcon from '@lucide/svelte/icons/refresh-cw';

	let { data } = $props();

	let pending = $state(false);
	let invalidField = $state<string>();
	let regenerating = $state(false);
	let confirmOpen = $state(false);
	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	const onsubmit: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			if (result.type === 'failure') {
				invalidField = typeof result.data?.field === 'string' ? result.data.field : undefined;
				toast.error(failureReason(result, ''));
			} else if (result.type === 'success') {
				invalidField = undefined;
				toast.success('Password changed.');
			}
			await update();
		};
	};

	const onRegenerateKey: SubmitFunction = () => {
		regenerating = true;
		confirmOpen = false;
		return async ({ result, update }) => {
			regenerating = false;
			if (result.type === 'success') {
				copied = false;
				toast.success('API key regenerated. The old key no longer works.');
			} else if (result.type === 'failure') {
				toast.error(failureReason(result, ''));
			}
			await update();
		};
	};

	async function copyKey() {
		await navigator.clipboard.writeText(data.key.token);
		copied = true;
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copied = false), 1800);
		toast.success('API key copied.');
	}
</script>

<div class="mx-auto max-w-6xl px-6 py-6">
	<PageHeader title="Settings" />

	<!-- From `lg` Change password stands beside API key and Backup (stories 118–119); below it
	     the cards fall back into one column. -->
	<div class="grid gap-6 lg:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>Change password</Card.Title>
				<Card.Description>
					There is no reset by email. If you forget it, run <code
						class="rounded bg-muted px-1 py-0.5 font-mono text-xs">npm run reset:credentials</code
					> on the server.
				</Card.Description>
			</Card.Header>

			<form method="POST" action="?/changePassword" use:enhance={onsubmit}>
				<Card.Content>
					<Field.Group>
						<Field.Root data-invalid={invalidField === 'currentPassword' || undefined}>
							<Field.Label for="current">Current password</Field.Label>
							<Input
								id="current"
								name="currentPassword"
								type="password"
								autocomplete="current-password"
								required
								aria-invalid={invalidField === 'currentPassword' || undefined}
							/>
						</Field.Root>

						<Field.Root data-invalid={invalidField === 'newPassword' || undefined}>
							<Field.Label for="new">New password</Field.Label>
							<Input
								id="new"
								name="newPassword"
								type="password"
								autocomplete="new-password"
								required
								aria-invalid={invalidField === 'newPassword' || undefined}
							/>
							<Field.Description>At least {data.minPasswordLength} characters.</Field.Description>
						</Field.Root>

						<Field.Root data-invalid={invalidField === 'confirmPassword' || undefined}>
							<Field.Label for="confirm">Confirm new password</Field.Label>
							<Input
								id="confirm"
								name="confirmPassword"
								type="password"
								autocomplete="new-password"
								required
								aria-invalid={invalidField === 'confirmPassword' || undefined}
							/>
						</Field.Root>
					</Field.Group>
				</Card.Content>

				<Card.Footer class="flex-wrap items-center justify-between gap-3">
					<p class="text-xs text-muted-foreground">Logs out every other device.</p>
					<Button type="submit" disabled={pending}>
						{pending ? 'Changing…' : 'Change password'}
					</Button>
				</Card.Footer>
			</form>
		</Card.Root>

		<!-- API key and Backup share the right column from `lg`; the wrappers vanish below it,
		     where the grid's own gap keeps the cards apart. -->
		<div class="flex min-w-0 flex-col gap-6 max-lg:contents">
			<Card.Root>
				<Card.Header>
					<Card.Title>API key</Card.Title>
					<Card.Description>
						Lets an agent read and write your Courses, Topics, Lessons and Links. Regenerating
						replaces it: the old key stops working at once.
					</Card.Description>
				</Card.Header>

				<Card.Content>
					<div class="flex items-center gap-2">
						<Input
							readonly
							value={data.key.token}
							aria-label="API key"
							class="flex-1 font-mono text-sm"
							onfocus={(e) => e.currentTarget.select()}
						/>
						<Button
							type="button"
							variant="outline"
							size="icon"
							class="size-8 shrink-0"
							title="Copy key"
							aria-label="Copy key"
							onclick={copyKey}
						>
							{#if copied}<CheckIcon />{:else}<CopyIcon />{/if}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="icon"
							class="size-8 shrink-0"
							title="Regenerate key"
							aria-label="Regenerate key"
							disabled={regenerating}
							onclick={() => (confirmOpen = true)}
						>
							<RefreshIcon class={regenerating ? 'animate-spin' : undefined} />
						</Button>
					</div>

					<p class="mt-2 text-xs text-muted-foreground">
						Created {new Date(data.key.createdAt).toLocaleDateString()}
						{#if data.key.lastUsedAt}
							&middot; Last used {new Date(data.key.lastUsedAt).toLocaleDateString()}
						{:else}
							&middot; Never used
						{/if}
					</p>
				</Card.Content>
			</Card.Root>

			<Card.Root>
				<Card.Header>
					<Card.Title>Backup</Card.Title>
					<Card.Description>
						Saves everything in the planner to one file: every record and every Attachment. Restore
						it into a new planner from the setup screen.
					</Card.Description>
				</Card.Header>

				<Card.Content>
					<p class="text-xs text-muted-foreground">
						Expected size: up to {formatSize(data.backupSize)}.
					</p>
					<p class="text-xs text-muted-foreground">
						The file holds your login and API key. Keep it secret.
					</p>
				</Card.Content>

				<Card.Footer class="justify-end">
					<Button href="/backup" download data-sveltekit-reload>Back up</Button>
				</Card.Footer>
			</Card.Root>
		</div>
	</div>

	<Dialog.Root bind:open={confirmOpen}>
		<Dialog.Content class="sm:max-w-md">
			<Dialog.Header>
				<Dialog.Title>Regenerate the API key?</Dialog.Title>
				<Dialog.Description>
					The key you have now stops working at once. Every agent holding it must be given the new
					one. This cannot be undone.
				</Dialog.Description>
			</Dialog.Header>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (confirmOpen = false)}>Cancel</Button>
				<form method="POST" action="?/regenerateKey" use:enhance={onRegenerateKey}>
					<Button type="submit" variant="destructive">Regenerate</Button>
				</form>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
</div>
