import { getContext, setContext } from 'svelte';

export interface TabsContext {
	readonly value: string;
	select(value: string): void;
}

const KEY = Symbol('tabs');
export const setTabsContext = (ctx: TabsContext) => setContext(KEY, ctx);
export const getTabsContext = () => getContext<TabsContext>(KEY);
