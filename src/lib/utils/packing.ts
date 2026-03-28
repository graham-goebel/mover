import type { InventoryItem, PackedItem, PackResult, TrailerPreset } from '$lib/types';

interface Box {
	l: number;
	w: number;
	h: number;
}

interface Placement {
	x: number;
	y: number;
	z: number;
	box: Box;
}

const ITEM_COLORS = [
	'#8b9dc3', '#a3a3a3', '#c4956a', '#8fae8b', '#b399c6',
	'#c49898', '#7fb5b5', '#c4b97f', '#9e8fae', '#89a8c4',
	'#ae9e8f', '#8fae9e', '#b5a37f', '#a3899e', '#7faeb5'
];

/**
 * Generate all distinct rotation orientations of a box.
 * A rectangular box has up to 6 unique orientations (3 axes × 2 flips),
 * but we only need the 6 axis-aligned permutations of (l, w, h).
 */
function getOrientations(item: Box): Box[] {
	const { l, w, h } = item;
	const set = new Set<string>();
	const result: Box[] = [];

	for (const [a, b, c] of [
		[l, w, h], [l, h, w],
		[w, l, h], [w, h, l],
		[h, l, w], [h, w, l]
	]) {
		const key = `${a},${b},${c}`;
		if (!set.has(key)) {
			set.add(key);
			result.push({ l: a, w: b, h: c });
		}
	}
	return result;
}

/**
 * Check if a box placed at (x, y, z) fits in the container
 * and doesn't collide with existing placements.
 */
function canPlace(
	x: number, y: number, z: number,
	box: Box,
	container: TrailerPreset,
	placements: Placement[]
): boolean {
	const cl = container.length * 12; // feet to inches
	const cw = container.width * 12;
	const ch = container.height * 12;

	if (x + box.l > cl || y + box.h > ch || z + box.w > cw) {
		return false;
	}

	for (const p of placements) {
		if (
			x < p.x + p.box.l && x + box.l > p.x &&
			y < p.y + p.box.h && y + box.h > p.y &&
			z < p.z + p.box.w && z + box.w > p.z
		) {
			return false;
		}
	}

	return true;
}

/**
 * Check if any other placement sits on top of the given placement.
 * Used to enforce the "not stackable" constraint.
 */
function hasItemAbove(placement: Placement, allPlacements: Placement[]): boolean {
	for (const p of allPlacements) {
		if (p === placement) continue;
		if (
			p.y >= placement.y + placement.box.h &&
			p.x < placement.x + placement.box.l && p.x + p.box.l > placement.x &&
			p.z < placement.z + placement.box.w && p.z + p.box.w > placement.z
		) {
			return true;
		}
	}
	return false;
}

/**
 * Score a placement position. Lower is better.
 * Priorities: lower Y (gravity), smaller X (back-to-front load order), smaller Z (left wall).
 */
function scorePlacement(x: number, y: number, z: number, box: Box): number {
	return y * 1000 + x * 10 + z;
}

/**
 * Extreme-point based 3D bin packing.
 *
 * Items sorted by volume (largest first). Fragile items deferred to the end
 * so they end up on top. Non-stackable items get a ceiling flag.
 */
export function packItems(items: InventoryItem[], container: TrailerPreset): PackResult {
	// Items with no dimensions set can't be packed — move them to unplaced
	const packable = items.filter(
		i => i.dimensions.l > 0 && i.dimensions.w > 0 && i.dimensions.h > 0
	);
	const zeroDimItems = items.filter(
		i => i.dimensions.l <= 0 || i.dimensions.w <= 0 || i.dimensions.h <= 0
	);

	const sortedItems = [...packable].sort((a, b) => {
		if (a.fragile !== b.fragile) return a.fragile ? 1 : -1;

		const volA = a.dimensions.l * a.dimensions.w * a.dimensions.h;
		const volB = b.dimensions.l * b.dimensions.w * b.dimensions.h;
		return volB - volA;
	});

	const placements: Placement[] = [];
	const placed: PackedItem[] = [];
	const unplaced: InventoryItem[] = [];

	let extremePoints: { x: number; y: number; z: number }[] = [{ x: 0, y: 0, z: 0 }];

	for (let idx = 0; idx < sortedItems.length; idx++) {
		const item = sortedItems[idx];
		const dims = item.dimensions;
		const orientations = getOrientations(dims);

		let bestScore = Infinity;
		let bestPlacement: { x: number; y: number; z: number; box: Box } | null = null;

		for (const ep of extremePoints) {
			for (const orient of orientations) {
				if (canPlace(ep.x, ep.y, ep.z, orient, container, placements)) {
					const score = scorePlacement(ep.x, ep.y, ep.z, orient);
					if (score < bestScore) {
						bestScore = score;
						bestPlacement = { x: ep.x, y: ep.y, z: ep.z, box: orient };
					}
				}
			}
		}

		if (bestPlacement) {
			placements.push(bestPlacement);
			placed.push({
				item,
				position: { x: bestPlacement.x, y: bestPlacement.y, z: bestPlacement.z },
				rotation: bestPlacement.box,
				color: ITEM_COLORS[idx % ITEM_COLORS.length]
			});

			const { x, y, z, box } = bestPlacement;
			const newPoints = [
				{ x: x + box.l, y, z },
				{ x, y: y + box.h, z },
				{ x, y, z: z + box.w }
			];

			for (const np of newPoints) {
				const isDuplicate = extremePoints.some(
					(ep) => ep.x === np.x && ep.y === np.y && ep.z === np.z
				);
				if (!isDuplicate) {
					extremePoints.push(np);
				}
			}

			extremePoints.sort((a, b) =>
				scorePlacement(a.x, a.y, a.z, { l: 0, w: 0, h: 0 }) -
				scorePlacement(b.x, b.y, b.z, { l: 0, w: 0, h: 0 })
			);
		} else {
			unplaced.push(item);
		}
	}

	// Items with no dimensions go to unplaced too
	unplaced.push(...zeroDimItems);

	const containerVol = container.length * container.width * container.height * 1728; // cu ft to cu in
	const usedVol = placed.reduce(
		(sum, p) => sum + p.rotation.l * p.rotation.w * p.rotation.h,
		0
	);
	const utilization = containerVol > 0 ? Math.round((usedVol / containerVol) * 1000) / 10 : 0;

	return { placed, unplaced, utilization };
}
