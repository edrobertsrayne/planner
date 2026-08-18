// The one place a Session's selection lives: a Class, a date and a Period identify the occasion
// (ADR-0002), never a Session row id. Module-scoped state so the selection survives navigating
// between tabs — the root layout renders the panel once, alongside whichever tab is active, and
// this store is what the SessionPanel and every reading view share (issue #35).
export interface Occasion {
	classId: string;
	date: string;
	period: number;
}

class SessionPanelStore {
	selected: Occasion | null = $state(null);

	open(occasion: Occasion) {
		this.selected = occasion;
	}

	close() {
		this.selected = null;
	}
}

export const sessionPanel = new SessionPanelStore();
