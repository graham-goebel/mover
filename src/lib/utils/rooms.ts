/** Preset ids excluding synthetic options */
export type RoomPresetId =
	| 'general'
	| 'kitchen'
	| 'living_room'
	| 'bedroom'
	| 'bathroom'
	| 'garage'
	| 'basement'
	| 'office'
	| 'dining_room'
	| 'laundry'
	| 'custom';

const PRESET_LABELS: Record<Exclude<RoomPresetId, 'general' | 'custom'>, string> = {
	kitchen: 'Kitchen',
	living_room: 'Living room',
	bedroom: 'Bedroom',
	bathroom: 'Bathroom',
	garage: 'Garage',
	basement: 'Basement',
	office: 'Office',
	dining_room: 'Dining room',
	laundry: 'Laundry'
};

/** Chips shown in the room picker (General + presets + Other) */
export const ROOM_CHIP_ORDER: RoomPresetId[] = [
	'general',
	'kitchen',
	'living_room',
	'bedroom',
	'bathroom',
	'garage',
	'basement',
	'office',
	'dining_room',
	'laundry',
	'custom'
];

export function roomChipLabel(id: RoomPresetId): string {
	if (id === 'general') return 'General';
	if (id === 'custom') return 'Other';
	return PRESET_LABELS[id];
}

/** Value persisted on `InventoryItem.room` — `null` means General */
export function roomFromPresetAndCustom(preset: RoomPresetId, custom: string): string | null {
	if (preset === 'general') return null;
	if (preset === 'custom') {
		const t = custom.trim();
		return t.length > 0 ? t : null;
	}
	return PRESET_LABELS[preset];
}

export function splitStoredRoom(stored: string | null | undefined): {
	preset: RoomPresetId;
	custom: string;
} {
	if (stored == null || stored.trim() === '') return { preset: 'general', custom: '' };
	const t = stored.trim();
	for (const [id, label] of Object.entries(PRESET_LABELS) as [
		Exclude<RoomPresetId, 'general' | 'custom'>,
		string
	][]) {
		if (label.toLowerCase() === t.toLowerCase()) return { preset: id, custom: '' };
	}
	return { preset: 'custom', custom: t };
}

export function roomDisplayLabel(stored: string | null | undefined): string {
	if (stored == null || stored.trim() === '') return 'General';
	return stored.trim();
}

export function isGeneralRoom(stored: string | null | undefined): boolean {
	return stored == null || stored.trim() === '';
}
