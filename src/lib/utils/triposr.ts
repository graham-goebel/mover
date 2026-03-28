const TRIPOSR_URL = 'http://localhost:8765';

/** Check if the TripoSR server is running. Returns true/false. */
export async function checkTriposrHealth(): Promise<boolean> {
	try {
		const res = await fetch(`${TRIPOSR_URL}/health`, { signal: AbortSignal.timeout(2000) });
		return res.ok;
	} catch {
		return false;
	}
}

export type GenerateResult =
	| { ok: true; url: string }
	| { ok: false; error: string };

/**
 * Send a photo (data URL) to the TripoSR server and get back a GLB URL.
 * The returned URL points to http://localhost:8765/models/<id>.glb
 */
export async function generateModel(photoDataUrl: string): Promise<GenerateResult> {
	try {
		// Convert data URL → Blob
		const res = await fetch(photoDataUrl);
		const blob = await res.blob();

		const form = new FormData();
		form.append('file', blob, 'item.jpg');

		const response = await fetch(`${TRIPOSR_URL}/generate`, {
			method: 'POST',
			body: form,
			// TripoSR can take up to 2 min on CPU
			signal: AbortSignal.timeout(180_000),
		});

		if (!response.ok) {
			const text = await response.text();
			return { ok: false, error: `Server error ${response.status}: ${text}` };
		}

		const data = await response.json();
		return { ok: true, url: data.url };
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		return { ok: false, error: message };
	}
}
