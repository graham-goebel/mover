<script lang="ts">
	import { signInWithEmail } from '$lib/supabase';

	let email = $state('');
	let sent = $state(false);
	let loading = $state(false);
	let error = $state('');

	async function handleSubmit() {
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
</script>

<div class="auth-gate">
	<div class="auth-card">
		<div class="auth-icon">📦</div>
		<h1>Mover</h1>
		<p class="auth-sub">Sign in to sync your inventory across devices</p>

		{#if sent}
			<div class="auth-sent">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
					stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.07 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z"/>
				</svg>
				<p>Check your email — a magic link was sent to <strong>{email}</strong></p>
			</div>
		{:else}
			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
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
			<p class="auth-note">No password needed. We'll email you a link to sign in.</p>
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

	form {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 8px;
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
