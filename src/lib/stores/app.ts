import { writable } from 'svelte/store';
import { isArDepthAvailable } from '$lib/utils/arDepth';

export const editingItemId = writable<string | null>(null);
export const measurementPhoto = writable<string | null>(null);

// ---------------------------------------------------------------------------
// Move date — persisted to localStorage
// ---------------------------------------------------------------------------
const MOVE_DATE_KEY = 'mover_move_date';

function loadMoveDate(): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(MOVE_DATE_KEY);
}

function createMoveDateStore() {
	const { subscribe, set: _set } = writable<string | null>(loadMoveDate());

	function persist(value: string | null) {
		if (typeof localStorage !== 'undefined') {
			if (value) localStorage.setItem(MOVE_DATE_KEY, value);
			else localStorage.removeItem(MOVE_DATE_KEY);
		}
		_set(value);
	}

	return { subscribe, set: persist };
}

export const moveDate = createMoveDateStore();

// ---------------------------------------------------------------------------
// Accordion open/closed states — persisted to localStorage
// ---------------------------------------------------------------------------
const ACCORDION_KEY = 'mover_accordions';

function loadAccordionState(): Record<string, boolean> {
	if (typeof localStorage === 'undefined') return {};
	try {
		const raw = localStorage.getItem(ACCORDION_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch { return {}; }
}

function createAccordionStore() {
	let state = loadAccordionState();
	const { subscribe, set: _set } = writable<Record<string, boolean>>(state);

	function toggle(id: string, open: boolean) {
		state = { ...state, [id]: open };
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(ACCORDION_KEY, JSON.stringify(state));
		}
		_set(state);
	}

	function isOpen(id: string, defaultOpen = true): boolean {
		return state[id] ?? defaultOpen;
	}

	return { subscribe, toggle, isOpen };
}

export const accordionState = createAccordionStore();

// ---------------------------------------------------------------------------
// LiDAR / WebXR depth-sensing availability
// ---------------------------------------------------------------------------

/** True if the device has LiDAR + WebXR depth-sensing (iPhone 12 Pro+) */
function createArDepthStore() {
	const { subscribe, set } = writable(false);
	if (typeof window !== 'undefined') {
		isArDepthAvailable().then(set);
	}
	return { subscribe };
}

export const arDepthAvailable = createArDepthStore();
