<script lang="ts">
	import { signInWithEmail, signUpWithPassword, signInWithPassword } from '$lib/supabase';

	let mode = $state<'password' | 'magic'>('password');
	let email = $state('');
	let password = $state('');
	let isSignUp = $state(false);
	let sent = $state(false);
	let loading = $state(false);
	let error = $state('');

	async function handlePassword() {
		if (!email.trim() || !password) return;
		loading = true;
		error = '';
		const fn = isSignUp ? signUpWithPassword : signInWithPassword;
		const { error: err } = await fn(email.trim(), password);
		loading = false;
		if (err) {
			error = err.message;
		}
	}

	async function handleMagicLink() {
		if (!email.trim()) return;
		loading = true;
		error = '';
		const { error: err } = await signInWithEmail(email.trim());
		loading = false;
		if (err) {
			error = err.message;
		} else {
			sent = true;
		}
	}

	function switchMode(m: 'password' | 'magic') {
		mode = m;
		error = '';
		sent = false;
	}
</script>

<div class="auth-gate">
	<div class="auth-card">
		<div class="auth-icon">📦</div>
		<h1>Mover</h1>
		<p class="auth-sub">Sign in to sync your inventory across devices</p>

		<div class="auth-tabs">
			<button
				class="auth-tab"
				class:active={mode === 'password'}
				onclick={() => switchMode('password')}
			>
				Password
			</button>
			<button
				class="auth-tab"
				class:active={mode === 'magic'}
				onclick={() => switchMode('magic')}
			>
				Magic link
			</button>
		</div>

		{#if mode === 'password'}
			<form onsubmit={(e) => { e.preventDefault(); handlePassword(); }}>
				<input
					type="email"
					class="auth-input"
					bind:value={email}
					placeholder="your@email.com"
					autocomplete="email"
					required
				/>
				<input
					type="password"
					class="auth-input"
					bind:value={password}
					placeholder="Password"
					autocomplete={isSignUp ? 'new-password' : 'current-password'}
					required
					minlength="6"
				/>
				{#if error}
					<p class="auth-error">{error}</p>
				{/if}
				<button type="submit" class="auth-btn" disabled={loading || !email.trim() || !password}>
					{#if loading}
						<span class="auth-spinner"></span>
						{isSignUp ? 'Creating account…' : 'Signing in…'}
					{:else}
						{isSignUp ? 'Create account' : 'Sign in'}
					{/if}
				</button>
			</form>
			<p class="auth-note">
				{#if isSignUp}
					Already have an account?
					<button class="auth-link" onclick={() => { isSignUp = false; error = ''; }}>Sign in</button>
				{:else}
					No account yet?
					<button class="auth-link" onclick={() => { isSignUp = true; error = ''; }}>Create one</button>
				{/if}
			</p>
		{:else if sent}
			<div class="auth-sent">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
					stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
					<polyline points="22,6 12,13 2,6"/>
				</svg>
				<p>Check your email — a magic link was sent to <strong>{email}</strong></p>
			</div>
		{:else}
			<form onsubmit={(e) => { e.preventDefault(); handleMagicLink(); }}>
				<input
					type="email"
					class="auth-input"
					bind:value={email}
					placeholder="your@email.com"
					autocomplete="email"
					required
				/>
				{#if error}
					<p class="auth-error">{error}</p>
				{/if}
				<button type="submit" class="auth-btn" disabled={loading || !email.trim()}>
					{#if loading}
						<span class="auth-spinner"></span>
						Sending…
					{:else}
						Send magic link
					{/if}
				</button>
			</form>
			<p class="auth-note">No password needed — we'll email you a sign-in link.</p>
		{/if}
	</div>
</div>

<style>
	.auth-gate {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100dvh;
		padding: 24px;
		background: var(--color-bg);
	}

	.auth-card {
		width: 100%;
		max-width: 380px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		text-align: center;
	}

	.auth-icon {
		font-size: 48px;
		line-height: 1;
	}

	h1 {
		font-size: 32px;
		font-weight: 700;
		letter-spacing: -0.02em;
		color: var(--color-text-primary);
		margin: 0;
	}

	.auth-sub {
		font-size: 15px;
		color: var(--color-text-muted);
		margin: 0;
		line-height: 1.5;
	}

	.auth-tabs {
		display: flex;
		width: 100%;
		gap: 4px;
		padding: 4px;
		background: var(--color-bg-card);
		border-radius: var(--radius-md);
		margin-top: 4px;
	}

	.auth-tab {
		flex: 1;
		padding: 10px 12px;
		font-size: 14px;
		font-weight: 500;
		border: none;
		border-radius: calc(var(--radius-md) - 2px);
		background: transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.auth-tab.active {
		background: var(--color-bg);
		color: var(--color-text-primary);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}

	form {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 4px;
	}

	.auth-input {
		width: 100%;
		padding: 14px 16px;
		font-size: 16px;
		border-radius: var(--radius-md);
		background: var(--color-bg-card);
		color: var(--color-text-primary);
		border: 1px solid var(--color-border);
		outline: none;
		transition: border-color 0.15s;
		box-sizing: border-box;
	}

	.auth-input:focus {
		border-color: var(--color-text-secondary);
	}

	.auth-btn {
		width: 100%;
		padding: 14px 20px;
		font-size: 16px;
		font-weight: 600;
		border-radius: var(--radius-md);
		background: var(--color-accent);
		color: var(--color-accent-fg);
		border: none;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		transition: background 0.15s, opacity 0.15s;
	}

	.auth-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.auth-error {
		font-size: 13px;
		color: var(--color-danger);
		margin: 0;
	}

	.auth-note {
		font-size: 13px;
		color: var(--color-text-muted);
		margin: 0;
		line-height: 1.5;
	}

	.auth-link {
		background: none;
		border: none;
		color: var(--color-accent);
		font-size: inherit;
		cursor: pointer;
		padding: 0;
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.auth-sent {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 24px;
		background: var(--color-bg-card);
		border-radius: var(--radius-lg);
		color: var(--color-text-secondary);
		line-height: 1.5;
		font-size: 14px;
		margin-top: 8px;
	}

	.auth-sent svg {
		color: var(--color-success);
	}

	.auth-sent strong {
		color: var(--color-text-primary);
	}

	.auth-spinner {
		display: inline-block;
		width: 16px;
		height: 16px;
		border: 2px solid rgba(0, 0, 0, 0.2);
		border-top-color: currentColor;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin { to { transform: rotate(360deg); } }
</style>
