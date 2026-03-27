import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const dev = process.argv.includes('dev');

const config = {
	kit: {
		adapter: adapter({
			fallback: 'index.html'
		}),
		paths: {
			base: dev ? '' : '/mover'
		}
	},
	preprocess: vitePreprocess()
};

export default config;
