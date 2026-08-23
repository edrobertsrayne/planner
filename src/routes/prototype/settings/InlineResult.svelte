<!--
	PROTOTYPE — throwaway. The inline half of the feedback axis. #78 settled the destructive Alert
	as a status surface; there is no settled non-destructive one, so success borrows the default
	Alert and a check. If that reads wrong, that is the finding.
-->
<script lang="ts">
	import * as Alert from '$lib/components/ui/alert/index.js';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import OctagonXIcon from '@lucide/svelte/icons/octagon-x';
	import type { Result } from './stub.js';

	let { result }: { result: Result | null } = $props();
</script>

{#if result}
	<Alert.Root variant={result.ok ? 'default' : 'destructive'}>
		{#if result.ok}<CircleCheckIcon />{:else}<OctagonXIcon />{/if}
		<Alert.Description>{result.message}</Alert.Description>
	</Alert.Root>
{/if}
