<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{#if data.user}
	<form method="POST" action="/logout">
		<button type="submit">Log out</button>
	</form>
{/if}
{@render children()}
