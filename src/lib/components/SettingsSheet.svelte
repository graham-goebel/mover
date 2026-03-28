<script lang="ts">
	import { theme, moveDate, settingsOpen } from '$lib/stores/app';

	function close() {
		settingsOpen.set(false);
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
</script>

{#if $settingsOpen}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="settings-backdrop" onclick={close}></div>

	<!-- Sheet -->
	<div class="settings-sheet animate-slide">
		<!-- Drag pill -->
		<div class="sheet-pill-wrap">
			<div class="sheet-pill"></div>
		</div>

		<div class="settings-header">
			<h2>Settings</h2>
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
		</div>
	</div>
{/if}

<style>
	/* ── Backdrop ───────────────────────────────────────────────────────────── */
	.settings-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 300;
		animation: backdrop-in 0.2s ease forwards;
	}

	@keyframes backdrop-in {
		from { opacity: 0; }
		to   { opacity: 1; }
	}

	/* ── Sheet ──────────────────────────────────────────────────────────────── */
	.settings-sheet {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 301;
		background: var(--color-bg-elevated);
		border-radius: 20px 20px 0 0;
		padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
		box-shadow: 0 -4px 40px rgba(0, 0, 0, 0.4);
	}

	/* ── Handle pill ────────────────────────────────────────────────────────── */
	.sheet-pill-wrap {
		display: flex;
		justify-content: center;
		padding: 12px 0 4px;
	}

	.sheet-pill {
		width: 36px;
		height: 4px;
		background: var(--color-border);
		border-radius: 100px;
	}

	/* ── Header ─────────────────────────────────────────────────────────────── */
	.settings-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4px 20px 16px;
		border-bottom: 1px solid var(--color-border);
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

	/* ── Body ───────────────────────────────────────────────────────────────── */
	.settings-body {
		padding: 8px 0;
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
		background: var(--color-border);
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
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		color: var(--color-text);
		flex-shrink: 0;
		width: 150px;
		text-align: right;
	}

	.date-input:focus {
		border-color: var(--color-text-muted);
		outline: none;
	}
</style>
