<!--
	PROTOTYPE ONLY (issue #314). Variant C: the cards fill the width. From `lg`, Change password
	stands on the left and API key and Backup stack on the right. One column below `lg`.
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
	<div class="grid items-start gap-6 lg:grid-cols-2">
		<Card.Root>
			<Card.Header>
				<Card.Title>{COPY.password.title}</Card.Title>
				<Help text={COPY.password.help} />
			</Card.Header>
			<Card.Content><PasswordForm id="c" /></Card.Content>
		</Card.Root>
		<div class="flex flex-col gap-6">
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
</div>
