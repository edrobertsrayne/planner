<!-- PROTOTYPE — throwaway. Account actions: dark-mode toggle, Settings, Log out. -->
<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { toggleMode } from 'mode-watcher';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import SunMoonIcon from '@lucide/svelte/icons/sun-moon';

	let { variant = 'avatar' }: { variant?: 'avatar' | 'compact' } = $props();
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			{#if variant === 'avatar'}
				<Button {...props} variant="ghost" class="h-7 gap-2 px-1.5">
					<Avatar.Root class="size-6">
						<Avatar.Fallback class="text-[0.625rem]">ER</Avatar.Fallback>
					</Avatar.Root>
					<span class="text-sm">Ed Rayne</span>
				</Button>
			{:else}
				<Button {...props} variant="ghost" size="icon" class="size-7">
					<Avatar.Root class="size-6">
						<Avatar.Fallback class="text-[0.625rem]">ER</Avatar.Fallback>
					</Avatar.Root>
				</Button>
			{/if}
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="w-48">
		<DropdownMenu.Label>Ed Rayne</DropdownMenu.Label>
		<DropdownMenu.Separator />
		<DropdownMenu.Item onclick={toggleMode}>
			<SunMoonIcon />
			Toggle theme
		</DropdownMenu.Item>
		<DropdownMenu.Item>
			{#snippet child({ props })}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- prototype -->
				<a {...props} href="/settings">
					<SettingsIcon />
					Settings
				</a>
			{/snippet}
		</DropdownMenu.Item>
		<DropdownMenu.Separator />
		<DropdownMenu.Item variant="destructive">
			<LogOutIcon />
			Log out
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
