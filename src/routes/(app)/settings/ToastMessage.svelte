<!--
	Sonner's own toast markup carries no ARIA role — only `aria-live` on the list item, which
	the accessibility tree doesn't map to role="alert"/"status". This wraps the toast text so the
	result of a password change is announced the same way the old inline message was.
-->
<script lang="ts">
	let { text, role }: { text: string; role: 'alert' | 'status' } = $props();
</script>

<span {role}>{text}</span>
