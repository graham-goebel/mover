<script lang="ts">
	import { settingsOpen } from '$lib/stores/app';

	interface Tab {
		href: string;
		label: string;
		icon: string;
	}

	interface Props {
		tabs: readonly Tab[];
		currentPath: string;
	}

	let { tabs, currentPath }: Props = $props();

	// Only one tab is active at a time: the one whose href is the longest prefix match
	const activeTab = $derived(
		[...tabs]
			.filter(t => {
				const base = t.href.replace(/\/$/, ''); // strip trailing slash for comparison
				return (
					currentPath === base ||
					currentPath === base + '/' ||
					currentPath.startsWith(base + '/')
				);
			})
			.sort((a, b) => b.href.length - a.href.length)[0] ?? null
	);
</script>

<nav class="tab-bar">
	<div class="tab-pill">
		{#each tabs as tab}
			<a href={tab.href} class="tab" class:active={tab === activeTab}>
				<div class="tab-icon">
					{#if tab.icon === 'inventory'}
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
							<polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
							<line x1="12" y1="22.08" x2="12" y2="12"/>
						</svg>
					{:else if tab.icon === 'pack'}
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
							<rect x="1" y="3" width="15" height="13" rx="2" ry="2"/>
							<path d="M16 8h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-2"/>
							<path d="M20 12h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-1"/>
						</svg>
					{/if}
				</div>
				<span class="tab-label">{tab.label}</span>
			</a>
		{/each}

		<!-- Settings button — separated by a thin divider -->
		<div class="tab-divider"></div>
		<button
			class="tab settings-tab"
			onclick={() => settingsOpen.update(v => !v)}
			aria-label="Settings"
		>
			<div class="tab-icon">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="3"/>
					<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
				</svg>
			</div>
		</button>
	</div>
</nav>

<style>
	.tab-bar {
		position: fixed;
		/* Mobile: top of screen — avoids conflicts with bottom sheet */
		top: 0;
		bottom: auto;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		padding: 0 20px;
		padding-top: calc(8px + env(safe-area-inset-top, 0px));
		padding-bottom: 8px;
		z-index: 50;
		pointer-events: none;
	}

	.tab-pill {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 8px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 22px;
		backdrop-filter: blur(24px) saturate(1.4);
		-webkit-backdrop-filter: blur(24px) saturate(1.4);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.4),
			0 0 0 0.5px rgba(255, 255, 255, 0.05) inset;
		pointer-events: auto;
	}

	/* Light mode: flip glass to white-frosted */
	:global([data-theme="light"]) .tab-pill {
		background: rgba(255, 255, 255, 0.75);
		border-color: rgba(0, 0, 0, 0.08);
		box-shadow:
			0 4px 24px rgba(0, 0, 0, 0.1),
			0 0 0 0.5px rgba(0, 0, 0, 0.04) inset;
	}

	.tab {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 8px 20px;
		text-decoration: none;
		color: rgba(255, 255, 255, 0.4);
		border-radius: 16px;
		transition: color 0.2s, background 0.2s;
		-webkit-tap-highlight-color: transparent;
		position: relative;
	}

	:global([data-theme="light"]) .tab {
		color: rgba(0, 0, 0, 0.35);
	}

	.tab.active {
		color: #fafafa;
		background: rgba(255, 255, 255, 0.1);
	}

	:global([data-theme="light"]) .tab.active {
		color: #09090b;
		background: rgba(0, 0, 0, 0.07);
	}

	.tab-icon {
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.tab-label {
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.02em;
	}

	/* Settings button — no label, slightly smaller icon */
	.settings-tab {
		padding: 8px 10px;
		color: rgba(255, 255, 255, 0.35);
	}

	:global([data-theme="light"]) .settings-tab {
		color: rgba(0, 0, 0, 0.3);
	}

	.settings-tab:active {
		background: rgba(255, 255, 255, 0.08);
	}

	/* Thin vertical divider before settings button */
	.tab-divider {
		width: 1px;
		height: 20px;
		background: rgba(255, 255, 255, 0.12);
		margin: 0 2px;
		flex-shrink: 0;
	}

	:global([data-theme="light"]) .tab-divider {
		background: rgba(0, 0, 0, 0.1);
	}

	/* Desktop: move back to bottom */
	@media (min-width: 768px) {
		.tab-bar {
			top: auto;
			bottom: 0;
			padding-top: 0;
			padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
		}
	}
</style>
