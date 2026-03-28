import { writable } from 'svelte/store';

export const editingItemId = writable<string | null>(null);
export const measurementPhoto = writable<string | null>(null);

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
// Depth source detection (replaces triposr server check)
// ---------------------------------------------------------------------------
import { isArDepthAvailable } from '$lib/utils/arDepth';
import { writable as _writable } from 'svelte/store';

/** True if the device has LiDAR + WebXR depth-sensing (iPhone 12 Pro+) */
export const arDepthAvailable = (() => {
	const { subscribe, set } = _writable(false);
	if (typeof window !== 'undefined') {
		isArDepthAvailable().then(set);
	}
	return { subscribe };
})();
