<script lang="ts">
	// PROTOTYPE — throwaway. The one Session panel, shared by all three tabs of
	// variant D. Clicking a Session anywhere opens this: the Lesson plan, its
	// links, the note on the occasion, and "Needs more time".
	import { fmtLongDay, weekLetterOf, classById, toneOf, type Session } from './fixtures';

	let {
		session,
		notes = $bindable(),
		onclose
	}: {
		session: Session;
		notes: Record<string, string>;
		onclose: () => void;
	} = $props();

	const k = $derived(`${session.classId}|${session.date}|${session.period}`);
	const t = $derived(toneOf(session.classId));
	const cls = $derived(classById(session.classId));
</script>

<aside class="w-96 shrink-0 overflow-y-auto border-l border-neutral-200 bg-white px-5 py-5">
	<div class="mb-4 flex items-start justify-between">
		<div>
			<span class="rounded px-2 py-0.5 text-sm font-bold {t.bg} {t.text}">{cls.label}</span>
			<div class="mt-2 text-xs text-neutral-500">
				{fmtLongDay(session.date)} · P{session.period} · Week {weekLetterOf(session.date)}
			</div>
		</div>
		<button class="text-neutral-400 hover:text-neutral-900" onclick={onclose} aria-label="Close"
			>✕</button
		>
	</div>

	<h2 class="text-lg leading-snug font-semibold">{session.lesson.title}</h2>
	<div class="mt-1 text-xs text-neutral-500">
		{cls.course} · {session.lesson.topic}
		{#if session.partsTotal > 1}· period {session.part} of {session.partsTotal}{/if}
	</div>

	{#if session.continuedFrom}
		<div class="mt-3 rounded bg-orange-50 px-3 py-2 text-xs text-orange-900">
			Continued from the previous Session — this Lesson needed more time.
		</div>
	{/if}

	{#if session.lesson.body}
		<div class="mt-4 border-t border-neutral-100 pt-4 text-sm whitespace-pre-line text-neutral-700">
			{session.lesson.body.replace(/\*\*/g, '')}
		</div>
	{:else}
		<p class="mt-4 border-t border-neutral-100 pt-4 text-sm text-neutral-400 italic">
			No plan written yet — a title alone is a complete Lesson.
		</p>
	{/if}

	{#if session.lesson.links?.length}
		<ul class="mt-4 space-y-1">
			{#each session.lesson.links as link (link.url)}
				<li><span class="text-sm text-sky-700 underline">{link.label}</span></li>
			{/each}
		</ul>
	{/if}

	<div class="mt-6 border-t border-neutral-100 pt-4">
		<div class="mb-1 flex items-baseline justify-between">
			<label for="session-note" class="text-xs font-bold tracking-wider text-neutral-400 uppercase"
				>How it went</label
			>
			<span class="text-[11px] text-neutral-400">stays with the occasion</span>
		</div>
		<textarea
			id="session-note"
			class="w-full rounded border border-neutral-300 p-2 text-sm"
			rows="5"
			placeholder="Notes on this Session…"
			bind:value={notes[k]}></textarea>
		<button
			class="mt-3 w-full rounded border px-3 py-2 text-sm font-medium {session.continues
				? 'border-orange-300 bg-orange-100 text-orange-900'
				: 'border-neutral-300 text-neutral-700 hover:bg-neutral-50'}"
		>
			{session.continues ? '✓ Needs more time' : 'Needs more time'}
		</button>
		<p class="mt-2 text-[11px] leading-snug text-neutral-400">
			Marking this pushes every later Lesson for {cls.label} down one Available Slot.
		</p>
	</div>
</aside>
