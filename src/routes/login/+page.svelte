<!--
	PROTOTYPE ONLY — issue #314 "How should Settings, Login and Setup lay out at each size?" Login
	has two fields, so its variants differ only in the frame: A is today's centred card; B and C are
	flush on a phone, as Setup B and C are. The letters match the Setup prototype. The form still
	posts to the real action: logging in changes nothing.
-->
<script lang="ts">
	import { page } from '$app/state';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import PrototypeSwitcher from '$lib/components/prototype-switcher.svelte';
	import Frame from '../setup/prototype/Frame.svelte';
	import { TAP, card, cardPad } from '../setup/prototype/parts';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	const VARIANTS = [
		{ key: 'A', label: 'Centred card, kept' },
		{ key: 'B', label: 'Flush on a phone' },
		{ key: 'C', label: 'Flush on a phone (Login as B)' }
	];
	const variant = $derived(page.url.searchParams.get('view') ?? 'A');
	const flush = $derived(variant !== 'A');
</script>

<svelte:head><title>Log in (prototype {variant})</title></svelte:head>

<Frame {flush}>
	<Card.Root class={card(flush)}>
		<Card.Header class="text-center {cardPad(flush)}">
			<Card.Title class="text-xl">Log in</Card.Title>
		</Card.Header>
		<Card.Content class="flex flex-col gap-6 {cardPad(flush)}">
			{#if form?.error}
				<Alert.Root variant="destructive">
					<Alert.Description>{form.error}</Alert.Description>
				</Alert.Root>
			{/if}
			<form method="POST">
				<Field.FieldGroup>
					<Field.Field data-invalid={form?.error ? true : undefined}>
						<Field.FieldLabel for="email">Email</Field.FieldLabel>
						<Input
							id="email"
							type="email"
							name="email"
							value={form?.email ?? ''}
							required
							class={TAP}
						/>
					</Field.Field>
					<Field.Field data-invalid={form?.error ? true : undefined}>
						<Field.FieldLabel for="password">Password</Field.FieldLabel>
						<Input id="password" type="password" name="password" required class={TAP} />
					</Field.Field>
					<Button type="submit" class="w-full {TAP}">Log in</Button>
				</Field.FieldGroup>
			</form>
		</Card.Content>
	</Card.Root>
</Frame>

<PrototypeSwitcher variants={VARIANTS} current={variant} paramName="view" />
