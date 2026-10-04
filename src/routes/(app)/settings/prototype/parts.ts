// PROTOTYPE ONLY (issue #314). Shared copy and stubbed writes for the Settings variants.
import { toast } from 'svelte-sonner';

export const COPY = {
	password: {
		title: 'Change password',
		help: 'There is no reset by email. If you forget it, run `bun run reset:credentials` on the server.',
		footer: 'Logs out every other device.'
	},
	apiKey: {
		title: 'API key',
		help: 'Lets an agent read and write your Courses, Topics, Lessons and Links. Regenerating replaces it: the old key stops working at once.'
	},
	backup: {
		title: 'Backup',
		help: 'Saves everything in the planner to one file: every record and every Attachment. Restore it into a new planner from the setup screen.'
	}
};

/** Every write is a stub: the prototype asks how Settings looks, not whether it saves. */
export function stub(event?: Event) {
	event?.preventDefault();
	toast.info('Prototype: nothing was saved.');
}
