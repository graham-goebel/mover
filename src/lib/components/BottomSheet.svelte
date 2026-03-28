<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** 'peek' = floating mini-card; 'full' = full-height sheet */
		value?: 'peek' | 'full';
		/**
		 * Visible height in peek mode (px).
		 * Should cover: handle-pill area (~22px) + your header content height.
		 */
		peekHeight?: number;
		/** Show a semi-transparent backdrop when fully open */
		backdrop?: boolean;
		children: Snippet;
	}

	let {
		value = $bindable<'peek' | 'full'>('peek'),
		peekHeight = 68,
		backdrop = true,
		children
	}: Props = $props();

	// ── Layout measurements (resolved once on mount, re-measured on resize) ───
	let cachedFullH = $state(600);
	let cachedSafeBottom = $state(0);

	$effect(() => {
		if (typeof window === 'undefined') return;

		function measure() {
			// Resolve CSS variable values (handles calc + env() correctly)
			const tbEl = document.createElement('div');
			tbEl.style.cssText =
				'position:fixed;visibility:hidden;pointer-events:none;height:var(--tab-bar-height,56px);width:0;top:0;left:0';
			document.body.appendChild(tbEl);
			cachedFullH = window.innerHeight - tbEl.offsetHeight;
			document.body.removeChild(tbEl);

			const saEl = document.createElement('div');
			saEl.style.cssText =
				'position:fixed;visibility:hidden;pointer-events:none;height:var(--safe-area-bottom,0px);width:0;top:0;left:0';
			document.body.appendChild(saEl);
			cachedSafeBottom = saEl.offsetHeight;
			document.body.removeChild(saEl);
		}

		measure();
		window.addEventListener('resize', measure);
		return () => window.removeEventListener('resize', measure);
	});

	// ── Touch drag state ───────────────────────────────────────────────────────
	let isDragging = $state(false);
	let dragStyle = $state('');

	let touchStartY = 0;
	let touchLastY = 0;
	let touchLastT = 0;
	let touchVel = 0;
	let dragBaseValue: 'peek' | 'full' = 'peek';

	const SNAP_PX = 56;
	const SNAP_VEL = 0.35;
	const SIDE_MARGIN = 12; // floating horizontal margin in peek state
	const BOTTOM_GAP = 8;   // gap above safe area in peek state
	const CORNER = 16;      // border-radius (px)

	/** Build an inline style string that interpolates between peek and full. */
	function computeDragStyle(height: number): string {
		const range = cachedFullH - peekHeight;
		const pct = range > 0
			? Math.max(0, Math.min(1, (height - peekHeight) / range))
			: (value === 'full' ? 1 : 0);

		const m = (SIDE_MARGIN * (1 - pct)).toFixed(1);
		const b = ((cachedSafeBottom + BOTTOM_GAP) * (1 - pct)).toFixed(1);
		const brB = (CORNER * (1 - pct)).toFixed(1);

		return [
			`height:${Math.round(height)}px`,
			`left:${m}px`,
			`right:${m}px`,
			`bottom:${b}px`,
			`border-radius:${CORNER}px ${CORNER}px ${brB}px ${brB}px`,
		].join(';');
	}

	function onHandleTouchStart(e: TouchEvent) {
		const t = e.touches[0];
		touchStartY = t.clientY;
		touchLastY = t.clientY;
		touchLastT = e.timeStamp;
		touchVel = 0;
		dragBaseValue = value;
		isDragging = true;
		dragStyle = computeDragStyle(value === 'peek' ? peekHeight : cachedFullH);
	}

	function onHandleTouchMove(e: TouchEvent) {
		const t = e.touches[0];
		const dt = e.timeStamp - touchLastT || 1;
		touchVel = (t.clientY - touchLastY) / dt;
		touchLastY = t.clientY;
		touchLastT = e.timeStamp;

		const dy = t.clientY - touchStartY;
		let newH: number;

		if (dragBaseValue === 'peek') {
			// Dragging up from peek: height grows
			newH = Math.max(peekHeight, Math.min(cachedFullH, peekHeight - dy));
		} else {
			// Dragging down from full: height shrinks
			newH = Math.max(peekHeight, Math.min(cachedFullH, cachedFullH - dy));
		}

		dragStyle = computeDragStyle(newH);
		e.preventDefault();
	}

	function onHandleTouchEnd() {
		isDragging = false;
		dragStyle = '';
		const dy = touchLastY - touchStartY;

		if (dragBaseValue === 'peek') {
			value = (dy < -SNAP_PX || touchVel < -SNAP_VEL) ? 'full' : 'peek';
		} else {
			value = (dy > SNAP_PX || touchVel > SNAP_VEL) ? 'peek' : 'full';
		}
	}

	function toggleSheet() {
		value = value === 'full' ? 'peek' : 'full';
	}

	const sheetStyle = $derived(
		isDragging && dragStyle
			? `--peek-h:${peekHeight}px;${dragStyle}`
			: `--peek-h:${peekHeight}px`
	);
