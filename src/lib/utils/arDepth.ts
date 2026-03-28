/**
 * arDepth.ts
 * WebXR Depth Sensing API — captures a single depth frame on devices with
 * LiDAR (iPhone 12 Pro+, iPad Pro 2020+) when running in Safari on iOS.
 *
 * The depth data is captured from the first XR animation frame, then the
 * session is ended immediately — it's a one-shot scan, not a live AR overlay.
 *
 * Fallback: if the device doesn't support WebXR or depth-sensing, returns null
 * and the caller switches to Transformers.js.
 */

export type ArDepthFrame = {
	/** Normalized depth values (0 = far, 1 = near) */
	data: Float32Array;
	width: number;
	height: number;
};

/** Check if the device likely supports WebXR immersive-ar (LiDAR capable). */
export async function isArDepthAvailable(): Promise<boolean> {
	if (typeof navigator === 'undefined' || !('xr' in navigator)) return false;
	try {
		return await navigator.xr!.isSessionSupported('immersive-ar');
	} catch {
		return false;
	}
}

/**
 * Start a brief WebXR AR session, capture one depth frame, then end the session.
 * Returns normalized depth data or null if unavailable.
 */
export async function captureArDepth(): Promise<ArDepthFrame | null> {
	if (!('xr' in navigator)) return null;

	let session: XRSession | null = null;

	try {
		// Request AR session with CPU-optimized depth sensing
		session = await navigator.xr!.requestSession('immersive-ar', {
			requiredFeatures: ['depth-sensing'],
			// @ts-expect-error — depthSensing is not in TS types yet
			depthSensing: {
				usagePreference: ['cpu-optimized'],
				dataFormatPreference: ['float32', 'luminance-alpha']
			}
		});

		// Minimal WebGL context required by the XR layer
		const canvas = document.createElement('canvas');
		const gl = canvas.getContext('webgl2', { xrCompatible: true });
		if (!gl) { await session.end(); return null; }

		await session.updateRenderState({
			baseLayer: new XRWebGLLayer(session, gl)
		});

		const refSpace = await session.requestReferenceSpace('local');

		return await new Promise<ArDepthFrame | null>((resolve) => {
			session!.requestAnimationFrame((_time, frame) => {
				try {
					const pose = frame.getViewerPose(refSpace);
					if (!pose?.views.length) { resolve(null); return; }

					// @ts-expect-error — getDepthInformation not yet in TS types
					const depthInfo = frame.getDepthInformation(pose.views[0]) as {
						data: ArrayBuffer;
						width: number;
						height: number;
						rawValueToMeters: number;
					} | null;

					if (!depthInfo?.data) { resolve(null); return; }

					const raw = new Float32Array(depthInfo.data);

					// Normalize metric depth (meters) to 0–1
					// rawValueToMeters converts raw int values if format is luminance-alpha;
					// if float32, values are already in meters.
					let min = Infinity, max = -Infinity;
					for (const v of raw) { if (v < min) min = v; if (v > max) max = v; }
					const range = max - min || 1;

					const normalized = new Float32Array(raw.length);
					for (let i = 0; i < raw.length; i++) {
						// Invert: close (small meters) → 1 (near), far → 0
						normalized[i] = 1 - (raw[i] - min) / range;
					}

					resolve({ data: normalized, width: depthInfo.width, height: depthInfo.height });
				} catch (e) {
					console.warn('[arDepth] Frame error:', e);
					resolve(null);
				} finally {
					session!.end().catch(() => {});
				}
			});
		});
	} catch (e) {
		console.warn('[arDepth] Session failed:', e);
		session?.end().catch(() => {});
		return null;
	}
}
