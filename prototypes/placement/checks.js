// PROTOTYPE, throwaway. Runs the eight cases issue #225 demands against the model inlined in
// PROTOTYPE-placement-mechanism.html, so the page and this report can never disagree.
//   bun prototypes/placement/checks.js

const html = await Bun.file(new URL('./PROTOTYPE-placement-mechanism.html', import.meta.url)).text();
const source = html.split('<script id="model">')[1].split('</script>')[0];
const MODEL = new Function(`${source}; return MODEL;`)();

const run = (actions) => actions.reduce((state, action) => MODEL.reduce(state, action), MODEL.initial());
const base = MODEL.initial();
const nth = (n) => MODEL.availableSlots(base.blockedDays, base.boundary)[n];
const at = (rows, lessonId, part = 1) => rows.find((r) => r.lessonId === lessonId && r.part === part);
const where = (row) => (row ? `${row.date} P${row.period}` : 'nowhere');
const upcoming = (result, state) => result.rows.filter((r) => r.date >= state.boundary && r.lessonId);
const shape = (rows) => JSON.stringify(rows.map((r) => [r.date, r.period, r.lessonId]));
const MECHS = ['A', 'B', 'C'];

function report(title, state, note) {
	const derived = MODEL.derive(state);
	console.log(`\n\x1b[1m${title}\x1b[0m`);
	if (note) console.log(`  ${note}`);
	for (const id of MECHS) {
		const rows = upcoming(derived[id], state).slice(0, 6);
		console.log(
			`  ${id}: ${rows
				.map(
					(r) =>
						`${r.date.slice(5)}P${r.period} ${MODEL.titleOf(r.lessonId)}${r.of > 1 ? `(${r.part}/${r.of})` : ''}`
				)
				.join('  ')}`
		);
		for (const warning of derived[id].warnings) console.log(`     \x1b[31m! ${warning}\x1b[0m`);
	}
	return derived;
}

// 1. A placement mid-sequence.
{
	const before = MODEL.derive(base).A.rows;
	const state = run([{ type: 'place', lessonId: 'REV', ...nth(3) }]);
	const derived = report('1. Placement mid-sequence (Revision on the 4th Slot)', state);
	for (const id of MECHS) {
		const rows = upcoming(derived[id], state);
		const forces = rows.filter((r) => r.lessonId.startsWith('F')).map((r) => r.lessonId);
		const wanted = before
			.filter((r) => r.lessonId)
			.map((r) => r.lessonId)
			.slice(0, forces.length);
		console.log(
			`     ${id}: Revision at ${where(at(rows, 'REV'))}; Forces order preserved: ${forces.join() === wanted.join()}; Forces 4 shifted right by one: ${where(at(rows, 'F4')) === `${nth(4).date} P${nth(4).period}`}; distinct Forces Lessons still in the plan: ${new Set(forces).size}/8`
		);
	}
}

// 2. Removing the placement again.
{
	const state = run([
		{ type: 'place', lessonId: 'REV', ...nth(3) },
		{ type: 'unplace', lessonId: 'REV' }
	]);
	const derived = report('2. The placement removed again', state);
	const plain = MODEL.derive(base);
	for (const id of MECHS)
		console.log(
			`     ${id}: back to the plan it had before, no residue: ${shape(upcoming(derived[id], state)) === shape(upcoming(plain[id], base))}`
		);
}

// 3. Length 2.
{
	const state = run([{ type: 'place', lessonId: 'FBK', ...nth(2) }]);
	const derived = report('3. A Length 2 placement (Feedback on the 3rd Slot)', state);
	for (const id of MECHS) {
		const rows = upcoming(derived[id], state);
		const parts = rows.filter((r) => r.lessonId === 'FBK');
		console.log(
			`     ${id}: Feedback occupies ${parts.length} Slot(s) — ${parts.map(where).join(' + ') || 'nowhere'}; Forces 3 now at ${where(at(rows, 'F3'))}`
		);
	}
}

// 4. A Blocked Day inside a Length 2 run.
{
	const state = run([
		{ type: 'place', lessonId: 'FBK', ...nth(1) },
		{ type: 'blockDay', date: nth(2).date }
	]);
	const derived = report(`4. A Blocked Day (${nth(2).date}) landing inside the Feedback run`, state);
	for (const id of MECHS) {
		const parts = upcoming(derived[id], state).filter((r) => r.lessonId === 'FBK');
		console.log(
			`     ${id}: Feedback now at ${parts.map(where).join(' + ') || 'nowhere'}; a part still sits on the Blocked Day: ${parts.some((r) => r.date === nth(2).date)}`
		);
	}
}

// 5. A placement past the end of the plan, in the Open Slots.
{
	const chosen = `${nth(19).date} P${nth(19).period}`;
	const state = run([{ type: 'place', lessonId: 'REV', ...nth(19) }]);
	const derived = report(`5. A placement where the plan had already run out (20th Slot, ${chosen})`, state);
	for (const id of MECHS) {
		const landed = at(upcoming(derived[id], state), 'REV');
		console.log(
			`     ${id}: Revision landed ${where(landed)}, chosen ${chosen}; on the chosen occasion: ${where(landed) === chosen}`
		);
	}
}

