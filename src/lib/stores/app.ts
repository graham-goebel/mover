import { writable } from 'svelte/store';
import { isArDepthAvailable } from '$lib/utils/arDepth';

export const editingItemId = writable<string | null>(null);
export const measurementPhoto = writable<string | null>(null);

// ---------------------------------------------------------------------------
// Theme — persisted to localStorage, applied via data-theme on <html>
// ---------------------------------------------------------------------------
const THEME_KEY = 'mover_theme';
export type Theme = 'dark' | 'light';

function createThemeStore() {
	const initial: Theme =
		typeof localStorage !== 'undefined'
			? ((localStorage.getItem(THEME_KEY) as Theme | null) ?? 'dark')
			: 'dark';

	const { subscribe, set: _set } = writable<Theme>(initial);

	// Apply immediately on client (catches page loads after app.html script)
	if (typeof document !== 'undefined') {
		document.documentElement.setAttribute('data-theme', initial);
	}

	function set(value: Theme) {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(THEME_KEY, value);
		}
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('data-theme', value);
		}
		_set(value);
	}

	return { subscribe, set };
}

export const theme = createThemeStore();

/** Controls the settings sheet visibility */
export const settingsOpen = writable(false);

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
// Move route (origin / destination labels + miles) — for Overview map
// ---------------------------------------------------------------------------
export type MoveRoute = {
	origin: string;
	destination: string;
	/** Driving distance in miles; user-entered or null */
	miles: number | null;
};

const MOVE_ROUTE_KEY = 'mover_move_route';

function loadMoveRoute(): MoveRoute {
	if (typeof localStorage === 'undefined') {
		return { origin: '', destination: '', miles: null };
	}
	try {
		const raw = localStorage.getItem(MOVE_ROUTE_KEY);
		if (!raw) return { origin: '', destination: '', miles: null };
		const p = JSON.parse(raw) as Record<string, unknown>;
		const milesRaw = p.miles;
		let miles: number | null = null;
		if (typeof milesRaw === 'number' && Number.isFinite(milesRaw) && milesRaw >= 0) {
			miles = milesRaw;
		} else if (typeof milesRaw === 'string' && milesRaw.trim() !== '') {
			const n = parseFloat(milesRaw);
			if (Number.isFinite(n) && n >= 0) miles = n;
		}
		return {
			origin: typeof p.origin === 'string' ? p.origin : '',
			destination: typeof p.destination === 'string' ? p.destination : '',
			miles
		};
	} catch {
		return { origin: '', destination: '', miles: null };
	}
}

function createMoveRouteStore() {
	const { subscribe, set: _set, update: _update } = writable<MoveRoute>(loadMoveRoute());

	function persist(value: MoveRoute) {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(MOVE_ROUTE_KEY, JSON.stringify(value));
		}
		_set(value);
	}

	return {
		subscribe,
		set: persist,
		update(fn: (r: MoveRoute) => MoveRoute) {
			_update((r) => {
				const next = fn(r);
				if (typeof localStorage !== 'undefined') {
					localStorage.setItem(MOVE_ROUTE_KEY, JSON.stringify(next));
				}
				return next;
			});
		}
	};
}

export const moveRoute = createMoveRouteStore();

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