</script>

<!-- Backdrop — tap to collapse -->
{#if backdrop && value === 'full'}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="sheet-backdrop" onclick={() => value = 'peek'}></div>
{/if}

<div
	class="bottom-sheet"
	class:is-open={value === 'full'}
	class:is-dragging={isDragging}
	style={sheetStyle}
>
	<!-- Drag handle — only this area triggers drag on mobile -->
	<div
		class="sheet-handle"
		ontouchstart={onHandleTouchStart}
		ontouchmove={onHandleTouchMove}
		ontouchend={onHandleTouchEnd}
		onclick={toggleSheet}
		role="button"
		tabindex="0"
		aria-label={value === 'full' ? 'Minimise panel' : 'Expand panel'}
		onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSheet(); }}
	>
		<div class="sheet-pill"></div>
	</div>

	<!-- Content — children own their scroll (overflow-y: auto on inner wrappers) -->
	<div class="sheet-body">
		{@render children()}
	</div>
</div>

<style>
	/* ── Backdrop ──────────────────────────────────────────────────────────── */
	.sheet-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 199;
		animation: backdrop-in 0.2s ease forwards;
	}

	@keyframes backdrop-in {
		from { opacity: 0; }
		to   { opacity: 1; }
	}

	/* ── Floating mini-card → full-height sheet ────────────────────────────── */
	.bottom-sheet {
		position: fixed;
		z-index: 200;

		/* ── Peek state (default): floating island above safe area ── */
		left: 12px;
		right: 12px;
		bottom: calc(var(--safe-area-bottom, 0px) + 8px);
		height: var(--peek-h, 72px);
		border-radius: 16px;

		background: var(--color-bg, #121212);
		box-shadow:
			0 8px 40px rgba(0, 0, 0, 0.60),
			0 2px 8px  rgba(0, 0, 0, 0.40),
			inset 0 1px 0 rgba(255, 255, 255, 0.06);
		overflow: hidden;

		display: flex;
		flex-direction: column;

		transition:
			left          0.42s cubic-bezier(0.32, 0.72, 0, 1),
			right         0.42s cubic-bezier(0.32, 0.72, 0, 1),
			bottom        0.42s cubic-bezier(0.32, 0.72, 0, 1),
			height        0.42s cubic-bezier(0.32, 0.72, 0, 1),
			border-radius 0.25s ease,
			box-shadow    0.25s ease;
		will-change: height, left, right, bottom;
	}

	/* ── Full state ── */
	.bottom-sheet.is-open {
		left: 0;
		right: 0;
		bottom: 0;
		height: calc(100dvh - var(--tab-bar-height, 56px));
		border-radius: 16px 16px 0 0;
		box-shadow: 0 -2px 32px rgba(0, 0, 0, 0.55);
	}

	/* Disable transition during finger drag for immediate response */
	.bottom-sheet.is-dragging {
		transition: none;
	}

	/* ── Handle ────────────────────────────────────────────────────────────── */
	.sheet-handle {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 12px 0 6px;
		cursor: grab;
		touch-action: none;
		user-select: none;
	}

	.sheet-handle:active { cursor: grabbing; }

	.sheet-pill {
		width: 36px;
		height: 4px;
		background: rgba(255, 255, 255, 0.18);
		border-radius: 100px;
	}

	/* ── Body ── children control scroll via overflow-y: auto on their wrappers */
	.sheet-body {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	/* ── Desktop: revert to a plain static container ──────────────────────── */
	@media (min-width: 768px) {
		.sheet-backdrop { display: none; }

		.bottom-sheet {
			position: static;
			left: auto;
			right: auto;
			bottom: auto;
			height: 100%;
			border-radius: 0;
			box-shadow: none;
			background: var(--color-bg, #121212);
			transition: none;
			z-index: auto;
			will-change: auto;
		}

		.sheet-handle { display: none; }

		.sheet-body {
			overflow-y: auto;
			-webkit-overflow-scrolling: touch;
		}
	}
</style>