// 6. A Rewind across a placement.
{
	const state = run([
		{ type: 'place', lessonId: 'REV', ...nth(1) },
		{ type: 'advance', date: nth(4).date },
		{ type: 'note', ...nth(0), note: 'practical overran' },
		{ type: 'rewind', date: '2026-09-03' }
	]);
	const derived = report('6. A Rewind back across the placement', state);
	for (const id of MECHS) {
		const landed = at(derived[id].rows, 'REV');
		console.log(
			`     ${id}: after the Rewind, Revision is ${where(landed)} — placed on ${nth(1).date} P${nth(1).period}; survived: ${Boolean(landed)}`
		);
	}
	for (const line of state.log.filter((l) => l.startsWith('C:'))) console.log(`     ${line}`);
}

// 7. Re-running with no change of input.
{
	const once = run([{ type: 'place', lessonId: 'REV', ...nth(2) }]);
	const thrice = run([
		{ type: 'place', lessonId: 'REV', ...nth(2) },
		{ type: 'rerun' },
		{ type: 'rerun' }
	]);
	console.log('\n\x1b[1m7. Re-run twice with no change of input\x1b[0m');
	for (const id of MECHS)
		console.log(
			`  ${id}: unmoved after two extra re-runs: ${shape(upcoming(MODEL.derive(once)[id], once)) === shape(upcoming(MODEL.derive(thrice)[id], thrice))}`
		);
}

// 8. delivered and demandFor with a placed Lesson in the record.
{
	const state = run([
		{ type: 'place', lessonId: 'REV', ...nth(1) },
		{ type: 'advance', date: nth(3).date },
		{ type: 'continue', lessonId: 'F3' }
	]);
	const derived = report(
		'8. A placed Lesson in the record, then a Continuation on Forces 3',
		state,
		`today is ${nth(3).date}; Revision was taught on ${nth(1).date} and is now history`
	);
	for (const id of MECHS) {
		const counted = {};
		// The record and the plan together: a Lesson taught before today still counts as taught.
		for (const row of [...derived[id].history, ...derived[id].rows.filter((r) => r.date >= state.boundary)])
			if (row.lessonId) counted[row.lessonId] = (counted[row.lessonId] ?? 0) + 1;
		const missing = MODEL.TOPIC_LESSONS.filter((l) => !counted[l.id]).map((l) => l.title);
		// A Lesson-part n with no part n−1 anywhere is a hole the zip could never produce.
		const parts = {};
		for (const row of [...derived[id].history, ...derived[id].rows])
			if (row.lessonId) (parts[row.lessonId] ??= []).push(row.part ?? 1);
		const holes = Object.entries(parts)
			.filter(([, seen]) => seen.sort().some((part, i) => part !== i + 1))
			.map(([lessonId, seen]) => `${MODEL.titleOf(lessonId)} has parts ${seen.join('+')}`);
		// The record should read as an unbroken prefix of the Course: Forces 1, 2, 3, …
		const taught = derived[id].history.filter((r) => r.lessonId?.startsWith('F')).map((r) => r.lessonId);
		const expected = MODEL.TOPIC_LESSONS.slice(0, taught.length).map((l) => l.id);
		const reordered = taught.join() !== expected.join();
		console.log(
			`     ${id}: the record reads ${derived[id].history.map((r) => MODEL.titleOf(r.lessonId)).join(' → ')}${reordered ? ' — OUT OF COURSE ORDER: a Lesson was skipped, not shifted' : ''}`
		);
		console.log(
			`     ${id}: Forces Lessons missing: ${missing.length ? missing.join(', ') : 'none'}; broken part sequences: ${holes.length ? holes.join('; ') : 'none'}; Forces 3 parts after the Continuation: ${counted.F3 ?? 0}`
		);
	}
}

// 9. The day the placement lands on is blocked: it shift-rights rather than being orphaned.
{
	const placed = nth(3);
	const blocked = run([
		{ type: 'place', lessonId: 'REV', ...placed },
		{ type: 'blockDay', date: placed.date }
	]);
	const derived = report(`9. The placed day (${placed.date}) is blocked`, blocked);
	for (const id of MECHS) {
		const landed = at(upcoming(derived[id], blocked), 'REV');
		console.log(
			`     ${id}: Revision is now ${where(landed)}; still in the plan: ${Boolean(landed)}; still on the Blocked Day: ${landed?.date === placed.date}`
		);
	}
	const restored = run([
		{ type: 'place', lessonId: 'REV', ...placed },
		{ type: 'blockDay', date: placed.date },
		{ type: 'unblockDay', date: placed.date }
	]);
	const back = MODEL.derive(restored);
	for (const id of MECHS)
		console.log(
			`     ${id}: unblocked again, Revision is back at ${where(at(upcoming(back[id], restored), 'REV'))} (placed on ${placed.date} P${placed.period})`
		);
}

// 10. A day before the placement is blocked: the placement keeps its own date.
{
	const placed = nth(3);
	const state = run([
		{ type: 'place', lessonId: 'REV', ...placed },
		{ type: 'blockDay', date: nth(1).date }
	]);
	const derived = report(`10. An earlier day (${nth(1).date}) is blocked`, state);
	for (const id of MECHS) {
		const rows = upcoming(derived[id], state);
		const landed = at(rows, 'REV');
		console.log(
			`     ${id}: Revision kept its date: ${landed?.date === placed.date} (${where(landed)}); the Topic Lesson now before it is ${MODEL.titleOf(rows[rows.indexOf(landed) - 1]?.lessonId)}`
		);
	}
}

console.log('');
