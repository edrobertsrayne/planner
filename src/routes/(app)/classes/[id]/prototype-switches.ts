// PROTOTYPE, throwaway (#372). Decided: the Class page shows By week, Planning shows List, a
// Lesson moves only by drag, and every change waits for Save. One switch is left: the surface.
export type Layout = 'list' | 'weeks';
export type Control = 'buttons' | 'drag' | 'tick';

export function prototypeSwitches(classId: string, surface: 'class' | 'planning') {
	const layout: Layout = surface === 'class' ? 'weeks' : 'list';
	const control: Control = 'drag';
	const draft = true;

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
					{ value: 'class', name: 'Class page (By week)', href: `/classes/${classId}` },
					{
						value: 'planning',
						name: 'Planning (List)',
						href: `/planning?class=${classId}&proto=1`
					}
				]
			}
		]
	};
}
