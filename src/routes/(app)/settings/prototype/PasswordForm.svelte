<!-- PROTOTYPE ONLY (issue #314). The Change password fields; the write is a stub. -->
<script lang="ts">
	import * as Field from '$lib/components/ui/field/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { COPY, stub } from './parts';

	let { id = 'pw' }: { id?: string } = $props();
	const input = 'h-8 max-md:h-11';
</script>

<form onsubmit={stub} class="flex flex-col gap-4">
	<Field.Group>
		<Field.Field>
			<Field.Label for="{id}-current">Current password</Field.Label>
			<Input
				id="{id}-current"
				type="password"
				autocomplete="current-password"
				required
				class={input}
			/>
		</Field.Field>
		<Field.Field>
			<Field.Label for="{id}-new">New password</Field.Label>
			<Input id="{id}-new" type="password" autocomplete="new-password" required class={input} />
			<Field.Description>At least 12 characters.</Field.Description>
		</Field.Field>
		<Field.Field>
			<Field.Label for="{id}-confirm">Confirm new password</Field.Label>
			<Input id="{id}-confirm" type="password" autocomplete="new-password" required class={input} />
		</Field.Field>
	</Field.Group>
	<div class="flex flex-wrap items-center justify-between gap-3">
		<p class="text-xs text-muted-foreground">{COPY.password.footer}</p>
		<Button type="submit" size="sm" class="h-8 max-md:h-11">Change password</Button>
	</div>
</form>
