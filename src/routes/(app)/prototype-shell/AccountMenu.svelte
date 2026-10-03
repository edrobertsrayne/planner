<!-- PROTOTYPE ONLY (issue #305): Settings, theme and Log out folded into one menu. -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { toggleMode } from 'mode-watcher';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import UserRoundIcon from '@lucide/svelte/icons/user-round';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Button } from '$lib/components/ui/button';

	let { align = 'end' }: { align?: 'start' | 'end' } = $props();
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" size="icon" aria-label="Account and Settings">
				<UserRoundIcon />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content {align} class="w-48">
		<DropdownMenu.Item>
			{#snippet child({ props })}
				<a {...props} href={resolve('/settings')}><SettingsIcon /> Settings</a>
			{/snippet}
		</DropdownMenu.Item>
		<DropdownMenu.Item onSelect={toggleMode}><MoonIcon /> Toggle theme</DropdownMenu.Item>
		<DropdownMenu.Separator />
		<form method="POST" action="/logout">
			<DropdownMenu.Item>
				{#snippet child({ props })}
					<button {...props} type="submit" class="{props.class} w-full"
						><LogOutIcon /> Log out</button
					>
				{/snippet}
			</DropdownMenu.Item>
		</form>
	</DropdownMenu.Content>
</DropdownMenu.Root>
