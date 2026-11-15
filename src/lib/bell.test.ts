import { describe, expect, test } from 'vitest';
import { dayRows, rowIndexOf, type BellSchedule, type BellTime } from './bell';

const t = (starts: string, ends: string): BellTime => ({ starts, ends });

// Years 9–10 lunch after P3, Years 11–13 after P4; Break shared.
const lower: BellSchedule = {
	id: 'lower',
	name: 'Lower',
	isDefault: true,
	times: {
		1: t('08:50', '09:50'),
		2: t('09:50', '10:50'),
		8: t('10:50', '11:10'),
		3: t('11:10', '12:10'),
		9: t('12:10', '12:40'),
		4: t('12:40', '13:40'),
		5: t('13:40', '14:40'),
		6: t('14:40', '15:40')
	}
};
const upper: BellSchedule = {
	id: 'upper',
	name: 'Upper',
	isDefault: false,
	times: { ...lower.times, 4: t('12:10', '13:10'), 9: t('13:10', '13:40') }
};

describe('dayRows', () => {
	test('with no Bell Schedule the day is the six Periods between the untimed bands', () => {
		expect(dayRows([]).map((r) => [r.label, r.times])).toEqual([
			['Before school', null],
			['P1', null],
			['P2', null],
			['P3', null],
			['P4', null],
			['P5', null],
			['P6', null],
			['After school', null]
		]);
	});

	test('a split day has one shared Break and a Lunch for each Bell Schedule, by start time', () => {
		expect(dayRows([lower, upper]).map((r) => [r.label, r.times?.starts ?? null])).toEqual([
			['Before school', null],
			['P1', '08:50'],
			['P2', '09:50'],
			['Break', '10:50'],
			['P3', '11:10'],
			['Lunch (Lower)', '12:10'],
			['P4', '12:40'],
			['Lunch (Upper)', '13:10'],
			['P5', '13:40'],
			['P6', '14:40'],
			['After school', null]
		]);
	});

	test('the Periods follow whichever Bell Schedule is the default', () => {
		const rows = dayRows([
			{ ...lower, isDefault: false },
			{ ...upper, isDefault: true }
		]);
		// Lower's Lunch starts with Upper's P4 and ends first, so it is drawn first.
		expect(rows.map((r) => r.label).slice(4, 8)).toEqual([
			'P3',
			'Lunch (Lower)',
			'P4',
			'Lunch (Upper)'
		]);
		expect(rows.find((r) => r.label === 'P4')?.times).toEqual(t('12:10', '13:10'));
	});

	test('a shared row is taken in the default’s name, and an Event finds its own row', () => {
		const rows = dayRows([upper, lower]);
		const shared = rows.find((r) => r.label === 'Break')!;
		expect(shared.scheduleId).toBe('lower');
		expect(rowIndexOf(rows, 8, 'upper')).toBe(rows.indexOf(shared));
		expect(rows[rowIndexOf(rows, 9, 'upper')].label).toBe('Lunch (Upper)');
		expect(rows[rowIndexOf(rows, 4, null)].label).toBe('P4');
	});
});
