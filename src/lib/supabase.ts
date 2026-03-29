import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import type { InventoryItem } from '$lib/types';

/**
 * Production defaults — anon key is public by design; RLS enforces access.
 * Used when `$env/dynamic/public` is empty (chunk loads before env.js, stale SW, etc.).
 */
const FALLBACK_SUPABASE_URL = 'https://qdtzvewcbsqrjauarcku.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkdHp2ZXdjYnNxcmphdWFyY2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MDcxOTMsImV4cCI6MjA5MDM4MzE5M30.jI0ZThydv74R4iOZ8asMOX93XKZqNzP42rLItClzg2A';

function resolveUrlAndKey(): { url: string; key: string } {
	const url = (env.PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL).trim();
	const key = (env.PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY).trim();
	return { url, key };
}

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
	if (_client) return _client;
	const { url, key } = resolveUrlAndKey();
	if (!url || !key) {
		throw new Error('Supabase is not configured (missing URL or anon key)');
	}
	_client = createClient(url, key, {
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: true
		}
	});
	return _client;
}

/** Lazy proxy so createClient never runs with empty env at module init (Safari / PWA ordering). */
export const supabase = new Proxy({} as SupabaseClient, {
	get(_target, prop, receiver) {
		const client = getClient();
		const value = Reflect.get(client, prop, receiver);
		return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(client) : value;
	}
});

// ── Auth helpers ──────────────────────────────────────────────────────────────

export async function signInWithEmail(email: string) {
	// Use Vite BASE_URL (not $app/paths base) — some minifiers dropped `base` and produced `undefined/` in the bundle.
	const redirect =
		browser && typeof window !== 'undefined'
			? new URL(import.meta.env.BASE_URL, window.location.origin).href
			: undefined;
	return supabase.auth.signInWithOtp({
		email,
		options: { emailRedirectTo: redirect }
	});
}

export async function signOut() {
	return supabase.auth.signOut();
}

export function getUser() {
	return supabase.auth.getUser();
}

// ── Photo upload ──────────────────────────────────────────────────────────────

/**
 * Upload a base64 data URL or blob URL to Supabase Storage.
 * Returns a public URL, or null on failure.
 */
export async function uploadPhoto(
	userId: string,
	itemId: string,
	dataUrl: string
): Promise<string | null> {
	try {
		const res = await fetch(dataUrl);
		const blob = await res.blob();
		const ext = blob.type === 'image/png' ? 'png' : 'jpg';
		const path = `${userId}/${itemId}.${ext}`;

		const { error } = await supabase.storage
			.from('item-photos')
			.upload(path, blob, { upsert: true, contentType: blob.type });

		if (error) {
			console.warn('[supabase] photo upload failed:', error.message);
			return null;
		}

		const { data } = supabase.storage.from('item-photos').getPublicUrl(path);
		return data.publicUrl;
	} catch (err) {
		console.warn('[supabase] photo upload error:', err);
		return null;
	}
}

// ── Inventory sync ────────────────────────────────────────────────────────────

/** Map a DB row → InventoryItem */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToItem(row: any): InventoryItem {
	return {
		id: row.id,
		name: row.name,
		photo: row.photo_url ?? '',
		dimensions: row.dimensions ?? { l: 0, w: 0, h: 0 },
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
}

/** Map an InventoryItem → DB row */
function itemToRow(userId: string, item: InventoryItem) {
	return {
		id: item.id,
		user_id: userId,
		name: item.name,
		photo_url: item.photo || null,
		dimensions: item.dimensions,
		weight: item.weight ?? null,
		category: item.category,
		shape: item.shape,
		fragile: item.fragile,
		stackable: item.stackable,
		for_sale: item.forSale,
		donate: item.donate,
		room: item.room ?? null,
		notes: item.notes ?? null,
		contents: item.contents,
		model_url: item.modelUrl ?? null
	};
}

export async function fetchInventory(userId: string): Promise<InventoryItem[]> {
	const { data, error } = await supabase
		.from('inventory_items')
		.select('*')
		.eq('user_id', userId)
		.order('created_at', { ascending: false });

	if (error) {
		console.warn('[supabase] fetchInventory error:', error.message);
		return [];
	}
	return (data ?? []).map(rowToItem);
}

export async function upsertItem(userId: string, item: InventoryItem): Promise<void> {
	const { error } = await supabase.from('inventory_items').upsert(itemToRow(userId, item));

	if (error) console.warn('[supabase] upsertItem error:', error.message);
}

export async function deleteItem(itemId: string): Promise<void> {
	const { error } = await supabase.from('inventory_items').delete().eq('id', itemId);

	if (error) console.warn('[supabase] deleteItem error:', error.message);
}

// ── Settings sync ─────────────────────────────────────────────────────────────

export interface RemoteSettings {
	moveDate: string | null;
	moveRoute: { origin: string; destination: string; miles: number | null } | null;
	trailer: unknown | null;
}

export async function fetchSettings(userId: string): Promise<RemoteSettings | null> {
	const { data, error } = await supabase
		.from('user_settings')
		.select('*')
		.eq('user_id', userId)
		.maybeSingle();

	if (error) {
		console.warn('[supabase] fetchSettings error:', error.message);
		return null;
	}
	if (!data) return null;

	return {
		moveDate: data.move_date ?? null,
		moveRoute: data.move_route ?? null,
		trailer: data.trailer ?? null
	};
}

export async function upsertSettings(
	userId: string,
	settings: Partial<RemoteSettings>
): Promise<void> {
	const row: Record<string, unknown> = { user_id: userId };
	if ('moveDate' in settings) row.move_date = settings.moveDate ?? null;
	if ('moveRoute' in settings) row.move_route = settings.moveRoute ?? null;
	if ('trailer' in settings) row.trailer = settings.trailer ?? null;

	const { error } = await supabase.from('user_settings').upsert(row);
	if (error) console.warn('[supabase] upsertSettings error:', error.message);
}
