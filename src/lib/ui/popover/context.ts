import { getContext, setContext } from 'svelte';

export interface PopoverContext {
	readonly id: string;
	readonly open: boolean;
	setOpen(open: boolean): void;
}

const KEY = Symbol('popover');
export const setPopoverContext = (ctx: PopoverContext) => setContext(KEY, ctx);
export const getPopoverContext = () => getContext<PopoverContext>(KEY);
