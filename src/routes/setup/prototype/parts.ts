// PROTOTYPE ONLY (issue #314). Shared bits for the Login and Setup variants.
import { toast } from 'svelte-sonner';

/** A card that loses its frame below `sm` when the page is flush. */
export function card(flush: boolean) {
	return flush ? 'max-sm:border-0 max-sm:bg-transparent max-sm:shadow-none max-sm:ring-0' : '';
}
export function cardPad(flush: boolean) {
	return flush ? 'max-sm:px-0' : '';
}

/** Phone-sized targets, as the Agenda decision set them (44 px). */
export const TAP = 'max-sm:h-11';

/** Every write is a stub: the prototype asks how the screen looks, not whether it works. */
export function stub(event?: Event) {
	event?.preventDefault();
	toast.info('Prototype: nothing was sent.');
}
