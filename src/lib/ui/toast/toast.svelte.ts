// The app's transient messages. `toast.error(text)` and friends append to a list the <Toaster />
// renders; each leaves on its own after a few seconds, or when dismissed. The content is text or a
// component, for a message with structure of its own (a report, a role).
import type { Component } from 'svelte';

export type ToastKind = 'message' | 'success' | 'error';

interface ToastOptions {
	description?: string;
	action?: { label: string; onClick: () => void };
	// For a component as content: the props it is rendered with.
	componentProps?: Record<string, unknown>;
	duration?: number;
}

export interface ToastItem extends ToastOptions {
	id: number;
	kind: ToastKind;
	text?: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	component?: Component<any>;
}

const DEFAULT_DURATION_MS = 5000;

class ToastStore {
	items = $state<ToastItem[]>([]);
	#next = 0;

	add(kind: ToastKind, content: string | ToastItem['component'], options: ToastOptions = {}) {
		const id = this.#next++;
		const item: ToastItem =
			typeof content === 'string'
				? { id, kind, text: content, ...options }
				: { id, kind, component: content, ...options };
		this.items.push(item);
		setTimeout(() => this.dismiss(id), options.duration ?? DEFAULT_DURATION_MS);
		return id;
	}

	dismiss(id: number) {
		this.items = this.items.filter((t) => t.id !== id);
	}
}

export const toasts = new ToastStore();

type Content = string | NonNullable<ToastItem['component']>;
export const toast = Object.assign(
	(content: Content, options?: ToastOptions) => toasts.add('message', content, options),
	{
		message: (content: Content, options?: ToastOptions) => toasts.add('message', content, options),
		success: (content: Content, options?: ToastOptions) => toasts.add('success', content, options),
		error: (content: Content, options?: ToastOptions) => toasts.add('error', content, options),
		custom: (component: NonNullable<ToastItem['component']>, options?: ToastOptions) =>
			toasts.add('message', component, options)
	}
);
