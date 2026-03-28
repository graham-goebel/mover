<script lang="ts">
	import type { InventoryItem, ItemCategory, ItemShape, Dimensions } from '$lib/types';
	import { inventory } from '$lib/stores/inventory';
	import { moveDate, arDepthAvailable } from '$lib/stores/app';
	import { volumeCuFt } from '$lib/utils/measurement';
	import { SHAPE_OPTIONS, CATEGORY_DEFAULT_SHAPE } from '$lib/utils/shapes';
	import { TRAILER_PRESETS } from '$lib/stores/trailer';
	import { generate3DModel, getDepthSource, type Generate3DStatus } from '$lib/utils/generate3d';
	import ItemCard from './ItemCard.svelte';
	import ContentsEditor from './ContentsEditor.svelte';
	import CameraCapture from './CameraCapture.svelte';
	import MeasurementCanvas from './MeasurementCanvas.svelte';
	import BottomSheet from './BottomSheet.svelte';
	import { fileToDataUrl, compressPhoto } from '$lib/utils/photo';

	const PHOTO_PLACEHOLDER =
		"data:image/svg+xml," +
		encodeURIComponent(
			'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="#1e293b" width="200" height="200"/><text x="50%" y="50%" fill="#64748b" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="40">&#x1F4E6;</text></svg>'
		);

	let items = $state<InventoryItem[]>([]);
	let filterCategory = $state<ItemCategory | 'all'>('all');

	type SidebarMode = 'home' | 'add' | 'view' | 'edit' | 'photo';
	let sidebarMode = $state<SidebarMode>('home');
	let editingId = $state<string | null>(null);

	let name = $state('');
	let l = $state(0);
	let w = $state(0);
	let h = $state(0);
	let weight = $state(0);
	let category = $state<ItemCategory>('box');
	let shape = $state<ItemShape>('box');
	let fragile = $state(false);
	let stackable = $state(true);
	let forSale = $state(false);
	let notes = $state('');
	let photoUrl = $state<string | null>(null);
	let showDeleteConfirm = $state(false);

	// Mobile bottom-sheet state — auto-opens when sidebar mode is active
	let sheetState = $state<'peek' | 'full'>('peek');
	// peekHeight = pill(20) + sidebar-header(~52px) ≈ 72px
	const SHEET_PEEK_H = 72;

	$effect(() => {
		if (sidebarMode !== 'home') sheetState = 'full';
	});

	$effect(() => {
		if (sheetState === 'peek' && sidebarMode !== 'home') {
			switchToHome();
		}
	});

	let photoStep = $state<'capture' | 'measure'>('capture');
	let rawPhoto = $state<string | null>(null);

	let replacePhotoInput = $state<HTMLInputElement | null>(null);
	let replacePhotoLoading = $state(false);
	let generate3dLoading = $state(false);
	let generate3dStatus = $state<string | null>(null);
	let generate3dProgress = $state<number | null>(null);
	let generate3dError = $state<string | null>(null);
	let generate3dSource = $state<'lidar' | 'ai' | null>(null);
	let modelUrl = $state<string | null>(null);

	/** Lines for new box/bin items before the item exists in the store */
	let draftContents = $state<string[]>([]);

	inventory.subscribe((v) => items = v);

	// Common moving box sizes (as sold at Home Depot / U-Haul)
	const BOX_PRESETS: { label: string; l: number; w: number; h: number }[] = [
		{ label: 'Small\n16×12×12', l: 16, w: 12, h: 12 },
		{ label: 'Medium\n18×18×16', l: 18, w: 18, h: 16 },
		{ label: 'Large\n20×20×15', l: 20, w: 20, h: 15 },
		{ label: 'XL\n24×18×18', l: 24, w: 18, h: 18 },
		{ label: 'Wardrobe\n24×24×40', l: 24, w: 24, h: 40 },
		{ label: 'Dish\n18×18×28', l: 18, w: 18, h: 28 },
	];

	const categories: { value: ItemCategory; label: string; icon: string }[] = [
		{ value: 'box', label: 'Box', icon: '📦' },
		{ value: 'furniture', label: 'Furniture', icon: '🪑' },
		{ value: 'appliance', label: 'Appliance', icon: '🔌' },
		{ value: 'fragile', label: 'Fragile', icon: '⚠️' },
		{ value: 'oddShape', label: 'Odd Shape', icon: '🔷' },
		{ value: 'other', label: 'Other', icon: '📋' }
	];

	const filters: { value: ItemCategory | 'all'; label: string }[] = [
		{ value: 'all', label: 'All' },
		{ value: 'box', label: 'Boxes' },
		{ value: 'furniture', label: 'Furniture' },
		{ value: 'appliance', label: 'Appliances' },
		{ value: 'fragile', label: 'Fragile' },
		{ value: 'oddShape', label: 'Odd shape' },
		{ value: 'other', label: 'Other' }
	];

	const filtered = $derived(
		filterCategory === 'all'
			? items
			: items.filter((it) => it.category === filterCategory)
	);

	const totalVolume = $derived(
		items.reduce((sum, it) => sum + volumeCuFt(it.dimensions.l, it.dimensions.w, it.dimensions.h), 0)
	);

	const totalWeight = $derived(
		items.reduce((sum, it) => sum + (it.weight ?? 0), 0)
	);

	let moveDateVal = $state<string | null>(null);
	moveDate.subscribe((v) => moveDateVal = v);

	const daysUntilMove = $derived.by(() => {
		if (!moveDateVal) return null;
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		const target = new Date(moveDateVal + 'T00:00:00');
		const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
		return diff;
	});

	const recommendedTrailer = $derived.by(() => {
		if (totalVolume <= 0) return null;
		const FILL_FACTOR = 0.65;
		for (const p of TRAILER_PRESETS) {
			const cap = p.length * p.width * p.height * FILL_FACTOR;
			if (totalVolume <= cap) return p.name;
		}
		return TRAILER_PRESETS[TRAILER_PRESETS.length - 1].name + '+';
	});

	const vol = $derived(volumeCuFt(l, w, h));

	const editingItem = $derived(items.find((it) => it.id === editingId) ?? null);

	function resetForm() {
		name = '';
		l = 0; w = 0; h = 0;
		weight = 0;
		category = 'box';
		shape = 'box';
		fragile = false;
		stackable = true;
		forSale = false;
		notes = '';
		photoUrl = null;
		showDeleteConfirm = false;
		draftContents = [];
		modelUrl = null;
		generate3dError = null;
	}

	function draftContentAdd(text: string) {
		draftContents = [...draftContents, text];
	}

	function draftContentRemove(index: number) {
		draftContents = draftContents.filter((_, i) => i !== index);
	}

	function switchToHome() {
		editingId = null;
		sidebarMode = 'home';
		resetForm();
	}

	function switchToAdd() {
		editingId = null;
		sidebarMode = 'add';
		resetForm();
	}

	function switchToView(id: string) {
		const item = items.find((it) => it.id === id);
		if (!item) return;
		editingId = id;
		sidebarMode = 'view';
		showDeleteConfirm = false;
	}

	function startEditing() {
		const item = editingItem;
		if (!item) return;
		sidebarMode = 'edit';
		name = item.name;
		l = item.dimensions.l;
		w = item.dimensions.w;
		h = item.dimensions.h;
		weight = item.weight ?? 0;
		category = item.category as ItemCategory;
		shape = (item.shape ?? CATEGORY_DEFAULT_SHAPE[item.category] ?? 'generic') as ItemShape;
		fragile = item.fragile;
		stackable = item.stackable;
		forSale = item.forSale ?? false;
		notes = item.notes ?? '';
		photoUrl = item.photo || null;
		modelUrl = item.modelUrl || null;
		showDeleteConfirm = false;
	}

	function setCategory(cat: ItemCategory) {
		category = cat;
		shape = CATEGORY_DEFAULT_SHAPE[cat] ?? 'generic';
	}

	function handleAdd() {
		if (!name.trim()) return;
		inventory.add({
			name: name.trim(),
			photo: photoUrl || PHOTO_PLACEHOLDER,
			dimensions: { l, w, h },
			weight: weight || undefined,
			category,
			shape,
			fragile,
			stackable,
			forSale,
			modelUrl: modelUrl || undefined,
			contents:
				category === 'box' || shape === 'bin' ? [...draftContents] : [],
			notes: notes || undefined
		});
		switchToHome();
	}

	function handleSave() {
		if (!editingId) return;
		inventory.update(editingId, {
			name,
			photo: photoUrl || PHOTO_PLACEHOLDER,
			dimensions: { l, w, h },
			weight: weight || undefined,
			category,
			shape,
			fragile,
			stackable,
			forSale,
			modelUrl: modelUrl || undefined,
			notes: notes || undefined
		});
		switchToHome();
	}

	function handleDelete() {
		if (!editingId) return;
		inventory.remove(editingId);
		switchToHome();
	}

	function openPhotoCapture() {
		sidebarMode = 'photo';
		photoStep = 'capture';
		rawPhoto = null;
	}

	function triggerReplacePhoto() {
		replacePhotoInput?.click();
	}

	async function handleGenerate3D() {
		if (!photoUrl) return;
		const itemId = editingId ?? `draft-${Date.now()}`;
		generate3dLoading  = true;
		generate3dError    = null;
		generate3dStatus   = null;
		generate3dProgress = null;

		// Preview the depth source label before starting
		generate3dSource = await getDepthSource();

		const idbUrl = await generate3DModel(itemId, photoUrl, (s: Generate3DStatus) => {
			switch (s.type) {
				case 'status':
					generate3dStatus = s.message;
					if (s.source) generate3dSource = s.source;
					break;
				case 'progress':
					generate3dProgress = s.value;
					break;
				case 'done':
					modelUrl = s.idbUrl;
					generate3dStatus = null;
					break;
				case 'error':
					generate3dError = s.message;
					break;
			}
		});

		generate3dLoading  = false;
		generate3dProgress = null;

		if (idbUrl) {
			modelUrl = idbUrl;
			// Persist immediately if editing an existing item
			if (editingId) {
				inventory.update(editingId, { modelUrl: idbUrl });
			}
		}
	}

	async function handleReplacePhotoSelected(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		replacePhotoLoading = true;
		try {
			const raw = await fileToDataUrl(file);
			const compressed = await compressPhoto(raw);
			photoUrl = compressed;
			if (editingId) {
				inventory.update(editingId, { photo: compressed });
			}
		} finally {
			replacePhotoLoading = false;
		}
	}

	function removePhoto() {
		photoUrl = null;
		if (editingId) {
			inventory.update(editingId, { photo: PHOTO_PLACEHOLDER });
		}
	}

	function handleCapture(dataUrl: string) {
		rawPhoto = dataUrl;
		photoStep = 'measure';
	}

	function handleMeasureComplete(dims: Dimensions, photo: string) {
		photoUrl = photo;
		l = dims.l; w = dims.w; h = dims.h;
		sidebarMode = editingId ? 'edit' : 'add';
	}

	function cancelPhoto() {
		sidebarMode = editingId ? 'edit' : 'add';
		rawPhoto = null;
	}

	function shapeLabel(s: string): string {
		return SHAPE_OPTIONS.find(o => o.value === s)?.label ?? s;
	}

	function shapeIcon(s: string): string {
		return SHAPE_OPTIONS.find(o => o.value === s)?.icon ?? '📐';
	}

	function catLabel(c: string): string {
		return categories.find(cat => cat.value === c)?.label ?? c;
	}

	function catIcon(c: string): string {
		return categories.find(cat => cat.value === c)?.icon ?? '📋';
	}
