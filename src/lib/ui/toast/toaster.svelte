<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import { toasts } from './toast.svelte';
</script>

<ol class="ui-toaster" aria-label="Notifications">
	{#each toasts.items as t (t.id)}
		<li data-slot="toast" class="ui-toast ui-toast-{t.kind}">
			<div class="ui-toast-content" role={t.kind === 'error' ? 'alert' : 'status'}>
				{#if t.component}
					<t.component {...t.componentProps} />
				{:else}
					<span class="ui-toast-text">{t.text}</span>
					{#if t.description}<span class="ui-toast-description">{t.description}</span>{/if}
				{/if}
			</div>
			{#if t.action}
				<button
					type="button"
					class="ui-toast-action"
					onclick={() => {
						t.action?.onClick();
						toasts.dismiss(t.id);
					}}>{t.action.label}</button
				>
			{/if}
			<button type="button" class="ui-toast-close" onclick={() => toasts.dismiss(t.id)}>
				<XIcon aria-hidden="true" />
				<span class="sr-only">Dismiss</span>
			</button>
		</li>
	{/each}
</ol>
