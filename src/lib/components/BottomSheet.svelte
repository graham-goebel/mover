<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Bindable sheet state */
		state?: 'peek' | 'full';
		/**
		 * How many px remain visible in peek mode.
		 * Should equal: handle-pill area (20px) + your header height.
		 */
		peekHeight?: number;
		/** Show a semi-transparent backdrop when fully open */
		backdrop?: boolean;
		children: Snippet;
	}

	let {
		state = $bindable<'peek' | 'full'>('peek'),
		peekHeight = 68,
		backdrop = true,
		children
	}: Props = $props();

	// ── Touch drag state ──────────────────────────────────────────────────────
	let isDragging = $state(false);
	let dragTransform = $state('');

	let touchStartY  = 0;
	let touchLastY   = 0;
	let touchLastT   = 0;
	let touchVel     = 0;
	let dragBaseState: 'peek' | 'full' = 'peek';

	// Distance thresholds for snapping
	const SNAP_PX  = 56;
	const SNAP_VEL = 0.35; // px/ms

	function onHandleTouchStart(e: TouchEvent) {
		const t = e.touches[0];
		touchStartY  = t.clientY;
		touchLastY   = t.clientY;
		touchLastT   = e.timeStamp;
		touchVel     = 0;
		dragBaseState = state;
		isDragging   = true;
	}

	function onHandleTouchMove(e: TouchEvent) {
		const t   = e.touches[0];
		const dt  = e.timeStamp - touchLastT || 1;
		touchVel  = (t.clientY - touchLastY) / dt;
		touchLastY = t.clientY;
		touchLastT = e.timeStamp;

		const dy = t.clientY - touchStartY;

		if (dragBaseState === 'peek') {
			// Dragging up from peek: cap at 0 (can't go below start)
			const offset = Math.min(0, dy);
			dragTransform = `translateY(calc(100% - ${peekHeight}px + ${offset}px))`;
		} else {
			// Dragging down from full: cap at 0 (can't drag above full)
			const offset = Math.max(0, dy);
			dragTransform = `translateY(${offset}px)`;
		}

		e.preventDefault();
	}

	function onHandleTouchEnd() {
		isDragging = false;
		const dy = touchLastY - touchStartY;

		if (dragBaseState === 'peek') {
			state = (dy < -SNAP_PX || touchVel < -SNAP_VEL) ? 'full' : 'peek';
		} else {
			state = (dy > SNAP_PX  || touchVel > SNAP_VEL)  ? 'peek' : 'full';
		}
		dragTransform = '';
	}

	function toggleSheet() {
		state = state === 'full' ? 'peek' : 'full';
	}
</script>

<!-- Backdrop — tap to collapse -->
{#if backdrop && state === 'full'}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="sheet-backdrop" onclick={() => state = 'peek'}></div>
{/if}

<div
	class="bottom-sheet"
	class:is-open={state === 'full'}
	class:is-dragging={isDragging}
	style:--peek-h="{peekHeight}px"
	style:transform={isDragging ? dragTransform : undefined}
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
		aria-label={state === 'full' ? 'Minimise panel' : 'Expand panel'}
		onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSheet(); }}
	>
		<div class="sheet-pill"></div>
	</div>

	<!-- Scrollable body -->
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

	/* ── Sheet ─────────────────────────────────────────────────────────────── */
	.bottom-sheet {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 200;

		/* Fill viewport minus tab bar */
		height: calc(100dvh - var(--tab-bar-height, 88px) - env(safe-area-inset-top, 0px));

		background: var(--color-bg);
		border-radius: 12px 12px 0 0;
		box-shadow: 0 -2px 32px rgba(0, 0, 0, 0.55);

		display: flex;
		flex-direction: column;
		overflow: hidden;

		/* Peek by default — show only peekHeight px */
		transform: translateY(calc(100% - var(--peek-h, 68px)));
		transition: transform 0.38s cubic-bezier(0.32, 0.72, 0, 1);
		will-change: transform;
	}

	.bottom-sheet.is-open {
		transform: translateY(0);
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
		padding: 10px 0 6px;
		cursor: grab;
		touch-action: none; /* prevent browser scroll taking over */
		user-select: none;
	}

	.sheet-handle:active { cursor: grabbing; }

	.sheet-pill {
		width: 36px;
		height: 4px;
		background: rgba(255, 255, 255, 0.18);
		border-radius: 100px;
	}

	/* ── Body ──────────────────────────────────────────────────────────────── */
	.sheet-body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		display: flex;
		flex-direction: column;
	}

	/* ── Desktop: revert to a plain static container ──────────────────────── */
	@media (min-width: 768px) {
		.sheet-backdrop { display: none; }

		.bottom-sheet {
			position: static;
			height: 100%;
			box-shadow: none;
			border-radius: 0;
			transform: none !important;
			transition: none;
			z-index: auto;
			will-change: auto;
		}

		.sheet-handle { display: none; }

		.sheet-body {
			overflow-y: auto; /* parent .left-panel controls clip */
		}
	}
</style>
