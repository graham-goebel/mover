/**
 * Web Worker: runs depth-anything-small via Transformers.js (ONNX/WASM).
 * First run downloads ~100 MB model, cached by browser afterward.
 *
 * Messages in:  { imageDataUrl: string }
 * Messages out:
 *   { type: 'status',   message: string }
 *   { type: 'progress', value: number (0-100) }
 *   { type: 'result',   depth: Float32Array, width: number, height: number }
 *   { type: 'error',    message: string }
 */

import { pipeline, RawImage, env } from '@huggingface/transformers';

// Use browser cache for model weights — no repeated downloads
env.useBrowserCache = true;
env.allowRemoteModels = true;

type DepthPipeline = Awaited<ReturnType<typeof pipeline>>;
let estimator: DepthPipeline | null = null;

async function getEstimator(): Promise<DepthPipeline> {
	if (estimator) return estimator;

	self.postMessage({ type: 'status', message: 'Downloading depth model (first use only, ~100 MB)…' });

	estimator = await pipeline('depth-estimation', 'Xenova/depth-anything-small-hf', {
		progress_callback: (p: { status: string; progress?: number }) => {
			if (p.status === 'progress' && p.progress !== undefined) {
				self.postMessage({ type: 'progress', value: Math.round(p.progress) });
			}
		}
	});

	return estimator;
}

self.onmessage = async (event: MessageEvent<{ imageDataUrl: string }>) => {
	const { imageDataUrl } = event.data;

	try {
		const pipe = await getEstimator();

		self.postMessage({ type: 'status', message: 'Estimating depth…' });

		const image = await RawImage.fromURL(imageDataUrl);
		const output = await pipe(image) as {
			predicted_depth: { data: Float32Array | number[]; dims: number[] }
		};

		const tensor = output.predicted_depth;
		const height = tensor.dims[0];
		const width  = tensor.dims[1];
		const raw    = Float32Array.from(tensor.data);

		// Normalize values to 0–1
		let min = Infinity, max = -Infinity;
		for (const v of raw) {
			if (v < min) min = v;
			if (v > max) max = v;
		}
		const range = max - min || 1;
		const normalized = new Float32Array(raw.length);
		for (let i = 0; i < raw.length; i++) {
			normalized[i] = (raw[i] - min) / range;
		}

		// Transfer the buffer to avoid copying
		self.postMessage(
			{ type: 'result', depth: normalized, width, height },
			[normalized.buffer]
		);
	} catch (err) {
		self.postMessage({ type: 'error', message: String(err) });
	}
};
