<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { toast } from 'svelte-sonner';
	import { failureReason } from '$lib/client/enhance';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import PageHeader from '$lib/components/page-header.svelte';
	import ToastMessage from './ToastMessage.svelte';

	let { data } = $props();

	let pending = $state(false);
	let invalid = $state(false);
	let generating = $state(false);
	let newToken = $state<string | null>(null);

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

	const onGenerateKey: SubmitFunction = () => {
		generating = true;
		return async ({ result, update }) => {
			generating = false;
			if (result.type === 'success' && result.data?.token) {
				newToken = result.data.token as string;
				toast.success(ToastMessage, {
					componentProps: { text: 'API key generated.', role: 'status' }
				});
			} else if (result.type === 'failure') {
				toast.error(ToastMessage, {
					componentProps: { text: failureReason(result, ''), role: 'alert' }
				});
			}
			await update();
		};
	};

	function dismissToken() {
		newToken = null;
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
				An agent that can read and write your Courses, Topics, Lessons and Links. The key is shown
				once and never again. Regenerating replaces it: the old token stops working at once.
			</Card.Description>
		</Card.Header>

		<Card.Content>
			{#if data.key}
				<div class="mb-4 rounded-md border px-3 py-2 text-sm">
					<p class="text-xs text-muted-foreground">
						Created {new Date(data.key.createdAt).toLocaleDateString()}
						{#if data.key.lastUsedAt}
							&middot; Last used {new Date(data.key.lastUsedAt).toLocaleDateString()}
						{/if}
					</p>
				</div>
			{/if}

			{#if newToken}
				<div
					class="mb-4 rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm dark:bg-amber-950/20"
				>
					<p class="mb-1 font-medium text-amber-800 dark:text-amber-300">New key</p>
					<code class="block rounded bg-background px-2 py-1 font-mono text-xs break-all"
						>{newToken}</code
					>
					<p class="mt-1 text-xs text-amber-600 dark:text-amber-400">
						This is the only time it is shown. Copy it now.
					</p>
				</div>
				<Button size="sm" variant="outline" class="mb-4 h-7 text-xs" onclick={dismissToken}>
					Dismiss
				</Button>
			{/if}

			<form method="POST" action="?/generateKey" use:enhance={onGenerateKey}>
				<Button type="submit" size="sm" class="h-7" disabled={generating}>
					{generating ? 'Generating…' : data.key ? 'Regenerate' : 'Generate'}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
