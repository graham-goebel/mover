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
import type { RemotePackState } from '$lib/supabase';
import { normalizeContents } from '$lib/types';
import { inventory } from '$lib/stores/inventory';
import { moveDate, moveRoute } from '$lib/stores/app';
import { trailer, packResult, packResultToRemote } from '$lib/stores/trailer';
import type { PackResult } from '$lib/types';
import type { InventoryItem, TrailerPreset } from '$lib/types';

export const currentUser = writable<User | null>(null);

let syncedUserId: string | null = null;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

// ── Initial data sync on login ────────────────────────────────────────────────

export async function syncUserData(userId: string) {
	if (syncedUserId === userId) return;
	syncedUserId = userId;

	const remoteItems = await fetchInventory(userId);

	if (remoteItems.length > 0) {
		// Remote is authoritative — replace local store entirely
		inventory.setAll(remoteItems);
	} else {
		// Remote is empty (first sign-in) — migrate local items up to Supabase
		let localItems: InventoryItem[] = [];
		const unsub = inventory.subscribe((v) => (localItems = v));
		unsub();
		for (const item of localItems) {
			await upsertItem(userId, item);
		}
	}

	// 2. Pull remote settings (including trailer + pack state)
	const settings = await fetchSettings(userId);
	if (settings) {
		if (settings.moveDate) moveDate.set(settings.moveDate);
		if (settings.moveRoute) moveRoute.set(settings.moveRoute);

		if (settings.trailer) {
			trailer.setFromRemote(settings.trailer as TrailerPreset);
		} else {
			let localTrailer: TrailerPreset | null = null;
			const unsub = trailer.subscribe((v) => (localTrailer = v));
			unsub();
			if (localTrailer) await upsertSettings(userId, { trailer: localTrailer });
		}

		if (settings.packState) {
			let currentItems: InventoryItem[] = [];
			const unsub = inventory.subscribe((v) => (currentItems = v));
			unsub();
			packResult.setFromRemote(settings.packState, currentItems);
		} else {
			let localPack: PackResult | null = null;
			const unsub = packResult.subscribe((v) => (localPack = v));
			unsub();
			if (localPack) {
				await upsertSettings(userId, { packState: packResultToRemote(localPack) });
			}
		}
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
						important: Boolean(row.important),
						room: row.room ?? undefined,
						notes: row.notes ?? undefined,
						contents: normalizeContents(row.contents),
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

export async function syncTrailer(preset: TrailerPreset) {
	const user = await getUser();
	if (!user) return;
	await upsertSettings(user.id, { trailer: preset });
}

export async function syncPackState(state: RemotePackState | null) {
	const user = await getUser();
	if (!user) return;
	await upsertSettings(user.id, { packState: state });
}

async function getUser() {
	const { data } = await supabase.auth.getUser();
	return data?.user ?? null;
}
