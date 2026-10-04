<!--
	PROTOTYPE ONLY (issue #314). The Restore fields; the upload is a stub. `help` puts the
	instructions under the file field, inside the form, instead of in a card description.
-->
<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import { TAP, stub } from './parts';

	let { help = false }: { help?: boolean } = $props();
</script>

<form onsubmit={stub}>
	<Field.FieldGroup>
		<Field.Field>
			<Field.FieldLabel for="backup">Backup file</Field.FieldLabel>
			<Input id="backup" type="file" accept=".tar" required class={TAP} />
			{#if help}
				<Field.FieldDescription>
					The file that Back up saved in your other planner. You log in with the password from that
					planner.
				</Field.FieldDescription>
			{/if}
		</Field.Field>
		<Button type="submit" variant="outline" class="w-full {TAP}">Restore</Button>
	</Field.FieldGroup>
</form>
