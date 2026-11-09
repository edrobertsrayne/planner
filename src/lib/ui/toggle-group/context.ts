import { getContext, setContext } from 'svelte';

export interface ToggleGroupContext {
	readonly value: string;
	select(value: string): void;
}

const KEY = Symbol('toggle-group');
export const setToggleGroupContext = (ctx: ToggleGroupContext) => setContext(KEY, ctx);
export const getToggleGroupContext = () => getContext<ToggleGroupContext>(KEY);
