<script lang="ts">
	import { onMount } from 'svelte';
	import type { CalibrationPoints, Dimensions, MeasureStep } from '$lib/types';
	import { calibrateFromCard, measureDistance, validateCalibration } from '$lib/utils/measurement';

	interface Props {
		photoUrl: string;
		onComplete: (dims: Dimensions, photo: string) => void;
		onCancel: () => void;
	}

	let { photoUrl, onComplete, onCancel }: Props = $props();

	let canvas = $state<HTMLCanvasElement>(undefined!);
	let container = $state<HTMLDivElement>(undefined!);
	let step = $state<MeasureStep>('calibrate');
	let message = $state('Tap the 4 corners of your credit card');
	let cornerIndex = $state(0);

	let calibrationCorners = $state<CalibrationPoints>({
		topLeft: null,
		topRight: null,
		bottomRight: null,
		bottomLeft: null
	});
	let ppi = $state(0);

	type DimKey = 'length' | 'width' | 'height';
	let measureDim = $state<DimKey>('length');
	let measurePoints = $state<Record<DimKey, { a: { x: number; y: number } | null; b: { x: number; y: number } | null }>>({
		length: { a: null, b: null },
		width: { a: null, b: null },
		height: { a: null, b: null }
	});

	let dims = $state<Dimensions>({ l: 0, w: 0, h: 0 });
	let manualMode = $state(false);

	let img: HTMLImageElement;
	let scale = $state(1);
	let offsetX = $state(0);
	let offsetY = $state(0);

	const cornerLabels = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const;
	const cornerKeys: (keyof CalibrationPoints)[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
	const dimLabels: Record<DimKey, string> = { length: 'Length', width: 'Width', height: 'Height' };

	onMount(() => {
		img = new Image();
		img.onload = () => drawImage();
		img.src = photoUrl;
	});

	function drawImage() {
		if (!canvas || !img) return;
		const rect = container.getBoundingClientRect();
		canvas.width = rect.width;
		canvas.height = rect.height;

		const scaleX = canvas.width / img.width;
		const scaleY = canvas.height / img.height;
		scale = Math.min(scaleX, scaleY);
		offsetX = (canvas.width - img.width * scale) / 2;
		offsetY = (canvas.height - img.height * scale) / 2;

		redraw();
	}

	function redraw() {
		const ctx = canvas.getContext('2d')!;
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		ctx.save();
		ctx.translate(offsetX, offsetY);
		ctx.scale(scale, scale);
		ctx.drawImage(img, 0, 0);
		ctx.restore();

		if (step === 'calibrate') {
			drawCalibrationOverlay(ctx);
		} else if (step === 'measure') {
			drawCalibrationOverlay(ctx);
			drawMeasurementOverlay(ctx);
		}
	}

	function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, label?: string) {
		const sx = x * scale + offsetX;
		const sy = y * scale + offsetY;

		ctx.beginPath();
		ctx.arc(sx, sy, 8, 0, Math.PI * 2);
		ctx.fillStyle = color;
		ctx.fill();
		ctx.strokeStyle = 'white';
		ctx.lineWidth = 2;
		ctx.stroke();

		if (label) {
			ctx.font = '12px Inter, sans-serif';
			ctx.fillStyle = 'white';
			ctx.strokeStyle = 'rgba(0,0,0,0.7)';
			ctx.lineWidth = 3;
			ctx.strokeText(label, sx + 12, sy + 4);
			ctx.fillText(label, sx + 12, sy + 4);
		}
	}

	function drawLine(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }, color: string, label?: string) {
		const ax = a.x * scale + offsetX;
		const ay = a.y * scale + offsetY;
		const bx = b.x * scale + offsetX;
		const by = b.y * scale + offsetY;

		ctx.beginPath();
		ctx.moveTo(ax, ay);
		ctx.lineTo(bx, by);
		ctx.strokeStyle = color;
		ctx.lineWidth = 2;
		ctx.setLineDash([6, 4]);
		ctx.stroke();
		ctx.setLineDash([]);

		if (label) {
			const mx = (ax + bx) / 2;
			const my = (ay + by) / 2;
			ctx.font = 'bold 14px Inter, sans-serif';
			ctx.fillStyle = color;
			ctx.strokeStyle = 'rgba(0,0,0,0.8)';
			ctx.lineWidth = 3;
			ctx.strokeText(label, mx + 8, my - 8);
			ctx.fillText(label, mx + 8, my - 8);
		}
	}

	function drawCalibrationOverlay(ctx: CanvasRenderingContext2D) {
		const corners = [
			calibrationCorners.topLeft,
			calibrationCorners.topRight,
			calibrationCorners.bottomRight,
			calibrationCorners.bottomLeft
		];

		const filled = corners.filter(Boolean) as { x: number; y: number }[];

		for (let i = 0; i < filled.length; i++) {
			const next = filled[(i + 1) % filled.length];
			if (i < filled.length - 1 || filled.length === 4) {
				drawLine(ctx, filled[i], next, '#22c55e');
			}
			drawDot(ctx, filled[i].x, filled[i].y, '#22c55e', cornerLabels[i]);
		}
	}

	function drawMeasurementOverlay(ctx: CanvasRenderingContext2D) {
		const colors: Record<DimKey, string> = { length: '#c4c4c4', width: '#8c8c8c', height: '#6b6b6b' };

		for (const key of ['length', 'width', 'height'] as DimKey[]) {
			const pts = measurePoints[key];
			if (pts.a) drawDot(ctx, pts.a.x, pts.a.y, colors[key]);
			if (pts.a && pts.b) {
				const d = measureDistance(pts.a, pts.b, ppi);
				drawLine(ctx, pts.a, pts.b, colors[key], `${d}″`);
				drawDot(ctx, pts.b.x, pts.b.y, colors[key]);
			}
		}
	}

	function canvasToImage(cx: number, cy: number): { x: number; y: number } {
		return {
			x: (cx - offsetX) / scale,
			y: (cy - offsetY) / scale
		};
	}

	function handleCanvasTap(e: MouseEvent | TouchEvent) {
		e.preventDefault();
		const rect = canvas.getBoundingClientRect();
		let cx: number, cy: number;

		if ('touches' in e) {
			cx = e.touches[0].clientX - rect.left;
			cy = e.touches[0].clientY - rect.top;
		} else {
			cx = e.clientX - rect.left;
			cy = e.clientY - rect.top;
		}

		const pt = canvasToImage(cx, cy);

		if (step === 'calibrate') {
			handleCalibrationTap(pt);
		} else if (step === 'measure') {
			handleMeasureTap(pt);
		}
	}

	function handleCalibrationTap(pt: { x: number; y: number }) {
		const key = cornerKeys[cornerIndex];
		calibrationCorners[key] = pt;
		cornerIndex++;

		if (cornerIndex < 4) {
			message = `Tap the ${cornerLabels[cornerIndex]} corner`;
		} else {
			const validation = validateCalibration(calibrationCorners as Required<CalibrationPoints>);
			if (validation.valid) {
				ppi = calibrateFromCard(calibrationCorners as Required<CalibrationPoints>);
				step = 'measure';
				measureDim = 'length';
				message = 'Tap two points for the LENGTH';
			} else {
				message = validation.message;
				cornerIndex = 0;
				calibrationCorners = { topLeft: null, topRight: null, bottomRight: null, bottomLeft: null };
			}
		}
		redraw();
	}

	function handleMeasureTap(pt: { x: number; y: number }) {
		const pts = measurePoints[measureDim];

		if (!pts.a) {
			measurePoints[measureDim] = { a: pt, b: null };
		} else {
			measurePoints[measureDim] = { ...measurePoints[measureDim], b: pt };
			const d = measureDistance(pts.a!, pt, ppi);

			if (measureDim === 'length') {
				dims.l = d;
				measureDim = 'width';
				message = 'Tap two points for the WIDTH';
			} else if (measureDim === 'width') {
				dims.w = d;
				measureDim = 'height';
				message = 'Tap two points for the HEIGHT (or enter manually)';
			} else {
				dims.h = d;
				step = 'confirm';
				message = 'Review dimensions and save';
			}
		}
		redraw();
	}

	function skipCalibration() {
		manualMode = true;
		step = 'confirm';
		message = 'Enter dimensions manually';
	}

	function resetCalibration() {
		cornerIndex = 0;
		calibrationCorners = { topLeft: null, topRight: null, bottomRight: null, bottomLeft: null };
		message = 'Tap the 4 corners of your credit card';
		step = 'calibrate';
		redraw();
	}

	function handleConfirm() {
		onComplete(dims, photoUrl);
	}
