<script lang="ts">
	import '../app.css';
	import TabBar from '$lib/components/TabBar.svelte';
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
		padding-bottom: var(--tab-bar-height);
	}
</style>
