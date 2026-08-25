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

	let pending = $state(false);
	let invalid = $state(false);

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
</div>
