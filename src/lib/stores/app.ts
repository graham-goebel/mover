import { writable } from 'svelte/store';

export const editingItemId = writable<string | null>(null);
export const measurementPhoto = writable<string | null>(null);
