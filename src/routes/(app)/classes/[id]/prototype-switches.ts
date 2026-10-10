// PROTOTYPE, throwaway (#372, #382). Decided in #372: a Lesson moves only by drag, and every
// change waits for Save. #382 adds select mode and asks to see it in both layouts on both
// surfaces, and to compare two Topic panels: (a) Remove Topic and (c) Select Topic.
export type Layout = 'list' | 'weeks';
export type Control = 'buttons' | 'drag' | 'tick';
export type TopicPanel = 'remove' | 'select';

export function prototypeSwitches(
	classId: string,
	surface: 'class' | 'planning',
	params: URLSearchParams
) {
	const layout: Layout =
		params.get('layout') === 'list' || params.get('layout') === 'weeks'
			? (params.get('layout') as Layout)
			: surface === 'class'
				? 'weeks'
				: 'list';
	const topicPanel: TopicPanel = params.get('topics') === 'select' ? 'select' : 'remove';
	const control: Control = 'drag';
	const draft = true;

	return {
		layout,
		topicPanel,
		control,
		draft,
		switches: [
			{
				param: 'surface',
				label: 'Surface',
				current: surface,
				options: [
					{ value: 'class', name: 'Class page', href: `/classes/${classId}` },
					{
						value: 'planning',
						name: 'Planning',
						href: `/planning?class=${classId}&proto=1`
					}
				]
			},
			{
				param: 'layout',
				label: 'Layout',
				current: layout,
				options: [
					{ value: 'weeks', name: 'By week' },
					{ value: 'list', name: 'List' }
				]
			},
			{
				param: 'topics',
				label: 'Topic panel',
				current: topicPanel,
				options: [
					{ value: 'remove', name: '(a) Remove Topic' },
					{ value: 'select', name: '(c) Select Topic' }
				]
			}
		]
	};
}
