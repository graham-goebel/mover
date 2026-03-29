<script lang="ts">
	import '../app.css';
	import TabBar from '$lib/components/TabBar.svelte';
	import SettingsSheet from '$lib/components/SettingsSheet.svelte';
	import AuthGate from '$lib/components/AuthGate.svelte';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { syncUserData, currentUser } from '$lib/stores/sync';

	let { children } = $props();
	let authReady = $state(false);

	const tabs = [
		{ href: `${base}/overview`, label: 'Overview', icon: 'overview' },
		{ href: `${base}/`, label: 'Inventory', icon: 'inventory' },
		{ href: `${base}/packer`, label: 'Pack', icon: 'pack' }
	] as const;

	onMount(() => {
		if (!browser) return;

		// #region agent log
		fetch('http://127.0.0.1:7843/ingest/b4c5b2e9-c26b-4911-bef1-be346f3fecc8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7c19a'},body:JSON.stringify({sessionId:'d7c19a',location:'+layout.svelte:onMount',message:'onMount fired, about to call getSession',data:{},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
		// #endregion

		// Resolve initial session
		supabase.auth.getSession().then(({ data }) => {
			// #region agent log
			fetch('http://127.0.0.1:7843/ingest/b4c5b2e9-c26b-4911-bef1-be346f3fecc8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7c19a'},body:JSON.stringify({sessionId:'d7c19a',location:'+layout.svelte:getSession.then',message:'getSession resolved',data:{hasSession:!!data.session,hasUser:!!data.session?.user},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
			// #endregion
			const user = data.session?.user ?? null;
			currentUser.set(user);
			if (user) syncUserData(user.id);
			authReady = true;
		}).catch((err: unknown) => {
			// #region agent log
			fetch('http://127.0.0.1:7843/ingest/b4c5b2e9-c26b-4911-bef1-be346f3fecc8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7c19a'},body:JSON.stringify({sessionId:'d7c19a',location:'+layout.svelte:getSession.catch',message:'getSession FAILED',data:{error:String(err)},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
			// #endregion
			authReady = true;
		});

		// Keep session reactive
		const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
			const user = session?.user ?? null;
			currentUser.set(user);
			if (user) syncUserData(user.id);
			authReady = true;
		});

		return () => subscription.unsubscribe();
	});
</script>

{#if !authReady}
	<!-- Thin full-screen loading state while session is resolved -->
	<div class="auth-loading">
		<span class="auth-loading-spinner"></span>
	</div>
{:else if !$currentUser}
	<AuthGate />
{:else}
	<div class="app-shell">
		<main class="app-main">
			{@render children()}
		</main>
		<TabBar {tabs} currentPath={$page.url.pathname} />
		<SettingsSheet />
	</div>
{/if}

<style>
	.auth-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100dvh;
		background: var(--color-bg);
	}

	.auth-loading-spinner {
		width: 28px;
		height: 28px;
		border: 3px solid var(--color-border);
		border-top-color: var(--color-text-secondary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin { to { transform: rotate(360deg); } }

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
