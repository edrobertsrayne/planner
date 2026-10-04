<!-- PROTOTYPE ONLY (issue #314). The Create account fields; the write is a stub. -->
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import { TAP, stub } from './parts';
</script>

<form onsubmit={stub}>
	<Field.FieldGroup>
		<Field.Field>
			<Field.FieldLabel for="name">Name</Field.FieldLabel>
			<Input id="name" type="text" required class={TAP} />
		</Field.Field>
		<Field.Field>
			<Field.FieldLabel for="email">Email</Field.FieldLabel>
			<Input id="email" type="email" required class={TAP} />
		</Field.Field>
		<Field.Field>
			<Field.FieldLabel for="password">Password</Field.FieldLabel>
			<Input id="password" type="password" autocomplete="new-password" required class={TAP} />
			<Field.FieldDescription>
				At least 12 characters. There is no password reset by email — keep it somewhere safe.
			</Field.FieldDescription>
		</Field.Field>
		<Field.Field>
			<Field.FieldLabel for="confirmPassword">Confirm password</Field.FieldLabel>
			<Input
				id="confirmPassword"
				type="password"
				autocomplete="new-password"
				required
				class={TAP}
			/>
		</Field.Field>
		<Button type="submit" class="w-full {TAP}">Create account</Button>
	</Field.FieldGroup>
</form>
