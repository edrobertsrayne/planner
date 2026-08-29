<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { toast } from 'svelte-sonner';
	import { failureReason } from '$lib/client/enhance';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import PageHeader from '$lib/components/page-header.svelte';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CheckIcon from '@lucide/svelte/icons/check';
	import RefreshIcon from '@lucide/svelte/icons/refresh-cw';
	import ToastMessage from './ToastMessage.svelte';

	let { data } = $props();

	let pending = $state(false);
	let invalid = $state(false);
	let regenerating = $state(false);
	let confirmOpen = $state(false);
	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	const onsubmit: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			pending = false;
			if (result.type === 'failure') {
				invalid = true;
				toast.error(ToastMessage, {
					componentProps: { text: failureReason(result, ''), role: 'alert' }
				});
			} else if (result.type === 'success') {
				invalid = false;
				toast.success(ToastMessage, {
					componentProps: { text: 'Password changed.', role: 'status' }
				});
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
				toast.success(ToastMessage, {
					componentProps: {
						text: 'API key regenerated. The old key no longer works.',
						role: 'status'
					}
				});
			} else if (result.type === 'failure') {
				toast.error(ToastMessage, {
					componentProps: { text: failureReason(result, ''), role: 'alert' }
				});
			}
			await update();
		};
	};

	async function copyKey() {
		await navigator.clipboard.writeText(data.key.token);
		copied = true;
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copied = false), 1800);
		toast.success(ToastMessage, {
			componentProps: { text: 'API key copied.', role: 'status' }
		});
	}
</script>

<div class="mx-auto max-w-xl px-6 py-8">
	<PageHeader title="Settings" description="This planner has one account." />

	<Card.Root>
		<Card.Header>
			<Card.Title>Change password</Card.Title>
			<Card.Description>
				There is no reset by email. If you forget it, run <code
					class="rounded bg-muted px-1 py-0.5 font-mono text-xs">bun run reset:credentials</code
				> on the server.
			</Card.Description>
		</Card.Header>

		<form method="POST" action="?/changePassword" use:enhance={onsubmit}>
			<Card.Content>
				<Field.Group>
					<Field.Field data-invalid={invalid || undefined}>
						<Field.Label for="current">Current password</Field.Label>
						<Input
							id="current"
							name="currentPassword"
							type="password"
							autocomplete="current-password"
							required
							class="h-7"
							aria-invalid={invalid || undefined}
						/>
					</Field.Field>

					<Field.Field>
						<Field.Label for="new">New password</Field.Label>
						<Input
							id="new"
							name="newPassword"
							type="password"
							autocomplete="new-password"
							required
							class="h-7"
						/>
						<Field.Description>At least 12 characters.</Field.Description>
					</Field.Field>

					<Field.Field>
						<Field.Label for="confirm">Confirm new password</Field.Label>
						<Input
							id="confirm"
							name="confirmPassword"
							type="password"
							autocomplete="new-password"
							required
							class="h-7"
						/>
					</Field.Field>
				</Field.Group>
			</Card.Content>

			<Card.Footer class="flex-wrap items-center justify-between gap-3">
				<p class="text-xs text-muted-foreground">Logs out every other device.</p>
				<Button type="submit" size="sm" class="h-7" disabled={pending}>
					{pending ? 'Changing…' : 'Change password'}
				</Button>
			</Card.Footer>
		</form>
	</Card.Root>

	<Card.Root class="mt-8">
		<Card.Header>
			<Card.Title>API key</Card.Title>
			<Card.Description>
				Lets an agent read and write your Courses, Topics, Lessons and Links. Regenerating replaces
				it: the old key stops working at once.
			</Card.Description>
		</Card.Header>

		<Card.Content>
			<div class="flex items-center gap-2">
				<Input
					readonly
					value={data.key.token}
					aria-label="API key"
					class="h-8 flex-1 font-mono text-xs"
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
				<Button variant="outline" size="sm" class="h-7" onclick={() => (confirmOpen = false)}>
					Cancel
				</Button>
				<form method="POST" action="?/regenerateKey" use:enhance={onRegenerateKey}>
					<Button type="submit" variant="destructive" size="sm" class="h-7">Regenerate</Button>
				</form>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
</div>
