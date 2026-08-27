<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<p class="text-xs text-muted-foreground {className}">
	Build {__APP_BUILD_SHA__} · {__APP_BUILD_DATE__}
</p>