</script>

<div class="inv-page" class:inv-home={sidebarMode === 'home'}>
	<input
		bind:this={replacePhotoInput}
		type="file"
		accept="image/*"
		class="replace-photo-input"
		aria-hidden="true"
		tabindex="-1"
		onchange={handleReplacePhotoSelected}
	/>
	<!-- Left sidebar / mobile bottom sheet -->
	<div class="left-panel">
		<BottomSheet bind:state={sheetState} peekHeight={SHEET_PEEK_H}>
		<div class="sidebar-header" class:sidebar-header-home={sidebarMode === 'home'}>
			{#if sidebarMode === 'home'}
				<h1 class="sidebar-title">Overview</h1>
			{:else if sidebarMode === 'view'}
				<button class="sidebar-back" onclick={switchToHome} aria-label="Back">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
				</button>
				<h2>Item Details</h2>
				<button class="sidebar-action" onclick={startEditing}>Edit</button>
			{:else if sidebarMode === 'edit'}
				<button class="sidebar-back" onclick={() => editingId ? switchToView(editingId) : switchToHome()} aria-label="Cancel edit">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
				</button>
				<h2>Edit Item</h2>
				<button class="sidebar-action" onclick={handleSave}>Save</button>
			{:else if sidebarMode === 'photo'}
				<button class="sidebar-back" onclick={cancelPhoto} aria-label="Cancel photo">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
				</button>
				<h2>Add Photo</h2>
				<div style="width: 50px"></div>
			{:else}
				<button class="sidebar-back" onclick={switchToHome} aria-label="Back">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
				</button>
				<h2>Add Item</h2>
				<button class="sidebar-action" onclick={handleAdd} disabled={!name.trim()}>Add</button>
			{/if}
		</div>

		<div class="sidebar-scroll">
			{#if sidebarMode === 'home'}
				<div class="home-panel">
					<div class="home-stats">
						<div class="home-stat">
							<span class="home-stat-val">{items.length}</span>
							<span class="home-stat-label">Items</span>
						</div>
						<div class="home-stat">
							<span class="home-stat-val">{totalWeight > 0 ? totalWeight : '—'}</span>
							<span class="home-stat-label">lbs</span>
						</div>
						<div class="home-stat">
							<span class="home-stat-val">{totalVolume > 0 ? Math.round(totalVolume * 10) / 10 : '—'}</span>
							<span class="home-stat-label">cu ft</span>
						</div>
						<label class="home-stat home-stat-date">
							<span class="home-stat-val">{daysUntilMove !== null ? daysUntilMove : '—'}</span>
							<span class="home-stat-label">
								<svg class="cal-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
								</svg>
								days
							</span>
							<input
								type="date"
								class="hidden-date-input"
								value={moveDateVal ?? ''}
								oninput={(e) => moveDate.set(e.currentTarget.value || null)}
							/>
						</label>
					</div>

					{#if recommendedTrailer}
						<div class="home-rec">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect x="1" y="6" width="15" height="10" rx="2"/><path d="M16 10h4l3 3v3h-7v-6z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
							</svg>
							<span>Recommended: <strong>{recommendedTrailer}</strong></span>
						</div>
					{/if}
				</div>
			{:else if sidebarMode === 'view' && editingItem}
				{@const item = editingItem}
				<div class="view-panel">
					<div class="view-photo-block">
						{#if item.photo && !item.photo.includes('data:image/svg+xml')}
							<div class="view-photo">
								<img src={item.photo} alt={item.name} />
							</div>
						{:else}
							<div class="view-photo-placeholder" aria-hidden="true">📦</div>
						{/if}
						<button
							type="button"
							class="view-photo-action"
							onclick={triggerReplacePhoto}
							disabled={replacePhotoLoading}
						>
							{replacePhotoLoading ? 'Updating…' : item.photo?.includes('data:image/svg+xml') ? 'Add photo' : 'Replace photo'}
						</button>
					</div>

					<div class="view-name">{item.name}</div>

					<div class="view-meta">
						<div class="view-row">
							<span class="view-label">Dimensions</span>
							<span class="view-value">{item.dimensions.l}″ × {item.dimensions.w}″ × {item.dimensions.h}″</span>
						</div>
						<div class="view-row">
							<span class="view-label">Volume</span>
							<span class="view-value">{volumeCuFt(item.dimensions.l, item.dimensions.w, item.dimensions.h)} cu ft</span>
						</div>
						{#if item.weight}
							<div class="view-row">
								<span class="view-label">Weight</span>
								<span class="view-value">{item.weight} lbs</span>
							</div>
						{/if}
						<div class="view-row">
							<span class="view-label">Category</span>
							<span class="view-value">{catIcon(item.category)} {catLabel(item.category)}</span>
						</div>
						<div class="view-row">
							<span class="view-label">Shape</span>
							<span class="view-value">{shapeIcon(item.shape)} {shapeLabel(item.shape)}</span>
						</div>
					</div>

					<div class="view-badges">
						{#if item.forSale}
							<span class="badge badge-sale">💲 For Sale</span>
						{/if}
						{#if item.fragile}
							<span class="badge badge-warn">⚠️ Fragile</span>
						{/if}
						{#if item.stackable}
							<span class="badge badge-ok">✓ Stackable</span>
						{:else}
							<span class="badge badge-warn">🚫 No Stack</span>
						{/if}
					</div>

					{#if item.contents.length > 0}
						<div class="view-section">
							<span class="view-section-label">Contents ({item.contents.length})</span>
							<ul class="view-contents">
								{#each item.contents as c}
									<li>{c}</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if item.notes}
						<div class="view-section">
							<span class="view-section-label">Notes</span>
							<p class="view-notes">{item.notes}</p>
						</div>
					{/if}
				</div>
			{:else if sidebarMode === 'photo'}
				{#if photoStep === 'capture'}
					<div class="photo-capture-area">
						<CameraCapture onCapture={handleCapture} />
					</div>
				{:else if rawPhoto}
					<MeasurementCanvas
						photoUrl={rawPhoto}
						onComplete={handleMeasureComplete}
						onCancel={() => { rawPhoto = null; photoStep = 'capture'; }}
					/>
				{/if}
			{:else}
				<!-- Photo (optional) -->
				<div class="sidebar-photo">
					{#if photoUrl}
						<img src={photoUrl} alt={name || 'Item'} class="photo-thumb" />
						<div class="photo-actions">
							<button
								type="button"
								class="photo-btn"
								onclick={triggerReplacePhoto}
								disabled={replacePhotoLoading}
							>
								{replacePhotoLoading ? '…' : 'Replace'}
							</button>
							<button type="button" class="photo-btn danger" onclick={removePhoto}>Remove</button>
						</div>

					{#if true}
						<div class="generate-3d-block">
							{#if modelUrl}
								<div class="generate-3d-done">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
									3D model generated
									<button type="button" class="regen-btn" onclick={handleGenerate3D} disabled={generate3dLoading}>Regenerate</button>
								</div>
							{:else}
								<button
									type="button"
									class="generate-3d-btn"
									onclick={handleGenerate3D}
									disabled={generate3dLoading}
								>
									{#if generate3dLoading}
										<span class="gen-spinner"></span>
										{generate3dStatus ?? 'Starting…'}
									{:else}
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
										</svg>
										Generate 3D
										{#if $arDepthAvailable}
											<span class="lidar-badge">LiDAR</span>
										{/if}
									{/if}
								</button>
							{/if}

							{#if generate3dLoading && generate3dProgress !== null}
								<div class="gen-progress-bar">
									<div class="gen-progress-fill" style:width="{generate3dProgress}%"></div>
								</div>
								<p class="gen-progress-label">
									{#if generate3dSource === 'lidar'}
										<span class="lidar-badge">LiDAR</span>
									{:else}
										<span class="ai-badge">AI</span>
									{/if}
									{generate3dProgress}% — model download
								</p>
							{:else if generate3dLoading && generate3dStatus}
								<p class="gen-progress-label">
									{#if generate3dSource === 'lidar'}<span class="lidar-badge">LiDAR</span>
									{:else if generate3dSource === 'ai'}<span class="ai-badge">AI</span>
									{/if}
									{generate3dStatus}
								</p>
							{/if}

							{#if generate3dError}
								<p class="generate-3d-error">{generate3dError}</p>
							{/if}
						</div>
					{/if}
					{:else}
						<button class="add-photo-btn" onclick={openPhotoCapture}>
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
								<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
								<circle cx="12" cy="13" r="4"/>
							</svg>
							Add Photo
						</button>
					{/if}
				</div>

				<!-- Form fields -->
				<div class="sidebar-fields">
					<div class="field">
						<label for="item-name">Name</label>
						<input id="item-name" type="text" bind:value={name} placeholder="e.g. Living room box" />
					</div>

					<div class="field">
						<span class="field-label">Dimensions (inches)</span>
						<div class="dims-row">
							<div class="dim-input">
								<input type="number" bind:value={l} min="0" step="0.1" inputmode="decimal" />
								<span>L</span>
							</div>
							<span class="dim-x">×</span>
							<div class="dim-input">
								<input type="number" bind:value={w} min="0" step="0.1" inputmode="decimal" />
								<span>W</span>
							</div>
							<span class="dim-x">×</span>
							<div class="dim-input">
								<input type="number" bind:value={h} min="0" step="0.1" inputmode="decimal" />
								<span>H</span>
							</div>
						</div>
						{#if vol > 0}
							<p class="dim-summary">{vol} cu ft</p>
						{/if}

						{#if category === 'box'}
							<div class="box-presets">
								{#each BOX_PRESETS as preset}
									<button
										type="button"
										class="box-preset-btn"
										class:active={l === preset.l && w === preset.w && h === preset.h}
										onclick={() => { l = preset.l; w = preset.w; h = preset.h; }}
									>{preset.label}</button>
								{/each}
							</div>
						{/if}
					</div>

					<div class="field">
						<label for="item-weight">Weight (lbs)</label>
						<input id="item-weight" type="number" bind:value={weight} min="0" step="1" inputmode="numeric" placeholder="Optional" />
					</div>

					<div class="field">
						<span class="field-label">Category</span>
						<div class="cat-grid">
							{#each categories as cat}
								<button
									class="cat-btn"
									class:active={category === cat.value}
									onclick={() => setCategory(cat.value)}
								>
									<span class="cat-icon">{cat.icon}</span>
									<span class="cat-label">{cat.label}</span>
								</button>
							{/each}
						</div>
					</div>

					<div class="field">
						<label class="field-label" for="item-shape">3D Shape</label>
						<select id="item-shape" class="shape-select" bind:value={shape}>
							{#each SHAPE_OPTIONS as s}
								<option value={s.value}>{s.icon} {s.label}</option>
							{/each}
						</select>
					</div>

					<div class="toggles">
						<label class="toggle-row">
							<span>For Sale</span>
							<input type="checkbox" bind:checked={forSale} />
							<span class="toggle-track"></span>
						</label>
						<label class="toggle-row">
							<span>Fragile</span>
							<input type="checkbox" bind:checked={fragile} />
							<span class="toggle-track"></span>
						</label>
						<label class="toggle-row">
							<span>Stackable</span>
							<input type="checkbox" bind:checked={stackable} />
							<span class="toggle-track"></span>
						</label>
					</div>

					{#if sidebarMode === 'add' && (category === 'box' || shape === 'bin')}
						<ContentsEditor
							draft={true}
							contents={draftContents}
							onDraftAdd={draftContentAdd}
							onDraftRemove={draftContentRemove}
						/>
					{/if}

					{#if sidebarMode === 'edit' && editingItem}
						<ContentsEditor itemId={editingItem.id} contents={editingItem.contents} />
					{/if}

					<div class="field">
						<label for="item-notes">Notes</label>
						<textarea id="item-notes" bind:value={notes} rows="2" placeholder="Special instructions…"></textarea>
					</div>

					{#if sidebarMode === 'edit'}
						<div class="danger-zone">
							{#if showDeleteConfirm}
								<p class="delete-confirm-text">Delete this item?</p>
								<div class="delete-confirm-btns">
									<button class="cancel-delete" onclick={() => showDeleteConfirm = false}>Cancel</button>
									<button class="confirm-delete" onclick={handleDelete}>Delete</button>
								</div>
							{:else}
								<button class="delete-btn" onclick={() => showDeleteConfirm = true}>Delete Item</button>
							{/if}
						</div>
					{/if}
				</div>
			{/if}
		</div>
		</BottomSheet>
	</div>
	<!-- Right: inventory list -->
	<div class="right-panel">
		<div class="inv-scroll">
			<header class="inv-header">
				<div class="header-top">
					<h1>My Items</h1>
					<div class="header-stats">
						<span class="stat">{items.length} items</span>
						<span class="stat-dot">·</span>
						<span class="stat">{Math.round(totalVolume * 10) / 10} cu ft</span>
					</div>
				</div>

				<div class="filter-row">
					{#each filters as f}
						<button
							class="filter-pill"
							class:active={filterCategory === f.value}
							onclick={() => filterCategory = f.value}
						>
							{f.label}
						</button>
					{/each}
				</div>
			</header>

			{#if filtered.length === 0}
				<div class="empty-state">
					{#if items.length === 0}
						<div class="empty-icon">📦</div>
						<h3>No items yet</h3>
						<p>Fill out the form to add your first item</p>
					{:else}
						<p>No items in this category</p>
					{/if}
				</div>
			{:else}
				<div class="item-list">
					{#each filtered as item (item.id)}
						<ItemCard
							{item}
							onTap={(id) => switchToView(id)}
							onDelete={(id) => inventory.remove(id)}
						/>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	{#if sidebarMode === 'home'}
		<button type="button" class="add-item-float" onclick={switchToAdd}>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
				<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
			</svg>
			Add Item
		</button>
	{/if}
</div>

<style>
	/* ---- Mobile-first (stacked) ---- */
	.inv-page {
		height: 100%;
		display: flex;
		flex-direction: column;
		position: relative;
	}

	.replace-photo-input {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
		opacity: 0;
	}

	.left-panel {
		display: contents;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.sidebar-header-home {
		padding: 16px;
		border-bottom: none;
	}

	.sidebar-title {
		font-size: 28px;
		font-weight: 700;
	}

	.sidebar-header h2 {
		font-size: 17px;
		font-weight: 600;
	}

	.sidebar-back {
		padding: 6px;
		color: var(--color-accent);
	}

	.sidebar-action {
		padding: 6px 14px;
		background: var(--color-accent);
		color: var(--color-accent-fg);
		font-size: 14px;
		font-weight: 600;
		border-radius: var(--radius-sm);
	}

	.sidebar-action:disabled {
		opacity: 0.4;
	}

	/* On mobile the BottomSheet handles overflow — sidebar-scroll must be visible */
	.sidebar-scroll {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow: hidden; /* BottomSheet.sheet-body handles outer scroll */
	}

	.right-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.inv-scroll {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 0 16px calc(80px + var(--safe-area-bottom));
	}

	/* View panel (read-only) */
	.view-panel {
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.view-photo-block {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.view-photo-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 120px;
		border-radius: var(--radius-md);
		border: 1px dashed var(--color-border);
		background: var(--color-bg-card);
		font-size: 48px;
		opacity: 0.85;
	}

	.view-photo-action {
		align-self: flex-start;
		padding: 8px 14px;
		font-size: 14px;
		font-weight: 600;
		color: var(--color-accent);
		background: transparent;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
	}

	.view-photo-action:disabled {
		opacity: 0.5;
	}

	.view-photo {
		border-radius: var(--radius-md);
		overflow: hidden;
		max-height: 180px;
	}

	.view-photo img {
		width: 100%;
		object-fit: cover;
	}

	.view-name {
		font-size: 20px;
		font-weight: 700;
	}

	.view-meta {
		display: flex;
		flex-direction: column;
		gap: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}

	.view-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 12px;
	}

	.view-row + .view-row {
		border-top: 1px solid var(--color-border);
	}

	.view-label {
		font-size: 13px;
		color: var(--color-text-secondary);
		font-weight: 500;
	}

	.view-value {
		font-size: 13px;
		font-weight: 600;
	}

	.view-badges {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.badge {
		font-size: 12px;
		font-weight: 600;
		padding: 4px 10px;
		border-radius: 100px;
	}

	.badge-warn {
		background: var(--color-warning-soft);
		color: var(--color-warning);
	}

	.badge-ok {
		background: rgba(34, 197, 94, 0.1);
		color: #22c55e;
	}

	.badge-sale {
		background: rgba(59, 130, 246, 0.1);
		color: #3b82f6;
	}

	.view-section {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.view-section-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.view-contents {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.view-contents li {
		font-size: 13px;
		padding: 6px 10px;
		background: var(--color-bg-card);
		border-radius: var(--radius-sm);
	}

	.view-notes {
		font-size: 13px;
		color: var(--color-text-secondary);
		line-height: 1.5;
		margin: 0;
	}

	/* Photo section */
	.sidebar-photo {
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.photo-thumb {
		width: 100%;
		max-height: 140px;
		object-fit: cover;
		border-radius: var(--radius-md);
	}

	.photo-actions {
		display: flex;
		gap: 8px;
	}

	.photo-btn {
		font-size: 12px;
		font-weight: 600;
		padding: 4px 12px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		color: var(--color-text-secondary);
	}

	.photo-btn.danger {
		color: var(--color-danger);
		border-color: var(--color-danger);
	}

	.add-photo-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 20px;
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-secondary);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-md);
		transition: all 0.15s;
		width: 100%;
		justify-content: center;
	}

	.add-photo-btn:active {
		background: var(--color-bg-elevated);
	}

	.generate-3d-block {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding-top: 4px;
	}

	.generate-3d-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 10px 16px;
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text);
		background: var(--color-bg-elevated);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		transition: all 0.15s;
	}

	.generate-3d-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.generate-3d-btn:not(:disabled):active {
		background: #2a2a2a;
	}

	.generate-3d-done {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--color-success);
		font-weight: 600;
	}

	.regen-btn {
		margin-left: auto;
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-muted);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 2px 8px;
	}

	.generate-3d-error {
		font-size: 11px;
		color: var(--color-danger);
		line-height: 1.4;
	}

	.gen-progress-bar {
		height: 3px;
		background: var(--color-border);
		border-radius: 100px;
		overflow: hidden;
	}

	.gen-progress-fill {
		height: 100%;
		background: var(--color-text);
		border-radius: 100px;
		transition: width 0.3s ease;
	}

	.gen-progress-label {
		font-size: 11px;
		color: var(--color-text-muted);
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.lidar-badge {
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: #0ea5e9;
		color: #fff;
		padding: 1px 5px;
		border-radius: 100px;
		flex-shrink: 0;
	}

	.ai-badge {
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: #8b5cf6;
		color: #fff;
		padding: 1px 5px;
		border-radius: 100px;
		flex-shrink: 0;
	}

	.gen-spinner {
		display: inline-block;
		width: 14px;
		height: 14px;
		border: 2px solid var(--color-border);
		border-top-color: var(--color-text);
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
		flex-shrink: 0;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.photo-capture-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 300px;
	}

	/* Fields */
	.sidebar-fields {
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 20px;
		padding-bottom: calc(80px + var(--safe-area-bottom));
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.field label, .field-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.dims-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.dim-input {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.dim-input input {
		width: 100%;
		text-align: center;
		font-size: 18px;
		font-weight: 600;
		padding: 8px;
	}

	.dim-input span {
		font-size: 11px;
		color: var(--color-text-muted);
		font-weight: 600;
	}

	.dim-x {
		font-size: 16px;
		color: var(--color-text-muted);
		margin-top: -16px;
	}

	.dim-summary {
		font-size: 13px;
		color: var(--color-text-muted);
	}

	.box-presets {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 8px;
	}

	.box-preset-btn {
		font-size: 10px;
		font-weight: 500;
		line-height: 1.3;
		white-space: pre-line;
		text-align: center;
		padding: 6px 10px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		color: var(--color-text-secondary);
		background: transparent;
		transition: all 0.15s;
	}

	.box-preset-btn.active,
	.box-preset-btn:active {
		background: var(--color-bg-elevated);
		border-color: var(--color-text-muted);
		color: var(--color-text);
	}

	.cat-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
	}

	.cat-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
		padding: 8px 6px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		transition: all 0.15s;
	}

	.cat-btn.active {
		border-color: #525252;
		background: var(--color-bg-elevated);
	}

	.cat-icon { font-size: 18px; }
	.cat-label { font-size: 11px; font-weight: 500; }

	.shape-select {
		width: 100%;
		cursor: pointer;
		appearance: auto;
		color-scheme: dark;
	}

	.toggles {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px;
		background: var(--color-bg-card);
		border-radius: var(--radius-sm);
		font-size: 14px;
		cursor: pointer;
	}

	.toggle-row input { display: none; }

	.toggle-track {
		width: 40px;
		height: 24px;
		background: var(--color-bg-elevated);
		border-radius: 12px;
		position: relative;
		transition: background 0.2s;
	}

	.toggle-track::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 18px;
		height: 18px;
		background: #a3a3a3;
		border-radius: 50%;
		transition: transform 0.2s, background 0.2s;
	}

	.toggle-row input:checked + .toggle-track { background: var(--color-accent); }
	.toggle-row input:checked + .toggle-track::after {
		transform: translateX(16px);
		background: var(--color-accent-fg);
	}

	textarea {
		resize: vertical;
		min-height: 50px;
	}

	/* Danger zone */
	.danger-zone {
		padding-top: 12px;
		border-top: 1px solid var(--color-border);
	}

	.delete-btn {
		width: 100%;
		padding: 10px;
		color: var(--color-danger);
		font-size: 14px;
		font-weight: 600;
		border: 1px solid var(--color-danger);
		border-radius: var(--radius-md);
	}

	.delete-btn:active { background: var(--color-danger-soft); }

	.delete-confirm-text {
		text-align: center;
		font-size: 14px;
		font-weight: 500;
		margin-bottom: 10px;
	}

	.delete-confirm-btns {
		display: flex;
		gap: 10px;
	}

	.cancel-delete, .confirm-delete {
		flex: 1;
		padding: 10px;
		font-size: 14px;
		font-weight: 600;
		border-radius: var(--radius-md);
	}

	.cancel-delete { border: 1px solid var(--color-border); }
	.confirm-delete { background: var(--color-danger); color: white; }

	/* Home panel (sidebar default) */
	.home-panel {
		padding: 20px 16px 96px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.home-stats {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 10px;
	}

	.home-stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 20px 12px;
		background: var(--color-bg-card);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}

	.home-stat-val {
		font-size: 36px;
		font-weight: 700;
		line-height: 1;
	}

	.home-stat-label {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.home-stat-date {
		cursor: pointer;
		position: relative;
	}

	.home-stat-date .home-stat-val {
		transition: color 0.15s;
	}

	.home-stat-date:has(.hidden-date-input:focus) {
		border-color: var(--color-accent);
	}

	.cal-icon {
		opacity: 0.7;
	}

	.hidden-date-input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
		width: 100%;
		height: 100%;
	}

	.home-rec {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: 13px;
		color: var(--color-text-secondary);
	}

	.home-rec strong {
		color: var(--color-text);
		font-weight: 600;
	}

	.add-item-float {
		position: fixed;
		z-index: 210; /* above the sheet */
		left: 16px;
		right: 16px;
		/* On mobile, float just above the peek strip (tab-bar + peek height) */
		bottom: calc(var(--tab-bar-height) + var(--safe-area-bottom) + 72px + 8px);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 14px 20px;
		margin: 0;
		background: var(--color-accent);
		color: var(--color-accent-fg);
		font-size: 16px;
		font-weight: 600;
		border: none;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg), 0 0 0 1px rgba(255, 255, 255, 0.06);
		cursor: pointer;
		transition: background 0.15s, transform 0.12s;
	}

	.add-item-float:active {
		background: var(--color-accent-hover);
		transform: scale(0.98);
	}

	.inv-home .inv-scroll {
		padding-bottom: calc(148px + var(--safe-area-bottom));
	}

	/* Inventory header */
	.inv-header {
		position: sticky;
		top: 0;
		background: var(--color-bg);
		z-index: 10;
		padding: 16px 0 12px;
	}

	.header-top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 10px;
	}

	h1 {
		font-size: 28px;
		font-weight: 700;
	}

	.header-stats {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.stat {
		font-size: 14px;
		color: var(--color-text-secondary);
		font-weight: 500;
	}

	.stat-dot { color: var(--color-text-muted); }

	.filter-row {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
		padding-bottom: 4px;
	}

	.filter-row::-webkit-scrollbar { display: none; }

	.filter-pill {
		white-space: nowrap;
		padding: 6px 14px;
		font-size: 13px;
		font-weight: 500;
		border-radius: 100px;
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-text-secondary);
		transition: all 0.15s;
		flex-shrink: 0;
	}

	.filter-pill.active {
		background: var(--color-accent);
		border-color: var(--color-accent);
		color: var(--color-accent-fg);
	}

	.item-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 4px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 60px 24px;
		text-align: center;
	}

	.empty-icon { font-size: 48px; margin-bottom: 8px; }
	.empty-state h3 { font-size: 18px; font-weight: 600; }
	.empty-state p { font-size: 14px; color: var(--color-text-muted); line-height: 1.5; }

	/* ---- Desktop: side-by-side ---- */
	@media (min-width: 768px) {
		.inv-page {
			flex-direction: row;
		}

		.left-panel {
			display: flex;
			flex-direction: column;
			width: 360px;
			flex-shrink: 0;
			border-right: 1px solid var(--color-border);
			background: var(--color-bg);
			overflow: hidden;
		}

		/* On desktop the BottomSheet is position:static — sidebar-scroll scrolls independently */
		.sidebar-scroll {
			overflow-y: auto;
			-webkit-overflow-scrolling: touch;
		}

		.right-panel {
			flex: 1;
			min-width: 0;
		}

		.add-item-float {
			z-index: 40;
			left: 16px;
			right: auto;
			width: calc(360px - 32px);
			/* On desktop sit above the tab bar as before */
			bottom: calc(var(--tab-bar-height) + var(--safe-area-bottom) + 6px);
		}
	}
</style>
