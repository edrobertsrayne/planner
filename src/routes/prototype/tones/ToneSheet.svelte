<!--
	PROTOTYPE — throwaway. One theme's worth of a curve: the raw swatch table, an adjacency strip,
	and the three surfaces #59 named. Rendered twice per variant (light and dark, side by side),
	because a curve that works in one theme and not the other is the failure mode being hunted.
-->
<script lang="ts">
	import { VARIANTS, TONES, toneVars, contrast, outOfGamut, type Variant } from './curves';
	import { CLASSES, DAYS, WEEK } from './fixtures';

	let { variant, theme }: { variant: Variant; theme: 'light' | 'dark' } = $props();

	const vars = $derived(toneVars(variant, theme));
	const rows = $derived(
		TONES.map((t, i) => ({
			i,
			name: t.name,
			ratio: contrast(variant, theme, i),
			clipped: (['bg', 'fg', 'ring'] as const).filter((r) => outOfGamut(variant, theme, i, r))
		}))
	);
	void VARIANTS;
</script>

<div class={theme === 'dark' ? 'dark' : ''} style={vars}>
	<div class="bg-background text-foreground space-y-6 rounded-lg border p-4">
		<div class="flex items-baseline justify-between">
			<h2 class="text-sm font-semibold capitalize">{theme}</h2>
			<span class="text-muted-foreground text-[11px]">
				bg L{variant[theme].bg.l} / {Math.round(variant[theme].bg.sat * 100)}% chroma · fg L{variant[
					theme
				].fg.l} / {Math.round(variant[theme].fg.sat * 100)}% · ring L{variant[theme].ring
					.l} / {Math.round(variant[theme].ring.sat * 100)}%
			</span>
		</div>

		<!-- 1. The raw table: 8 tones × 3 roles, plus the two readouts the eye can't do. -->
		<section>
			<div class="text-muted-foreground mb-1.5 text-[11px] font-medium tracking-wide uppercase">
				Roles
			</div>
			<table class="w-full text-[11px]">
				<thead class="text-muted-foreground">
					<tr class="text-left">
						<th class="font-medium">Tone</th>
						<th class="font-medium">bg</th>
						<th class="font-medium">fg</th>
						<th class="font-medium">ring</th>
						<th class="font-medium">Combined</th>
						<th class="text-right font-medium">fg on bg</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row.i)}
						<tr>
							<td class="py-0.5 pr-2 font-mono">{row.i} {row.name}</td>
							<td><div class="h-5 w-10 rounded" style="background: var(--tone-{row.i}-bg)"></div></td>
							<td><div class="h-5 w-10 rounded" style="background: var(--tone-{row.i}-fg)"></div></td>
							<td>
								<div class="h-5 w-10 rounded" style="background: var(--tone-{row.i}-ring)"></div>
							</td>
							<td>
								<div
									class="w-24 rounded border px-1.5 py-0.5 font-medium"
									style="background: var(--tone-{row.i}-bg); color: var(--tone-{row.i}-fg); border-color: var(--tone-{row.i}-ring)"
								>
									{CLASSES[row.i].label}
								</div>
							</td>
							<td class="text-right tabular-nums">
								<span class={row.ratio < 4.5 ? 'font-semibold text-red-500' : 'text-muted-foreground'}>
									{row.ratio.toFixed(1)}:1
								</span>
								{#if row.clipped.length}
									<span class="ml-1 font-semibold text-red-500">clipped: {row.clipped.join(',')}</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

		<!-- 2. Adjacency: the eight butted together, where near-hues (indigo/sky/violet,
		     emerald/teal) either separate or collapse. -->
		<section>
			<div class="text-muted-foreground mb-1.5 text-[11px] font-medium tracking-wide uppercase">
				Adjacent
			</div>
			<div class="flex overflow-hidden rounded">
				{#each TONES as t, i (t.name)}
					<div class="h-8 flex-1" style="background: var(--tone-{i}-bg)"></div>
				{/each}
			</div>
			<div class="mt-1 flex overflow-hidden rounded">
				{#each TONES as t, i (t.name)}
					<div class="h-8 flex-1" style="background: var(--tone-{i}-ring)"></div>
				{/each}
			</div>
		</section>

		<!-- 3. Surface one: the Teaching Week / Calendar grid cell, at the grid's real density. -->
		<section>
			<div class="text-muted-foreground mb-1.5 text-[11px] font-medium tracking-wide uppercase">
				Teaching Week cell
			</div>
			<table class="w-full border-separate border-spacing-0.5 text-[10px]">
				<thead>
					<tr class="text-muted-foreground">
						<th></th>
						{#each DAYS as d (d)}<th class="font-medium">{d}</th>{/each}
					</tr>
				</thead>
				<tbody>
					{#each WEEK as row, p (p)}
						<tr>
							<th class="text-muted-foreground pr-1 text-right font-medium">P{p + 1}</th>
							{#each row as tone, di (di)}
								<td>
									{#if tone === null}
										<div class="bg-muted/40 h-9 rounded border border-dashed"></div>
									{:else}
										<div
											class="h-9 rounded border px-1 py-0.5 text-left"
											style="background: var(--tone-{tone}-bg); color: var(--tone-{tone}-fg); border-color: var(--tone-{tone}-ring)"
										>
											<div class="font-semibold">{CLASSES[tone].label}</div>
											<div class="truncate opacity-80">{CLASSES[tone].next}</div>
										</div>
									{/if}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</section>

		<!-- 4. Surface two: the Classes list, as the tone-coloured launcher tiles #63 settled. -->
		<section>
			<div class="text-muted-foreground mb-1.5 text-[11px] font-medium tracking-wide uppercase">
				Classes tiles
			</div>
			<div class="grid grid-cols-4 gap-2">
				{#each CLASSES as c, i (c.label)}
					<div
						class="rounded-lg border p-2"
						style="background: var(--tone-{i}-bg); color: var(--tone-{i}-fg); border-color: var(--tone-{i}-ring)"
					>
						<div class="text-xs font-semibold">{c.label}</div>
						<div class="text-[10px] opacity-80">{c.topic}</div>
						<div class="mt-1.5 border-t pt-1 text-[10px]" style="border-color: var(--tone-{i}-ring)">
							Next: {c.next}
						</div>
					</div>
				{/each}
			</div>
		</section>

		<!-- 5. Surface three: the Session panel — one tone alone, against neutral chrome. -->
		<section>
			<div class="text-muted-foreground mb-1.5 text-[11px] font-medium tracking-wide uppercase">
				Session panel
			</div>
			<div class="grid grid-cols-2 gap-2">
				{#each [2, 4] as i (i)}
					<div class="bg-card overflow-hidden rounded-lg border">
						<div class="h-1" style="background: var(--tone-{i}-ring)"></div>
						<div class="p-2.5">
							<div class="flex items-center gap-1.5">
								<span
									class="rounded px-1.5 py-0.5 text-[10px] font-semibold"
									style="background: var(--tone-{i}-bg); color: var(--tone-{i}-fg)"
								>
									{CLASSES[i].label}
								</span>
								<span class="text-muted-foreground text-[10px]">Wed · P2 · Rm 14</span>
							</div>
							<div class="mt-1.5 text-xs font-medium">{CLASSES[i].next}</div>
							<div class="text-muted-foreground mt-0.5 text-[10px]">{CLASSES[i].topic}</div>
						</div>
					</div>
				{/each}
			</div>
		</section>
	</div>
</div>
