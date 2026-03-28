<script lang="ts">
	import type { InventoryItem, TrailerPreset } from '$lib/types';
	import { inventory } from '$lib/stores/inventory';
	import { moveDate, moveRoute, settingsOpen } from '$lib/stores/app';
	import { volumeCuFt } from '$lib/utils/measurement';
	import { TRAILER_PRESETS, trailer } from '$lib/stores/trailer';

	let items = $state<InventoryItem[]>([]);
	inventory.subscribe((v) => (items = v));

	let moveDateVal = $state<string | null>(null);
	moveDate.subscribe((v) => (moveDateVal = v));

	let route = $state({ origin: '', destination: '', miles: null as number | null });
	moveRoute.subscribe((v) => (route = v));

	let currentTrailer = $state<TrailerPreset>(TRAILER_PRESETS[2]);
	trailer.subscribe((t) => (currentTrailer = t));

	const totalVolume = $derived(
		items.reduce((sum, it) => sum + volumeCuFt(it.dimensions.l, it.dimensions.w, it.dimensions.h), 0)
	);

	const totalWeight = $derived(items.reduce((sum, it) => sum + (it.weight ?? 0), 0));

	const itemsWithoutWeight = $derived(items.filter((it) => it.weight == null || it.weight <= 0).length);

	const daysUntilMove = $derived.by(() => {
		if (!moveDateVal) return null;
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		const target = new Date(moveDateVal + 'T00:00:00');
		const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
		return diff;
	});

	const recommendedTrailer = $derived.by(() => {
		if (totalVolume <= 0) return null;
		const FILL_FACTOR = 0.65;
		for (const p of TRAILER_PRESETS) {
			const cap = p.length * p.width * p.height * FILL_FACTOR;
			if (totalVolume <= cap) return p.name;
		}
		return TRAILER_PRESETS[TRAILER_PRESETS.length - 1].name + '+';
	});

	const containerCuFt = $derived(
		currentTrailer.length * currentTrailer.width * currentTrailer.height
	);

	const volUtilPct = $derived(
		containerCuFt > 0 ? (totalVolume / containerCuFt) * 100 : 0
	);

	const volBarPct = $derived(Math.min(100, Math.max(0, volUtilPct)));

	const spaceLeftCuFt = $derived(containerCuFt - totalVolume);

	const payloadLbs = $derived(Math.max(1, currentTrailer.payloadLbs ?? 2500));

	const weightUtilPct = $derived(payloadLbs > 0 ? (totalWeight / payloadLbs) * 100 : 0);

	const weightBarPct = $derived(Math.min(100, Math.max(0, weightUtilPct)));

	const weightLeftLbs = $derived(payloadLbs - totalWeight);

	function fmtCuFt(n: number): string {
		if (n >= 100) return `${Math.round(n)}`;
		if (n >= 10) return `${Math.round(n * 10) / 10}`;
		return `${Math.round(n * 10) / 10}`;
	}

	function shortLabel(s: string, maxLen: number): string {
		const t = s.trim();
		if (!t) return '—';
		if (t.length <= maxLen) return t;
		return t.slice(0, Math.max(0, maxLen - 1)) + '…';
	}

	const originDisplay = $derived(shortLabel(route.origin, 36));
	const destDisplay = $derived(shortLabel(route.destination, 36));

	const milesDisplay = $derived(
		route.miles != null ? `${route.miles % 1 === 0 ? route.miles : route.miles.toFixed(1)} mi` : null
	);

	const routeEmpty = $derived(
		!route.origin.trim() && !route.destination.trim() && route.miles == null
	);
</script>

