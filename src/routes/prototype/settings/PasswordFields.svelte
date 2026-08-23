<!--
	PROTOTYPE — throwaway. The three fields themselves, which no variant disagrees about. What the
	variants disagree about is the container around them and where the prose sits, so that stays
	out here rather than being baked in.
-->
<script lang="ts">
	import * as Field from '$lib/components/ui/field/index.js';
	import { Input } from '$lib/components/ui/input/index.js';

	let { invalid = false }: { invalid?: boolean } = $props();
</script>

<Field.Group>
	<Field.Field data-invalid={invalid || undefined}>
		<Field.Label for="current">Current password</Field.Label>
		<Input
			id="current"
			type="password"
			autocomplete="current-password"
			class="h-7"
			aria-invalid={invalid || undefined}
		/>
	</Field.Field>

	<Field.Field>
		<Field.Label for="new">New password</Field.Label>
		<Input id="new" type="password" autocomplete="new-password" class="h-7" />
		<Field.Description>At least 12 characters.</Field.Description>
	</Field.Field>

	<Field.Field>
		<Field.Label for="confirm">Confirm new password</Field.Label>
		<Input id="confirm" type="password" autocomplete="new-password" class="h-7" />
	</Field.Field>
</Field.Group>
