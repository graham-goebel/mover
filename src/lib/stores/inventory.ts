import { writable } from 'svelte/store';
import { normalizeContents, type InventoryItem } from '$lib/types';
import { createId } from '$lib/utils/id';

const STORAGE_KEY = 'mover_inventory';

/** Ensure new boolean fields exist on items loaded from older localStorage / JSON */
function migrateItem(it: InventoryItem): InventoryItem {
	return {
		...it,
		donate: Boolean(it.donate),
		forSale: Boolean(it.forSale),
		fragile: Boolean(it.fragile),
		stackable: it.stackable !== false,
		important: Boolean(it.important),
		contents: normalizeContents(it.contents)
	};
}

function load(): InventoryItem[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.map((row) => migrateItem(row as InventoryItem));
	} catch {
		return [];
	}
}

function save(items: InventoryItem[]) {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function createInventoryStore() {
	const { subscribe, update, set } = writable<InventoryItem[]>(load());

	// Lazy import sync to avoid circular deps at module init time
	async function remoteupsert(item: InventoryItem) {
		try {
			const { syncItemUpsert } = await import('$lib/stores/sync');
			syncItemUpsert(item);
		} catch { /* offline or not authed */ }
	}

	async function remotedelete(id: string) {
		try {
			const { syncItemDelete } = await import('$lib/stores/sync');
			syncItemDelete(id);
		} catch { /* offline or not authed */ }
	}

	function persist(fn: (items: InventoryItem[]) => InventoryItem[]) {
		update((items) => {
			const next = fn(items);
			save(next);
			return next;
		});
	}

	return {
		subscribe,

		add(item: Omit<InventoryItem, 'id' | 'createdAt'>) {
			const newItem = { ...item, id: createId(), createdAt: Date.now() };
			persist((items) => [newItem, ...items]);
			remoteupsert(newItem);
		},

		update(id: string, partial: Partial<InventoryItem>) {
			let updated: InventoryItem | null = null;
			persist((items) => {
				const next = items.map((it) => {
					if (it.id !== id) return it;
					updated = { ...it, ...partial };
					return updated;
				});
				return next;
			});
			if (updated) remoteupsert(updated);
		},

		remove(id: string) {
			persist((items) => items.filter((it) => it.id !== id));
			remotedelete(id);
		},

		duplicate(id: string): string {
			let newId = '';
			let copy: InventoryItem | null = null;
			persist((items) => {
				const src = items.find((it) => it.id === id);
				if (!src) return items;
				newId = createId();
				copy = {
					...src,
					id: newId,
					name: `${src.name} (copy)`,
					createdAt: Date.now(),
					modelUrl: undefined
				};
				const idx = items.indexOf(src);
				const next = [...items];
				next.splice(idx + 1, 0, copy);
				return next;
			});
			if (copy) remoteupsert(copy);
			return newId;
		},

		addContent(id: string, text: string) {
			let updated: InventoryItem | null = null;
			persist((items) =>
				items.map((it) => {
					if (it.id !== id) return it;
					updated = { ...it, contents: [...it.contents, { text, important: false }] };
					return updated;
				})
			);
			if (updated) remoteupsert(updated);
		},

		removeContent(id: string, index: number) {
			let updated: InventoryItem | null = null;
			persist((items) =>
				items.map((it) => {
					if (it.id !== id) return it;
					updated = { ...it, contents: it.contents.filter((_, i) => i !== index) };
					return updated;
				})
			);
			if (updated) remoteupsert(updated);
		},

		toggleContentImportant(id: string, index: number) {
			let updated: InventoryItem | null = null;
			persist((items) =>
				items.map((it) => {
					if (it.id !== id) return it;
					const next = it.contents.map((c, i) =>
						i === index ? { ...c, important: !c.important } : c
					);
					updated = { ...it, contents: next };
					return updated;
				})
			);
			if (updated) remoteupsert(updated);
		},

		// ── Remote-only helpers (called by sync.ts) ────────────────────────────

		/** Merge a remotely-received item into the store without triggering another remote write */
		upsertFromRemote(item: InventoryItem) {
			update((items) => {
				const idx = items.findIndex((it) => it.id === item.id);
				let next: InventoryItem[];
				if (idx >= 0) {
					next = items.map((it) => (it.id === item.id ? item : it));
				} else {
					next = [item, ...items];
				}
				save(next);
				return next;
			});
		},

		/** Remove a remotely-deleted item without triggering another remote delete */
		removeFromRemote(id: string) {
			update((items) => {
				const next = items.filter((it) => it.id !== id);
				save(next);
				return next;
			});
		},

		/** Replace entire store (used on initial sync) */
		setAll(items: InventoryItem[]) {
			save(items);
			set(items);
		},

		/** Update only the photo URL after Storage upload */
		updatePhotoUrl(id: string, photoUrl: string) {
			update((items) => {
				const next = items.map((it) => (it.id === id ? { ...it, photo: photoUrl } : it));
				save(next);
				return next;
			});
		},

		// ── Import / Export ────────────────────────────────────────────────────

		exportJSON(): string {
			const items = load();
			return JSON.stringify(items, null, 2);
		},

		importJSON(json: string) {
			try {
				const parsed: unknown = JSON.parse(json);
				if (!Array.isArray(parsed)) throw new Error('Invalid JSON');
				const items = parsed.map((row) => migrateItem(row as InventoryItem));
				save(items);
				set(items);
			} catch {
				throw new Error('Invalid JSON');
			}
		},

		clear() {
			save([]);
			set([]);
		}
	};
}

export const inventory = createInventoryStore();
