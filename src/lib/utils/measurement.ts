import type { CalibrationPoints } from '$lib/types';

// ISO 7810 ID-1 credit card: 85.6mm × 53.98mm
const CARD_WIDTH_MM = 85.6;
const CARD_HEIGHT_MM = 53.98;
const MM_TO_INCHES = 0.0393701;

interface Point {
	x: number;
	y: number;
}

function dist(a: Point, b: Point): number {
	return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Compute pixels-per-inch from 4 credit card corner taps.
 * Uses the average of the 4 side lengths vs their known real-world sizes,
 * which gracefully handles mild perspective distortion.
 */
export function calibrateFromCard(corners: Required<CalibrationPoints>): number {
	const { topLeft, topRight, bottomRight, bottomLeft } = corners;

	const topPx = dist(topLeft, topRight);
	const bottomPx = dist(bottomLeft, bottomRight);
	const leftPx = dist(topLeft, bottomLeft);
	const rightPx = dist(topRight, bottomRight);

	const avgWidthPx = (topPx + bottomPx) / 2;
	const avgHeightPx = (leftPx + rightPx) / 2;

	const cardWidthInches = CARD_WIDTH_MM * MM_TO_INCHES;
	const cardHeightInches = CARD_HEIGHT_MM * MM_TO_INCHES;

	const ppiFromWidth = avgWidthPx / cardWidthInches;
	const ppiFromHeight = avgHeightPx / cardHeightInches;

	return (ppiFromWidth + ppiFromHeight) / 2;
}

/**
 * Convert a pixel distance to inches using the calibrated pixels-per-inch.
 */
export function pixelsToInches(pixelDist: number, ppi: number): number {
	return Math.round((pixelDist / ppi) * 10) / 10;
}

/**
 * Measure the distance between two tapped points in inches.
 */
export function measureDistance(a: Point, b: Point, ppi: number): number {
	return pixelsToInches(dist(a, b), ppi);
}

/**
 * Given a set of calibration corners, check if they form a roughly rectangular shape.
 * Returns true if the aspect ratio is within reasonable bounds for a credit card.
 */
export function validateCalibration(corners: Required<CalibrationPoints>): {
	valid: boolean;
	message: string;
} {
	const { topLeft, topRight, bottomRight, bottomLeft } = corners;

	const topPx = dist(topLeft, topRight);
	const bottomPx = dist(bottomLeft, bottomRight);
	const leftPx = dist(topLeft, bottomLeft);
	const rightPx = dist(topRight, bottomRight);

	const widthRatio = Math.min(topPx, bottomPx) / Math.max(topPx, bottomPx);
	const heightRatio = Math.min(leftPx, rightPx) / Math.max(leftPx, rightPx);

	if (widthRatio < 0.7 || heightRatio < 0.7) {
		return { valid: false, message: 'Corners don\'t form a rectangle. Try tapping again.' };
	}

	const avgWidth = (topPx + bottomPx) / 2;
	const avgHeight = (leftPx + rightPx) / 2;
	const aspectRatio = avgWidth / avgHeight;
	const expectedRatio = CARD_WIDTH_MM / CARD_HEIGHT_MM; // ~1.586

	if (aspectRatio < expectedRatio * 0.6 || aspectRatio > expectedRatio * 1.5) {
		return { valid: false, message: 'Shape doesn\'t match a credit card. Check corner order.' };
	}

	return { valid: true, message: 'Calibration looks good!' };
}

/**
 * Calculate volume in cubic feet from inch dimensions.
 */
export function volumeCuFt(l: number, w: number, h: number): number {
	return Math.round((l * w * h) / 1728 * 10) / 10;
}
