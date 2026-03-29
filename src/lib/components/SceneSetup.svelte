<script lang="ts">
	import { interactivity } from '@threlte/extras';
	import { useThrelte } from '@threlte/core';

	interactivity();

	const { renderer } = useThrelte();

	// #region agent log
	$effect(() => {
		const canvas = renderer.domElement;
		if (!canvas) return;
		const handler = (e: PointerEvent) => {
			fetch('http://127.0.0.1:7843/ingest/b4c5b2e9-c26b-4911-bef1-be346f3fecc8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d7c19a'},body:JSON.stringify({sessionId:'d7c19a',location:'SceneSetup.svelte:rawCanvasClick',message:'raw DOM pointerdown on canvas',data:{x:e.offsetX,y:e.offsetY,button:e.button,target:(e.target as HTMLElement)?.tagName},timestamp:Date.now(),hypothesisId:'E1',runId:'diag2'})}).catch(()=>{});
		};
		canvas.addEventListener('pointerdown', handler);
		return () => canvas.removeEventListener('pointerdown', handler);
	});
	// #endregion
</script>
