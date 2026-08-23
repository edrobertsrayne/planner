<!--
	PROTOTYPE — throwaway. Account actions as separate visible controls, not a menu (#60).
	Here the Settings control is live: variant C hangs the whole screen off it.
-->
<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { toggleMode } from 'mode-watcher';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import SunMoonIcon from '@lucide/svelte/icons/sun-moon';

	let { active = false, onsettings }: { active?: boolean; onsettings?: () => void } = $props();
</script>

<div class="flex items-center gap-1">
	<Button variant="ghost" size="icon" class="size-7" onclick={toggleMode} aria-label="Toggle theme">
		<SunMoonIcon />
	</Button>
	<Button
		variant="ghost"
		size="sm"
		class="h-7 {active ? 'bg-accent text-accent-foreground' : ''}"
		onclick={onsettings}
	>
		<SettingsIcon />
		Settings
	</Button>
	<Button variant="ghost" size="sm" class="h-7">
		<LogOutIcon />
		Log out
	</Button>
</div>
