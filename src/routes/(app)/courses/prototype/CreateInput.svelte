<!--
	PROTOTYPE ONLY (issue #306): type a name, press Enter, the box clears for the next one.
	Hidden on a phone.
-->
<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';

	let {
		placeholder,
		oncreate,
		class: className = ''
	}: { placeholder: string; oncreate: (v: string) => void; class?: string } = $props();

	let value = $state('');
</script>

<form
	class="max-md:hidden {className}"
	onsubmit={(e) => {
		e.preventDefault();
		if (value.trim()) oncreate(value.trim());
		value = '';
	}}
>
	<Input bind:value autocomplete="off" class="h-8 w-full" {placeholder} />
</form>
