<script lang="ts">
	import '../app.css';
	import TabBar from '$lib/components/TabBar.svelte';
	import SettingsSheet from '$lib/components/SettingsSheet.svelte';
	import { page } from '$app/stores';
	import { base } from '$app/paths';

	let { children } = $props();

	const tabs = [
		{ href: `${base}/`, label: 'Inventory', icon: 'inventory' },
		{ href: `${base}/packer`, label: 'Pack', icon: 'pack' }
	] as const;
</script>

<div class="app-shell">
	<main class="app-main">
		{@render children()}
	</main>
	<TabBar {tabs} currentPath={$page.url.pathname} />
	<SettingsSheet />
</div>

<style>
	.app-shell {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		overflow: hidden;
	}

	.app-main {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
		/* Mobile: push content below the top navbar */
		padding-top: var(--tab-bar-height);
	}

	@media (min-width: 768px) {
		.app-main {
			/* Desktop: navbar is at bottom, no top padding needed */
			padding-top: 0;
		}
	}
</style>
