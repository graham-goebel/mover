import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'Mover',
				short_name: 'Mover',
				description: 'Moving inventory & pack planning',
				theme_color: '#09090b',
				background_color: '#09090b',
				display: 'standalone',
				scope: '/mover/',
				start_url: '/mover/',
				icons: [
					{
						src: '/mover/icon-192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: '/mover/icon-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any maskable'
					}
				]
			},
		workbox: {
			globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
			// Force the new service worker to activate immediately instead of waiting for tabs to close
			skipWaiting: true,
			clientsClaim: true,
			// Always fetch fresh env (PUBLIC_*); stale precache caused empty Supabase URL on some clients
			runtimeCaching: [
				{
					urlPattern: ({ url }) => url.pathname.endsWith('/_app/env.js'),
					handler: 'NetworkFirst',
					options: {
						cacheName: 'mover-sveltekit-env',
						networkTimeoutSeconds: 5,
						expiration: { maxEntries: 2, maxAgeSeconds: 300 }
					}
				}
			]
		}
		})
	],
	ssr: {
		noExternal: ['three']
	},
	// Prevent Vite from pre-bundling Transformers.js — it uses WASM and dynamic imports
	optimizeDeps: {
		exclude: ['@huggingface/transformers']
	},
	worker: {
		format: 'es'
	}
});
