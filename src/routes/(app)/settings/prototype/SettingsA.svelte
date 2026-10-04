<!--
	PROTOTYPE ONLY (issue #314). Variant A: today's three cards in one column. The screen is
	`max-w-6xl`, but the column stops at `max-w-2xl` and sits under the title, on the left.
-->
<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import PageHeader from '$lib/components/page-header.svelte';
	import type { PageData } from '../$types';
	import ApiKey from './ApiKey.svelte';
	import BackupAction from './BackupAction.svelte';
	import Help from './Help.svelte';
	import PasswordForm from './PasswordForm.svelte';
	import { COPY } from './parts';

	let { data }: { data: PageData } = $props();
</script>

<div class="mx-auto max-w-6xl px-4 py-6 md:px-6">
	<PageHeader title="Settings" />
	<div class="flex max-w-2xl flex-col gap-6">
		<Card.Root>
			<Card.Header>
				<Card.Title>{COPY.password.title}</Card.Title>
				<Help text={COPY.password.help} />
			</Card.Header>
			<Card.Content><PasswordForm id="a" /></Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Header>
				<Card.Title>{COPY.apiKey.title}</Card.Title>
				<Help text={COPY.apiKey.help} />
			</Card.Header>
			<Card.Content><ApiKey {...data.key} /></Card.Content>
		</Card.Root>
		<Card.Root>
			<Card.Header>
				<Card.Title>{COPY.backup.title}</Card.Title>
				<Help text={COPY.backup.help} />
			</Card.Header>
			<Card.Content><BackupAction size={data.backupSize} /></Card.Content>
		</Card.Root>
	</div>
</div>
