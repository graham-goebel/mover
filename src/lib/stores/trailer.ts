import { writable, derived } from 'svelte/store';
import type { TrailerPreset, PackResult, PackedItem, InventoryItem } from '$lib/types';
import type { RemotePackState } from '$lib/supabase';

export const TRAILER_PRESETS: TrailerPreset[] = [
	{ name: 'Cargo Van', length: 10, width: 5.5, height: 4.5, payloadLbs: 1500 },
	{ name: 'Small Trailer (5×8)', length: 8, width: 5, height: 5, payloadLbs: 2000 },
	{ name: 'Medium Trailer (6×12)', length: 12, width: 6, height: 6.5, payloadLbs: 2900 },
	{ name: 'Large Trailer (8.5×20)', length: 20, width: 8, height: 8, payloadLbs: 7000 },
	{ name: '26ft Box Truck', length: 26, width: 8, height: 8, payloadLbs: 12000 }
];

const STORAGE_KEY = 'mover_trailer';
const DEFAULT_CUSTOM_PAYLOAD = 2500;

function migrateTrailer(raw: TrailerPreset): TrailerPreset {
	const pl = raw.payloadLbs;
	if (raw.name === 'Custom') {
		return {
			...raw,
			payloadLbs: typeof pl === 'number' && pl > 0 ? pl : DEFAULT_CUSTOM_PAYLOAD
		};
	}
	const match = TRAILER_PRESETS.find((p) => p.name === raw.name);
	const fallback = match ?? TRAILER_PRESETS[2];
	return {
		...raw,
		payloadLbs: typeof pl === 'number' && pl > 0 ? pl : fallback.payloadLbs
	};
}

function loadTrailer(): TrailerPreset {
	if (typeof localStorage === 'undefined') return TRAILER_PRESETS[2];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return TRAILER_PRESETS[2];
		return migrateTrailer(JSON.parse(raw) as TrailerPreset);
	} catch {
		return TRAILER_PRESETS[2];
	}
}

function createTrailerStore() {
	const { subscribe, set } = writable<TrailerPreset>(loadTrailer());

	function persist(preset: TrailerPreset) {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(preset));
		}
		set(preset);
	}

	return {
		subscribe,
		select(preset: TrailerPreset) {
			persist(preset);
		},
		setCustom(length: number, width: number, height: number) {
			persist({
				name: 'Custom',
				length,
				width,
				height,
				payloadLbs: DEFAULT_CUSTOM_PAYLOAD
			});
		},
		/** Apply trailer from Supabase — writes to localStorage but does NOT trigger a sync back. */
		setFromRemote(preset: TrailerPreset) {
			const migrated = migrateTrailer(preset);
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
			}
			set(migrated);
		}
	};
}

export const trailer = createTrailerStore();

const PACK_KEY = 'mover_pack_result';

function loadPackResult(): PackResult | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(PACK_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}

function createPackResultStore() {
	const { subscribe, set: _set } = writable<PackResult | null>(loadPackResult());

	function persist(value: PackResult | null) {
		if (typeof localStorage !== 'undefined') {
			if (value) {
				localStorage.setItem(PACK_KEY, JSON.stringify(value));
			} else {
				localStorage.removeItem(PACK_KEY);
			}
		}
		_set(value);
	}

	return {
		subscribe,
		set: persist,
		/** Restore pack result from remote state + current inventory. */
		setFromRemote(remote: RemotePackState, allItems: InventoryItem[]) {
			const itemMap = new Map(allItems.map(i => [i.id, i]));
			const placed: PackedItem[] = [];
			const unplacedIds = new Set(remote.packedItemIds);

			for (const p of remote.placements) {
				const item = itemMap.get(p.itemId);
				if (!item) continue;
				placed.push({ item, position: p.position, rotation: p.rotation, color: p.color });
				unplacedIds.delete(p.itemId);
			}

			const unplaced: InventoryItem[] = [];
			for (const id of unplacedIds) {
				const item = itemMap.get(id);
				if (item) unplaced.push(item);
			}

			persist({ placed, unplaced, utilization: remote.utilization });
		}
	};
}

/** Convert a PackResult to the lean remote format for Supabase. */
export function packResultToRemote(result: PackResult): RemotePackState {
	return {
		packedItemIds: [
			...result.placed.map(p => p.item.id),
			...result.unplaced.map(u => u.id)
		],
		placements: result.placed.map(p => ({
			itemId: p.item.id,
			position: p.position,
			rotation: p.rotation,
			color: p.color
		})),
		utilization: result.utilization
	};
}

export const packResult = createPackResultStore();

export const loadOrderStep = writable<number>(0);

export const trailerVolume = derived(trailer, ($t) => $t.length * $t.width * $t.height);
