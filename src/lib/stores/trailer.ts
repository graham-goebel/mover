import { writable, derived } from 'svelte/store';
import type { TrailerPreset, PackResult } from '$lib/types';

export const TRAILER_PRESETS: TrailerPreset[] = [
	{ name: 'Cargo Van', length: 10, width: 5.5, height: 4.5 },
	{ name: 'Small Trailer (5×8)', length: 8, width: 5, height: 5 },
	{ name: 'Medium Trailer (6×12)', length: 12, width: 6, height: 6.5 },
	{ name: 'Large Trailer (8.5×20)', length: 20, width: 8, height: 8 },
	{ name: '26ft Box Truck', length: 26, width: 8, height: 8 }
];

const STORAGE_KEY = 'mover_trailer';

function loadTrailer(): TrailerPreset {
	if (typeof localStorage === 'undefined') return TRAILER_PRESETS[2];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : TRAILER_PRESETS[2];
	} catch {
		return TRAILER_PRESETS[2];
	}
}

function createTrailerStore() {
	const { subscribe, set } = writable<TrailerPreset>(loadTrailer());

	return {
		subscribe,
		select(preset: TrailerPreset) {
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(preset));
			}
			set(preset);
		},
		setCustom(length: number, width: number, height: number) {
			const custom: TrailerPreset = { name: 'Custom', length, width, height };
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
			}
			set(custom);
		}
	};
}

export const trailer = createTrailerStore();

export const packResult = writable<PackResult | null>(null);

export const loadOrderStep = writable<number>(0);

export const trailerVolume = derived(trailer, ($t) => $t.length * $t.width * $t.height);
