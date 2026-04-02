export type ItemCategory = 'box' | 'bin' | 'furniture' | 'appliance' | 'oddShape' | 'other';

export type ItemShape =
	| 'box'
	| 'bin'
	| 'bag'
	| 'couch'
	| 'chair'
	| 'table'
	| 'dresser'
	| 'mattress'
	| 'tv'
	| 'lamp'
	| 'appliance-tall'
	| 'appliance-wide'
	| 'generic';

export interface Dimensions {
	l: number; // length in inches
	w: number; // width in inches
	h: number; // height in inches
}

export interface ContentItem {
	text: string;
	important: boolean;
}

/** Normalize legacy plain-string contents to ContentItem[] */
export function normalizeContents(raw: unknown): ContentItem[] {
	if (!Array.isArray(raw)) return [];
	return raw.map((c) =>
		typeof c === 'string' ? { text: c, important: false } : { text: c.text ?? '', important: Boolean(c.important) }
	);
}

export interface InventoryItem {
	id: string;
	name: string;
	photo: string;
	dimensions: Dimensions;
	weight?: number;
	category: ItemCategory;
	shape: ItemShape;
	fragile: boolean;
	stackable: boolean;
	forSale: boolean;
	/** Marked for donation (e.g. not keeping after move) */
	donate: boolean;
	modelUrl?: string; // GLB URL from TripoSR server, if generated
	important: boolean;
	contents: ContentItem[];
	/** `null` or omitted = General (not tied to a room) */
	room?: string | null;
	notes?: string;
	createdAt: number;
}

export interface TrailerPreset {
	name: string;
	length: number; // feet
	width: number;
	height: number;
	/** Typical usable payload (lbs) for load planning */
	payloadLbs: number;
}

export interface PackedItem {
	item: InventoryItem;
	position: { x: number; y: number; z: number };
	rotation: { l: number; w: number; h: number };
	color: string;
}

export interface PackResult {
	placed: PackedItem[];
	unplaced: InventoryItem[];
	utilization: number;
}

export type TabId = 'inventory' | 'add' | 'pack';

export interface CalibrationPoints {
	topLeft: { x: number; y: number } | null;
	topRight: { x: number; y: number } | null;
	bottomRight: { x: number; y: number } | null;
	bottomLeft: { x: number; y: number } | null;
}

export type MeasureStep = 'capture' | 'calibrate' | 'measure' | 'confirm';
