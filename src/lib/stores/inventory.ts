import { writable } from 'svelte/store';
import type { InventoryItem } from '$lib/types';
import { createId } from '$lib/utils/id';

const STORAGE_KEY = 'mover_inventory';

function load(): InventoryItem[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : [];
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
			persist((items) => [
				{ ...item, id: createId(), createdAt: Date.now() },
				...items
			]);
		},

		update(id: string, partial: Partial<InventoryItem>) {
			persist((items) =>
				items.map((it) => (it.id === id ? { ...it, ...partial } : it))
			);
		},

		remove(id: string) {
			persist((items) => items.filter((it) => it.id !== id));
		},

		duplicate(id: string): string {
			let newId = '';
			persist((items) => {
				const src = items.find((it) => it.id === id);
				if (!src) return items;
				newId = createId();
				const copy = {
					...src,
					id: newId,
					name: `${src.name} (copy)`,
					createdAt: Date.now(),
					// Don't copy generated 3D model URL — it stays with the original item
					modelUrl: undefined
				};
				// Insert the copy right after the original
				const idx = items.indexOf(src);
				const next = [...items];
				next.splice(idx + 1, 0, copy);
				return next;
			});
			return newId;
		},

		addContent(id: string, content: string) {
			persist((items) =>
				items.map((it) =>
					it.id === id ? { ...it, contents: [...it.contents, content] } : it
				)
			);
		},

		removeContent(id: string, index: number) {
			persist((items) =>
				items.map((it) =>
					it.id === id
						? { ...it, contents: it.contents.filter((_, i) => i !== index) }
						: it
				)
			);
		},

		exportJSON(): string {
			const items = load();
			return JSON.stringify(items, null, 2);
		},

		importJSON(json: string) {
			try {
				const items: InventoryItem[] = JSON.parse(json);
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
