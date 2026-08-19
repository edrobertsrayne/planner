<!-- PROTOTYPE — throwaway. Account actions as separate visible controls, not a menu. -->
<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { toggleMode } from 'mode-watcher';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import SunMoonIcon from '@lucide/svelte/icons/sun-moon';
</script>

<div class="flex items-center gap-1">
	<Button variant="ghost" size="icon" class="size-7" onclick={toggleMode} aria-label="Toggle theme">
		<SunMoonIcon />
	</Button>
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- prototype -->
	<Button variant="ghost" size="sm" class="h-7" href="/settings">
		<SettingsIcon />
		Settings
	</Button>
	<Button variant="ghost" size="sm" class="h-7">
		<LogOutIcon />
		Log out
	</Button>
</div>
