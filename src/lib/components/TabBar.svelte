<script lang="ts">
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
</script>

<nav class="tab-bar">
	<div class="tab-pill">
		{#each tabs as tab}
			{@const active = currentPath === tab.href || (tab.href !== '/' && currentPath.startsWith(tab.href))}
			<a href={tab.href} class="tab" class:active>
				<div class="tab-icon">
					{#if tab.icon === 'inventory'}
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
							<polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
							<line x1="12" y1="22.08" x2="12" y2="12"/>
						</svg>
					{:else if tab.icon === 'add'}
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
							<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
							<circle cx="12" cy="13" r="4"/>
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
	</div>
</nav>

<style>
	.tab-bar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		padding: 0 20px;
		padding-bottom: calc(12px + var(--safe-area-bottom));
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

	.tab {
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

	.tab.active {
		color: #fafafa;
		background: rgba(255, 255, 255, 0.1);
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
</style>
