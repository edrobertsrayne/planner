import { getContext, setContext } from 'svelte';

export interface DialogContext {
	readonly titleId: string;
	readonly descriptionId: string;
	readonly open: boolean;
	setOpen(open: boolean): void;
}

const KEY = Symbol('dialog');
export const setDialogContext = (ctx: DialogContext) => setContext(KEY, ctx);
export const getDialogContext = () => getContext<DialogContext>(KEY);
