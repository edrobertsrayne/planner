<script lang="ts" module>
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	export type ButtonVariant =
		'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
	export type ButtonSize =
		'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg';

	export type ButtonProps = HTMLButtonAttributes &
		HTMLAnchorAttributes & {
			variant?: ButtonVariant;
			size?: ButtonSize;
			ref?: HTMLElement | null;
		};
</script>

<script lang="ts">
	import { cn } from '$lib/utils';
	import { touchTarget } from './touch-target';

	let {
		class: className,
		variant = 'default',
		size = 'default',
		ref = $bindable(null),
		href = undefined,
		type = 'button',
		disabled,
		children,
		...rest
	}: ButtonProps = $props();

	// The default size is the base `.ui-btn` box; naming it would collide with the default variant.
	const cls = $derived(
		cn(
			'ui-btn',
			`ui-btn-${variant}`,
			size !== 'default' && `ui-btn-${size}`,
			touchTarget,
			className
		)
	);
</script>

{#if href}
	<a
		bind:this={ref}
		class={cls}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? 'link' : undefined}
		tabindex={disabled ? -1 : undefined}
		{...rest}
	>
		{@render children?.()}
	</a>
{:else}
	<button bind:this={ref} class={cls} {type} {disabled} {...rest}>
		{@render children?.()}
	</button>
{/if}