<div class="overview-dashboard">
	<header class="dash-header">
		<div class="dash-header-row">
			<div class="dash-header-text">
				<h1>Overview</h1>
				<p class="dash-sub">Move dashboard — inventory, trailer fit, and route</p>
			</div>
			<button
				type="button"
				class="dash-settings-btn"
				onclick={() => settingsOpen.set(true)}
				aria-label="Open settings"
			>
				<svg
					width="22"
					height="22"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<circle cx="12" cy="12" r="3" />
					<path
						d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
					/>
				</svg>
			</button>
		</div>
	</header>

	<section class="dash-kpis" aria-label="Key metrics">
		<div class="dash-kpi">
			<span class="dash-kpi-val">{items.length}</span>
			<span class="dash-kpi-label">Items</span>
		</div>
		<div class="dash-kpi">
			<span class="dash-kpi-val">{totalWeight > 0 ? totalWeight : '—'}</span>
			<span class="dash-kpi-label">Total lbs</span>
		</div>
		<div class="dash-kpi">
			<span class="dash-kpi-val">{totalVolume > 0 ? Math.round(totalVolume * 10) / 10 : '—'}</span>
			<span class="dash-kpi-label">Cu ft</span>
		</div>
		<label class="dash-kpi dash-kpi-date">
			<span class="dash-kpi-val">{daysUntilMove !== null ? daysUntilMove : '—'}</span>
			<span class="dash-kpi-label">
				<svg
					class="cal-icon"
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<rect x="3" y="4" width="18" height="18" rx="2" />
					<line x1="16" y1="2" x2="16" y2="6" />
					<line x1="8" y1="2" x2="8" y2="6" />
					<line x1="3" y1="10" x2="21" y2="10" />
				</svg>
				Days to move
			</span>
			<input
				type="date"
				class="hidden-date-input"
				value={moveDateVal ?? ''}
				oninput={(e) => moveDate.set(e.currentTarget.value || null)}
			/>
		</label>
	</section>

	<div class="dash-main">
		<div class="dash-col dash-col-primary">
			<section class="dash-panel" aria-labelledby="cap-heading">
				<h2 id="cap-heading" class="panel-title">Capacity vs inventory</h2>
				<p class="panel-meta">
					Trailer: <strong>{currentTrailer.name}</strong>
					<span class="panel-meta-detail"
						>{fmtCuFt(containerCuFt)} cu ft interior · {payloadLbs.toLocaleString()} lb payload</span
					>
				</p>

				<div class="pack-bars">
					<div class="cap-bar-block">
						<div class="cap-bar-header">
							<span class="cap-bar-title">Space</span>
							<span class="cap-bar-meta">
								{Math.round(volUtilPct)}% of trailer volume ·
								{#if spaceLeftCuFt >= 0}
									<strong>{fmtCuFt(spaceLeftCuFt)} cu ft</strong> headroom
								{:else}
									<strong class="over">{fmtCuFt(-spaceLeftCuFt)} cu ft</strong> over
								{/if}
							</span>
						</div>
						<div
							class="cap-bar-track"
							class:over-cap={volUtilPct > 100}
							role="progressbar"
							aria-valuemin="0"
							aria-valuemax="100"
							aria-valuenow={Math.round(Math.min(100, volUtilPct))}
							aria-label="Inventory volume versus trailer interior volume"
						>
							<div class="cap-bar-fill vol" style:width="{volBarPct}%"></div>
						</div>
					</div>

					<div class="cap-bar-block">
						<div class="cap-bar-header">
							<span class="cap-bar-title">Weight</span>
							<span class="cap-bar-meta">
								{Math.round(totalWeight)} / {payloadLbs} lbs
								{#if weightLeftLbs >= 0}
									· <strong>{Math.round(weightLeftLbs)} lbs</strong> left
								{:else}
									· <strong class="over">{Math.round(-weightLeftLbs)} lbs</strong> over
								{/if}
							</span>
						</div>
						<div
							class="cap-bar-track"
							class:over-cap={weightUtilPct > 100}
							role="progressbar"
							aria-valuemin="0"
							aria-valuemax="100"
							aria-valuenow={Math.round(Math.min(100, weightUtilPct))}
							aria-label="Inventory weight versus trailer payload"
						>
							<div class="cap-bar-fill weight" style:width="{weightBarPct}%"></div>
						</div>
						{#if itemsWithoutWeight > 0}
							<p class="cap-bar-hint">
								{itemsWithoutWeight} item{itemsWithoutWeight === 1 ? '' : 's'} missing weight — bar may read
								low
							</p>
						{/if}
					</div>
				</div>
			</section>

			{#if recommendedTrailer}
				<div class="dash-panel dash-panel-inline">
					<svg
						class="trailer-inline-icon"
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<rect x="1" y="6" width="15" height="10" rx="2" />
						<path d="M16 10h4l3 3v3h-7v-6z" />
						<circle cx="5.5" cy="18.5" r="2.5" />
						<circle cx="18.5" cy="18.5" r="2.5" />
					</svg>
					<div class="trailer-inline-text">
						<span class="trailer-inline-label">Suggested trailer</span>
						<span class="trailer-inline-name">{recommendedTrailer}</span>
					</div>
				</div>
			{/if}
		</div>

		<div class="dash-col dash-col-side">
			<section class="dash-panel dash-panel-route" aria-labelledby="route-heading">
				<h2 id="route-heading" class="panel-title">Route</h2>
				<div class="route-map-inner" role="img" aria-label="Move route from origin A to destination B">
					<svg class="route-svg" viewBox="0 0 320 88" preserveAspectRatio="xMidYMid meet">
						<path
							class="route-path"
							d="M 52 50 Q 160 18 268 50"
							fill="none"
							stroke-width="2"
							stroke-linecap="round"
						/>
						<circle class="route-dot" cx="52" cy="50" r="10" />
						<circle class="route-dot" cx="268" cy="50" r="10" />
						<text class="route-letter" x="52" y="54" text-anchor="middle">A</text>
						<text class="route-letter" x="268" y="54" text-anchor="middle">B</text>
					</svg>

					{#if milesDisplay}
						<p class="route-miles">{milesDisplay}</p>
					{:else}
						<p class="route-miles route-miles-muted">Distance not set</p>
					{/if}

					<div class="route-label-row">
						<div class="route-label-col">
							<span class="route-label-tag">From</span>
							<span class="route-label-text" title={route.origin || undefined}>{originDisplay}</span>
						</div>
						<div class="route-label-col route-label-col-end">
							<span class="route-label-tag">To</span>
							<span class="route-label-text" title={route.destination || undefined}>{destDisplay}</span>
						</div>
					</div>

					{#if routeEmpty}
						<p class="route-settings-hint">
							Add locations and miles in Settings (gear) → Move route
						</p>
					{/if}
				</div>
			</section>
		</div>
	</div>
</div>

<style>
	.overview-dashboard {
		width: 100%;
		max-width: none;
		margin: 0;
		box-sizing: border-box;
		min-height: 100%;
		padding: 16px clamp(16px, 3vw, 40px) calc(28px + var(--safe-area-bottom));
		display: flex;
		flex-direction: column;
		gap: clamp(20px, 2.5vw, 28px);
	}

	.dash-header {
		flex-shrink: 0;
	}

	.dash-header-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}

	.dash-header-text {
		min-width: 0;
		flex: 1;
	}

	.dash-header h1 {
		font-size: clamp(26px, 4vw, 32px);
		font-weight: 700;
		letter-spacing: var(--letter-tight);
		line-height: 1.12;
		color: var(--color-text-primary);
	}

	.dash-sub {
		margin-top: 6px;
		font-size: 14px;
		color: var(--color-text-muted);
		line-height: 1.45;
		max-width: 42rem;
	}

	.dash-settings-btn {
		flex-shrink: 0;
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-md);
		background: var(--color-bg-card);
		color: var(--color-text-secondary);
		box-shadow: inset 0 0 0 1px var(--color-border-subtle);
		transition: background 0.2s ease, color 0.2s ease, transform 0.12s ease;
	}

	.dash-settings-btn:hover {
		background: var(--color-bg-elevated);
		color: var(--color-text-primary);
	}

	.dash-settings-btn:active {
		transform: scale(0.96);
	}

	/* KPI strip — full width */
	.dash-kpis {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	@media (min-width: 640px) {
		.dash-kpis {
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 14px;
		}
	}

	.dash-kpi {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: clamp(18px, 2.5vw, 26px) 14px;
		background: var(--color-bg-card);
		border-radius: var(--radius-lg);
		box-shadow: inset 0 0 0 1px var(--color-border-subtle);
		min-height: 108px;
	}

	.dash-kpi-val {
		font-size: clamp(28px, 5vw, 40px);
		font-weight: 700;
		line-height: 1;
		color: var(--color-text-primary);
	}

	.dash-kpi-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		text-align: center;
		line-height: 1.3;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.dash-kpi-date {
		cursor: pointer;
		position: relative;
	}

	.dash-kpi-date:has(.hidden-date-input:focus) {
		box-shadow: inset 0 0 0 2px var(--color-accent-soft);
	}

	/* Main dashboard columns */
	.dash-main {
		display: flex;
		flex-direction: column;
		gap: 20px;
		flex: 1;
		min-height: 0;
	}

	/* Route map first on mobile */
	.dash-col-side {
		order: -1;
	}

	@media (min-width: 960px) {
		.dash-main {
			flex-direction: row;
			align-items: stretch;
			gap: clamp(20px, 2.5vw, 32px);
		}

		.dash-col-primary {
			flex: 1.35;
			min-width: 0;
			display: flex;
			flex-direction: column;
			gap: 16px;
		}

		.dash-col-side {
			order: 0; /* reset — natural order on desktop */
			flex: 0 1 min(420px, 38vw);
			min-width: 280px;
			display: flex;
			flex-direction: column;
		}

		.dash-panel-route {
			flex: 1;
			display: flex;
			flex-direction: column;
			min-height: 0;
		}

		.dash-panel-route .route-map-inner {
			flex: 1;
		}
	}

	.dash-col-primary,
	.dash-col-side {
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-width: 0;
	}

	.dash-panel {
		background: var(--color-bg-card);
		border-radius: var(--radius-lg);
		padding: clamp(18px, 2vw, 24px) clamp(18px, 2.5vw, 28px);
		box-shadow: inset 0 0 0 1px var(--color-border-subtle);
	}

	.dash-panel-inline {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 16px 22px;
	}

	.trailer-inline-icon {
		flex-shrink: 0;
		color: var(--color-text-muted);
	}

	.trailer-inline-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.trailer-inline-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
	}

	.trailer-inline-name {
		font-size: 16px;
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.panel-title {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin: 0 0 10px;
	}

	.panel-meta {
		margin: 0 0 18px;
		font-size: 13px;
		color: var(--color-text-muted);
		line-height: 1.45;
	}

	.panel-meta strong {
		color: var(--color-text-primary);
		font-weight: 600;
	}

	.panel-meta-detail {
		display: block;
		margin-top: 4px;
		font-size: 12px;
		opacity: 0.95;
	}

	.pack-bars {
		display: grid;
		grid-template-columns: 1fr;
		gap: 18px;
	}

	@media (min-width: 720px) {
		.pack-bars {
			grid-template-columns: 1fr 1fr;
			gap: 20px 24px;
		}
	}

	.cap-bar-block {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.cap-bar-header {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.cap-bar-title {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.cap-bar-meta {
		font-size: 13px;
		color: var(--color-text-muted);
		line-height: 1.35;
	}

	.cap-bar-meta strong {
		color: var(--color-text-primary);
		font-weight: 600;
	}

	.cap-bar-meta .over {
		color: var(--color-danger);
	}

	.cap-bar-track {
		height: 8px;
		border-radius: 100px;
		background: rgba(255, 255, 255, 0.06);
		border: none;
		overflow: hidden;
	}

	.cap-bar-track.over-cap {
		box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.45);
	}

	.cap-bar-fill {
		height: 100%;
		border-radius: 100px;
		transition: width 0.25s ease;
	}

	.cap-bar-fill.vol {
		background: linear-gradient(90deg, #9a9a9a, #f0f0f0);
	}

	.cap-bar-fill.weight {
		background: linear-gradient(90deg, #22c55e, #4ade80);
	}

	.cap-bar-track.over-cap .cap-bar-fill.weight {
		background: linear-gradient(90deg, var(--color-danger), #f87171);
	}

	.cap-bar-hint {
		font-size: 11px;
		color: var(--color-text-muted);
		margin: 0;
		line-height: 1.35;
	}

	.route-map-inner {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-top: 4px;
	}

	.route-svg {
		width: 100%;
		height: auto;
		max-height: 120px;
		display: block;
	}

	.route-path {
		stroke: var(--color-text-tertiary);
		opacity: 0.55;
	}

	.route-dot {
		fill: var(--color-bg-elevated);
		stroke: var(--color-text-muted);
		stroke-width: 1.5;
	}

	.route-letter {
		font-size: 11px;
		font-weight: 700;
		fill: var(--color-text-primary);
		pointer-events: none;
	}

	.route-miles {
		text-align: center;
		font-size: 22px;
		font-weight: 700;
		letter-spacing: var(--letter-tight);
		color: var(--color-text-primary);
		margin: 0;
	}

	.route-miles-muted {
		font-size: 14px;
		font-weight: 600;
		color: var(--color-text-muted);
	}

	.route-label-row {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		margin-top: 4px;
	}

	.route-label-col {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
		flex: 1;
	}

	.route-label-col-end {
		align-items: flex-end;
		text-align: right;
	}

	.route-label-tag {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text-muted);
	}

	.route-label-text {
		font-size: 13px;
		font-weight: 500;
		color: var(--color-text-secondary);
		line-height: 1.35;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.route-settings-hint {
		margin: 4px 0 0;
		font-size: 12px;
		color: var(--color-text-muted);
		text-align: center;
		line-height: 1.4;
	}

	.cal-icon {
		opacity: 0.7;
	}

	.hidden-date-input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
		width: 100%;
		height: 100%;
	}

	@media (min-width: 768px) {
		.overview-dashboard {
			padding-top: 24px;
		}
	}
</style>