</script>

<div class="measurement-view">
	<div class="toolbar">
		<button class="toolbar-btn" onclick={onCancel}>Cancel</button>
		<span class="step-label">
			{#if step === 'calibrate'}1/3 Calibrate{:else if step === 'measure'}2/3 Measure{:else}3/3 Confirm{/if}
		</span>
		{#if step === 'calibrate'}
			<button class="toolbar-btn" onclick={skipCalibration}>Skip</button>
		{:else if step === 'measure'}
			<button class="toolbar-btn" onclick={resetCalibration}>Redo</button>
		{:else}
			<button class="toolbar-btn accent" onclick={handleConfirm}>Save</button>
		{/if}
	</div>

	<div class="message-bar">{message}</div>

	{#if step !== 'confirm'}
		<div class="canvas-container" bind:this={container}>
			<canvas
				bind:this={canvas}
				ontouchstart={handleCanvasTap}
				onclick={handleCanvasTap}
			></canvas>
		</div>
	{/if}

	{#if step === 'measure'}
		<div class="dim-pills">
			{#each (['length', 'width', 'height'] as DimKey[]) as key}
				<button
					class="dim-pill"
					class:active={measureDim === key}
					class:done={measurePoints[key].b !== null}
					onclick={() => { measureDim = key; message = `Tap two points for the ${dimLabels[key].toUpperCase()}`; }}
				>
					<span class="dim-label">{dimLabels[key]}</span>
					{#if measurePoints[key].b}
						<span class="dim-value">{key === 'length' ? dims.l : key === 'width' ? dims.w : dims.h}″</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}

	{#if step === 'confirm'}
		<div class="confirm-panel">
			<div class="photo-preview">
				<img src={photoUrl} alt="Item" />
			</div>
			<div class="dims-form">
				<label class="dim-field">
					<span>Length (in)</span>
					<input type="number" bind:value={dims.l} min="0" step="0.1" inputmode="decimal" />
				</label>
				<label class="dim-field">
					<span>Width (in)</span>
					<input type="number" bind:value={dims.w} min="0" step="0.1" inputmode="decimal" />
				</label>
				<label class="dim-field">
					<span>Height (in)</span>
					<input type="number" bind:value={dims.h} min="0" step="0.1" inputmode="decimal" />
				</label>
			</div>
			<button class="save-btn" onclick={handleConfirm}>Save Dimensions</button>
		</div>
	{/if}
</div>

<style>
	.measurement-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--color-bg);
	}

	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-divider);
	}

	.toolbar-btn {
		font-size: 15px;
		font-weight: 600;
		color: var(--color-accent);
		padding: 6px 12px;
	}

	.toolbar-btn.accent {
		background: var(--color-accent);
		color: var(--color-accent-fg);
		border-radius: var(--radius-sm);
	}

	.step-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.message-bar {
		text-align: center;
		padding: 10px 16px;
		font-size: 14px;
		font-weight: 500;
		color: var(--color-text);
		background: var(--color-bg-card);
	}

	.canvas-container {
		flex: 1;
		position: relative;
		overflow: hidden;
		touch-action: none;
	}

	canvas {
		width: 100%;
		height: 100%;
		display: block;
	}

	.dim-pills {
		display: flex;
		gap: 8px;
		padding: 12px 16px;
		background: var(--color-bg-card);
		border-top: 1px solid var(--color-divider);
	}

	.dim-pill {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 8px;
		border-radius: var(--radius-md);
		border: none;
		background: var(--color-bg);
		box-shadow: inset 0 0 0 1px var(--color-border-subtle);
		transition: background 0.2s ease, box-shadow 0.2s ease;
	}

	.dim-pill.active {
		background: var(--color-bg-elevated);
		box-shadow: inset 0 0 0 1px var(--color-border-subtle);
	}

	.dim-pill.done {
		background: var(--color-success-soft);
		box-shadow: inset 0 0 0 1px rgba(52, 211, 153, 0.35);
	}

	.dim-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--color-text-secondary);
	}

	.dim-value {
		font-size: 16px;
		font-weight: 700;
	}

	.confirm-panel {
		flex: 1;
		overflow-y: auto;
		padding: 20px 16px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.photo-preview {
		border-radius: var(--radius-md);
		overflow: hidden;
		max-height: 200px;
	}

	.photo-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.dims-form {
		display: flex;
		gap: 12px;
	}

	.dim-field {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.dim-field span {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	.dim-field input {
		text-align: center;
		font-size: 18px;
		font-weight: 600;
		padding: 10px 8px;
	}

	.save-btn {
		width: 100%;
		padding: 14px;
		background: var(--color-accent);
		color: var(--color-accent-fg);
		font-size: 16px;
		font-weight: 600;
		border-radius: var(--radius-md);
		transition: background 0.15s;
	}

	.save-btn:active {
		background: var(--color-accent-hover);
	}
</style>
