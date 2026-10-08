// PROTOTYPE, throwaway (#372). The four switches, read from and written to the URL, shared by
// the Class page and Planning so both surfaces offer the same combinations.
export type Layout = 'list' | 'weeks';
export type Control = 'buttons' | 'drag' | 'tick';

export function prototypeSwitches(url: URL, classId: string, surface: 'class' | 'planning') {
	const layout: Layout = url.searchParams.get('layout') === 'weeks' ? 'weeks' : 'list';
	const c = url.searchParams.get('move');
	const control: Control = c === 'drag' || c === 'tick' ? c : 'buttons';
	const draft = url.searchParams.get('keep') === 'draft';

	return {
		layout,
		control,
		draft,
		switches: [
			{
				param: 'surface',
				label: 'Surface',
				current: surface,
				options: [
					{ value: 'class', name: 'Class page', href: `/classes/${classId}` },
					{ value: 'planning', name: 'Planning', href: `/planning?class=${classId}&proto=1` }
				]
			},
			{
				param: 'layout',
				label: 'Layout',
				current: layout,
				options: [
					{ value: 'list', name: 'List' },
					{ value: 'weeks', name: 'By week' }
				]
			},
			{
				param: 'move',
				label: 'Move',
				current: control,
				options: [
					{ value: 'buttons', name: 'Buttons' },
					{ value: 'drag', name: 'Drag' },
					{ value: 'tick', name: 'Tick + move' }
				]
			},
			{
				param: 'keep',
				label: 'Keep',
				current: draft ? 'draft' : 'now',
				options: [
					{ value: 'now', name: 'At once' },
					{ value: 'draft', name: 'Draft + Save' }
				]
			}
		]
	};
}
