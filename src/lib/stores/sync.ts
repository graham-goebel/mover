/**
 * Sync store — bridges Supabase with local Svelte stores.
 *
 * Strategy:
 * - On sign-in: pull remote data and merge with localStorage
 *   (remote wins for items that exist remotely, local-only items are pushed up)
 * - On every local write: the inventory/app stores call the sync helpers here
 * - Real-time: Supabase Realtime subscription keeps inventory live across tabs/devices
 */

import { writable } from 'svelte/store';
import type { User } from '@supabase/supabase-js';
import { supabase, fetchInventory, upsertItem, deleteItem, fetchSettings, upsertSettings, uploadPhoto } from '$lib/supabase';
import { inventory } from '$lib/stores/inventory';
import { moveDate, moveRoute } from '$lib/stores/app';
import type { InventoryItem } from '$lib/types';

export const currentUser = writable<User | null>(null);

let syncedUserId: string | null = null;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

// ── Initial data sync on login ────────────────────────────────────────────────

export async function syncUserData(userId: string) {
	if (syncedUserId === userId) return; // already synced this session
	syncedUserId = userId;

	// 1. Pull remote inventory
	const remoteItems = await fetchInventory(userId);

	if (remoteItems.length > 0) {
		// Remote has data — use it as source of truth, then push any local-only items
		let localItems: InventoryItem[] = [];
		const unsub = inventory.subscribe((v) => (localItems = v));
		unsub();

		const remoteIds = new Set(remoteItems.map((it) => it.id));
		const localOnly = localItems.filter((it) => !remoteIds.has(it.id));

		// Set store to remote items first
		inventory.setAll(remoteItems);

		// Push any local-only items up
		for (const item of localOnly) {
			await upsertItem(userId, item);
		}
		if (localOnly.length > 0) {
			// Re-merge into store
			inventory.setAll([...remoteItems, ...localOnly]);
		}
	} else {
		// Remote is empty — push current local inventory up
		let localItems: InventoryItem[] = [];
		const unsub = inventory.subscribe((v) => (localItems = v));
		unsub();
		for (const item of localItems) {
			await upsertItem(userId, item);
		}
	}

	// 2. Pull remote settings
	const settings = await fetchSettings(userId);
	if (settings) {
		if (settings.moveDate) moveDate.set(settings.moveDate);
		if (settings.moveRoute) moveRoute.set(settings.moveRoute);
		// trailer sync handled separately if needed
	}

	// 3. Subscribe to real-time changes
	startRealtime(userId);
}

function startRealtime(userId: string) {
	if (realtimeChannel) {
		supabase.removeChannel(realtimeChannel);
	}

	realtimeChannel = supabase
		.channel(`inventory:${userId}`)
		.on(
			'postgres_changes',
			{
				event: '*',
				schema: 'public',
				table: 'inventory_items',
				filter: `user_id=eq.${userId}`
			},
			(payload) => {
				if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const row = payload.new as any;
					const item: InventoryItem = {
						id: row.id,
						name: row.name,
						photo: row.photo_url ?? '',
						dimensions: row.dimensions,
						weight: row.weight ?? undefined,
						category: row.category,
						shape: row.shape,
						fragile: Boolean(row.fragile),
						stackable: row.stackable !== false,
						forSale: Boolean(row.for_sale),
						donate: Boolean(row.donate),
						room: row.room ?? undefined,
						notes: row.notes ?? undefined,
						contents: row.contents ?? [],
						modelUrl: row.model_url ?? undefined,
						createdAt: new Date(row.created_at).getTime()
					};
					inventory.upsertFromRemote(item);
				} else if (payload.eventType === 'DELETE') {
					inventory.removeFromRemote(payload.old.id as string);
				}
			}
		)
		.subscribe();
}

// ── Write-through helpers called from the stores ──────────────────────────────

export async function syncItemUpsert(item: InventoryItem) {
	const user = await getUser();
	if (!user) return;

	// If photo is a base64 data URL, upload to Storage first
	let finalItem = item;
	if (item.photo && item.photo.startsWith('data:')) {
		const url = await uploadPhoto(user.id, item.id, item.photo);
		if (url) {
			finalItem = { ...item, photo: url };
			// Update local store with the Storage URL (no more base64 in localStorage)
			inventory.updatePhotoUrl(item.id, url);
		}
	}

	await upsertItem(user.id, finalItem);
}

export async function syncItemDelete(itemId: string) {
	const user = await getUser();
	if (!user) return;
	await deleteItem(itemId);
}

export async function syncSettings(partial: { moveDate?: string | null; moveRoute?: unknown; trailer?: unknown }) {
	const user = await getUser();
	if (!user) return;
	await upsertSettings(user.id, {
		moveDate: partial.moveDate,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		moveRoute: partial.moveRoute as any,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		trailer: partial.trailer as any
	});
}

async function getUser() {
	const { data } = await supabase.auth.getUser();
	return data?.user ?? null;
}
