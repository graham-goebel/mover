export type ItemCategory = 'box' | 'furniture' | 'appliance' | 'fragile' | 'oddShape' | 'other';

export interface Dimensions {
	l: number; // length in inches
	w: number; // width in inches
	h: number; // height in inches
}

export interface InventoryItem {
	id: string;
	name: string;
	photo: string;
	dimensions: Dimensions;
	weight?: number;
	category: ItemCategory;
	fragile: boolean;
	stackable: boolean;
	contents: string[];
	notes?: string;
	createdAt: number;
}

export interface TrailerPreset {
	name: string;
	length: number; // feet
	width: number;
	height: number;
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
