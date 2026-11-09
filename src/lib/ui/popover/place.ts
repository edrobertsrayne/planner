// Positions a top-layer element beside its trigger, flipping to the other side when it would leave
// the viewport. The element is `position: fixed` (a popover lives in the top layer), so the
// coordinates are viewport coordinates and need no scroll offset.
export type Side = 'top' | 'bottom' | 'left' | 'right';
export type Align = 'start' | 'center' | 'end';

export function place(
	content: HTMLElement,
	trigger: HTMLElement,
	{ side = 'bottom', align = 'center', gap = 6 }: { side?: Side; align?: Align; gap?: number }
) {
	const t = trigger.getBoundingClientRect();
	const c = content.getBoundingClientRect();
	const vw = document.documentElement.clientWidth;
	const vh = document.documentElement.clientHeight;
	const horizontal = side === 'left' || side === 'right';

	let s = side;
	if (s === 'bottom' && t.bottom + gap + c.height > vh && t.top - gap - c.height >= 0) s = 'top';
	else if (s === 'top' && t.top - gap - c.height < 0 && t.bottom + gap + c.height <= vh)
		s = 'bottom';

	let top: number;
	let left: number;
	if (horizontal) {
		left = s === 'left' ? t.left - gap - c.width : t.right + gap;
		top =
			align === 'start'
				? t.top
				: align === 'end'
					? t.bottom - c.height
					: t.top + (t.height - c.height) / 2;
	} else {
		top = s === 'top' ? t.top - gap - c.height : t.bottom + gap;
		left =
			align === 'start'
				? t.left
				: align === 'end'
					? t.right - c.width
					: t.left + (t.width - c.width) / 2;
	}
	left = Math.min(Math.max(8, left), Math.max(8, vw - c.width - 8));
	top = Math.min(Math.max(8, top), Math.max(8, vh - c.height - 8));
	content.style.top = `${top}px`;
	content.style.left = `${left}px`;
	content.style.setProperty('--trigger-width', `${t.width}px`);
}
