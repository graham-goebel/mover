<script lang="ts">
	import { theme, moveDate, moveRoute, settingsOpen } from '$lib/stores/app';
	import { signOut } from '$lib/supabase';
	import { currentUser } from '$lib/stores/sync';

	function close() {
		settingsOpen.set(false);
	}

	async function handleSignOut() {
		close();
		await signOut();
	}

	let dateValue = $state($moveDate ?? '');

	// Keep local dateValue in sync when the store changes externally
	$effect(() => {
		dateValue = $moveDate ?? '';
	});

	function handleDateInput(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		moveDate.set(val || null);
	}

	function toggleTheme() {
		theme.set($theme === 'light' ? 'dark' : 'light');
	}

	let routeOrigin = $state('');
	let routeDestination = $state('');
	let routeMilesStr = $state('');

	$effect(() => {
		routeOrigin = $moveRoute.origin;
		routeDestination = $moveRoute.destination;
		routeMilesStr = $moveRoute.miles != null ? String($moveRoute.miles) : '';
	});

	function saveRouteOrigin(e: Event) {
		const v = (e.currentTarget as HTMLInputElement).value;
		moveRoute.update((r) => ({ ...r, origin: v }));
	}

	function saveRouteDestination(e: Event) {
		const v = (e.currentTarget as HTMLInputElement).value;
		moveRoute.update((r) => ({ ...r, destination: v }));
	}

	function saveRouteMiles(e: Event) {
		const raw = (e.currentTarget as HTMLInputElement).value.trim();
		if (raw === '') {
			moveRoute.update((r) => ({ ...r, miles: null }));
			return;
		}
		const n = parseFloat(raw);
		if (!Number.isFinite(n) || n < 0) {
			moveRoute.update((r) => ({ ...r, miles: null }));
			routeMilesStr = '';
			return;
		}
		const miles = Math.round(n * 10) / 10;
		moveRoute.update((r) => ({ ...r, miles }));
	}

	$effect(() => {
		if (!$settingsOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') close();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	});
</script>

{#if $settingsOpen}
	<div class="settings-root">
		<button type="button" class="settings-backdrop" onclick={close} aria-label="Close settings"></button>

		<div
			class="settings-modal animate-scale"
			role="dialog"
			aria-modal="true"
			aria-labelledby="settings-modal-title"
		>
		<div class="settings-header">
			<h2 id="settings-modal-title">Settings</h2>
			<button class="close-btn" onclick={close} aria-label="Close settings">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
					<line x1="18" y1="6" x2="6" y2="18"/>
					<line x1="6" y1="6" x2="18" y2="18"/>
				</svg>
			</button>
		</div>

		<div class="settings-body">
			<!-- Theme row -->
			<div class="settings-row">
				<div class="row-left">
					<div class="row-icon">
						{#if $theme === 'light'}
							<!-- Sun icon -->
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="12" cy="12" r="5"/>
								<line x1="12" y1="1" x2="12" y2="3"/>
								<line x1="12" y1="21" x2="12" y2="23"/>
								<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
								<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
								<line x1="1" y1="12" x2="3" y2="12"/>
								<line x1="21" y1="12" x2="23" y2="12"/>
								<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
								<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
							</svg>
						{:else}
							<!-- Moon icon -->
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
							</svg>
						{/if}
					</div>
					<div class="row-text">
						<span class="row-label">Appearance</span>
						<span class="row-desc">{$theme === 'light' ? 'Light mode' : 'Dark mode'}</span>
					</div>
				</div>
				<button
					class="toggle"
					class:on={$theme === 'light'}
					onclick={toggleTheme}
					role="switch"
					aria-checked={$theme === 'light'}
					aria-label="Toggle light mode"
				>
					<div class="toggle-thumb"></div>
				</button>
			</div>

			<div class="settings-divider"></div>

			<!-- Move date row -->
			<div class="settings-row">
				<div class="row-left">
					<div class="row-icon">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
							<line x1="16" y1="2" x2="16" y2="6"/>
							<line x1="8" y1="2" x2="8" y2="6"/>
							<line x1="3" y1="10" x2="21" y2="10"/>
						</svg>
					</div>
					<div class="row-text">
						<span class="row-label">Move Date</span>
						<span class="row-desc">{$moveDate ? new Date($moveDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not set'}</span>
					</div>
				</div>
				<input
					type="date"
					class="date-input"
					value={dateValue}
					oninput={handleDateInput}
					aria-label="Move date"
				/>
			</div>

			<div class="settings-divider"></div>

			<div class="settings-section-label">Move route</div>
			<p class="settings-section-hint">Shown on Overview — add labels and driving miles.</p>

			<div class="settings-stack">
				<label class="stack-label" for="route-origin">Starting from</label>
				<input
					id="route-origin"
					type="text"
					class="stack-input"
					placeholder="e.g. 123 Main St, Austin"
					value={routeOrigin}
					oninput={saveRouteOrigin}
					autocomplete="street-address"
				/>
			</div>

			<div class="settings-stack">
				<label class="stack-label" for="route-dest">Moving to</label>
				<input
					id="route-dest"
					type="text"
					class="stack-input"
					placeholder="e.g. Denver, CO"
					value={routeDestination}
					oninput={saveRouteDestination}
					autocomplete="off"
				/>
			</div>

			<div class="settings-stack">
				<label class="stack-label" for="route-miles">Distance (miles)</label>
				<input
					id="route-miles"
					type="text"
					inputmode="decimal"
					class="stack-input"
					placeholder="e.g. 920"
					value={routeMilesStr}
					oninput={(e) => (routeMilesStr = (e.currentTarget as HTMLInputElement).value)}
					onchange={saveRouteMiles}
					aria-describedby="route-miles-hint"
				/>
				<p id="route-miles-hint" class="stack-hint">Driving distance between the two places.</p>
			</div>
		</div>

		<!-- Account -->
		{#if $currentUser}
		<div class="settings-section">
			<p class="settings-label">Account</p>
			<div class="stack-group account-row">
				<span class="account-email">{$currentUser.email}</span>
				<button class="signout-btn" onclick={handleSignOut}>Sign out</button>
			</div>
		</div>
		{/if}
		</div>
	</div>
{/if}

<style>
	.settings-root {
		position: fixed;
		inset: 0;
		z-index: 300;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: max(12px, env(safe-area-inset-top, 0px)) 20px max(12px, env(safe-area-inset-bottom, 0px));
		pointer-events: none;
	}

	.settings-root > * {
		pointer-events: auto;
	}

	.settings-backdrop {
		position: absolute;
		inset: 0;
		border: none;
		padding: 0;
		margin: 0;
		cursor: pointer;
		background: rgba(0, 0, 0, 0.55);
		animation: backdrop-in 0.2s ease forwards;
		pointer-events: auto;
	}

	@keyframes backdrop-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.settings-modal {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 420px;
		max-height: min(88dvh, 720px);
		display: flex;
		flex-direction: column;
		background: var(--color-bg-elevated);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-lg), 0 0 0 1px var(--color-border-subtle);
		overflow: hidden;
		pointer-events: auto;
	}

	.settings-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-shrink: 0;
		padding: 16px 20px 14px;
		border-bottom: 1px solid var(--color-divider);
	}

	.settings-header h2 {
		font-size: 17px;
		font-weight: 600;
		color: var(--color-text);
	}

	.close-btn {
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: var(--color-accent-soft);
		color: var(--color-text-secondary);
		transition: background 0.15s;
	}

	.close-btn:active { background: var(--color-border); }

	.settings-body {
		padding: 8px 0 16px;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		flex: 1;
		min-height: 0;
	}

	/* ── Row ────────────────────────────────────────────────────────────────── */
	.settings-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 14px 20px;
	}

	.row-left {
		display: flex;
		align-items: center;
		gap: 14px;
		flex: 1;
		min-width: 0;
	}

	.row-icon {
		width: 36px;
		height: 36px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-accent-soft);
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
	}

	.row-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.row-label {
		font-size: 15px;
		font-weight: 500;
		color: var(--color-text);
	}

	.row-desc {
		font-size: 12px;
		color: var(--color-text-muted);
	}

	.settings-divider {
		height: 1px;
		background: var(--color-divider);
		margin: 4px 20px;
	}

	/* ── Toggle switch ──────────────────────────────────────────────────────── */
	.toggle {
		width: 50px;
		height: 28px;
		flex-shrink: 0;
		border-radius: 100px;
		background: var(--color-border);
		position: relative;
		transition: background 0.2s;
		cursor: pointer;
	}

	.toggle.on {
		background: #22c55e;
	}

	.toggle-thumb {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: white;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
		transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.toggle.on .toggle-thumb {
		transform: translateX(22px);
	}

	/* ── Date input ─────────────────────────────────────────────────────────── */
	.date-input {
		font-size: 14px;
		padding: 8px 12px;
		background: var(--color-bg-input);
		border: none;
		border-radius: var(--radius-md);
		color: var(--color-text);
		flex-shrink: 0;
		width: 150px;
		text-align: right;
		box-shadow: inset 0 0 0 1px var(--color-border-subtle);
		transition: box-shadow 0.2s ease;
	}

	.date-input:focus {
		outline: none;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
	}

	:global([data-theme='light']) .date-input:focus {
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
	}

	.settings-section-label {
		padding: 8px 20px 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.settings-section-hint {
		padding: 4px 20px 8px;
		margin: 0;
		font-size: 12px;
		color: var(--color-text-muted);
		line-height: 1.4;
	}

	.settings-stack {
		padding: 0 20px 14px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.stack-label {
		font-size: 13px;
		font-weight: 500;
		color: var(--color-text-secondary);
	}

	.stack-input {
		width: 100%;
		font-size: 15px;
		padding: 12px 14px;
		background: var(--color-bg-input);
		border: none;
		border-radius: var(--radius-md);
		color: var(--color-text);
		box-shadow: inset 0 0 0 1px var(--color-border-subtle);
		outline: none;
	}

	.stack-input:focus {
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
	}

	:global([data-theme='light']) .stack-input:focus {
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
	}

	.stack-hint {
		margin: 0;
		font-size: 11px;
		color: var(--color-text-muted);
		line-height: 1.35;
	}

	.account-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		gap: 12px;
	}

	.account-email {
		font-size: 13px;
		color: var(--color-text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.signout-btn {
		flex-shrink: 0;
		padding: 6px 14px;
		font-size: 13px;
		font-weight: 600;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-text-secondary);
		cursor: pointer;
		transition: background 0.15s;
	}

	.signout-btn:hover {
		background: var(--color-bg-card);
	}
</style>
