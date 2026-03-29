<script lang="ts">
	import type { InventoryItem, ItemCategory, ItemShape, Dimensions } from '$lib/types';
	import { inventory } from '$lib/stores/inventory';
	import { arDepthAvailable } from '$lib/stores/app';
	import { volumeCuFt } from '$lib/utils/measurement';
	import { SHAPE_OPTIONS, CATEGORY_DEFAULT_SHAPE } from '$lib/utils/shapes';
	import { generate3DModel, getDepthSource, type Generate3DStatus } from '$lib/utils/generate3d';
	import ItemCard from './ItemCard.svelte';
	import ContentsEditor from './ContentsEditor.svelte';
	import CameraCapture from './CameraCapture.svelte';
	import BottomSheet from './BottomSheet.svelte';
	import { fileToDataUrl, compressPhoto } from '$lib/utils/photo';
	import type { RoomPresetId } from '$lib/utils/rooms';
	import {
		roomFromPresetAndCustom,
		splitStoredRoom,
		roomDisplayLabel,
		isGeneralRoom
	} from '$lib/utils/rooms';
	import RoomPicker from './RoomPicker.svelte';
	import ItemFlagsDropdown from './ItemFlagsDropdown.svelte';

	const PHOTO_PLACEHOLDER =
		"data:image/svg+xml," +
		encodeURIComponent(
			'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="#1a1a1a" width="200" height="200"/><text x="50%" y="50%" fill="#737373" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="40">&#x1F4E6;</text></svg>'
		);

	let items = $state<InventoryItem[]>([]);
	let filterCategory = $state<ItemCategory | 'all'>('all');
	/** '__all__' | '__general__' | exact room string from inventory */
	let filterRoom = $state<string>('__all__');
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
	let donate = $state(false);
	let important = $state(false);
	let notes = $state('');
	let roomPreset = $state<RoomPresetId>('general');
	let roomCustom = $state('');
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

	let replacePhotoInput = $state<HTMLInputElement | null>(null);
	let replacePhotoLoading = $state(false);
	let generate3dLoading = $state(false);
	let generate3dStatus = $state<string | null>(null);
	let generate3dProgress = $state<number | null>(null);
	let generate3dError = $state<string | null>(null);
	let generate3dSource = $state<'lidar' | 'ai' | null>(null);
	let modelUrl = $state<string | null>(null);

	/** Lines for new box/bin items before the item exists in the store */
	let draftContents = $state<import('$lib/types').ContentItem[]>([]);

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

	const filterCategorySummary = $derived(
		filters.find((f) => f.value === filterCategory)?.label ?? 'All'
	);

	const filterRoomSummary = $derived(
		filterRoom === '__all__'
			? 'All rooms'
			: filterRoom === '__general__'
				? 'General'
				: filterRoom
	);

	const roomsInUse = $derived.by(() => {
		const set = new Set<string>();
		for (const it of items) {
			if (!isGeneralRoom(it.room)) set.add(it.room!.trim());
		}
		return [...set].sort((a, b) => a.localeCompare(b));
	});

	const filtered = $derived.by(() => {
		let list =
			filterCategory === 'all'
				? items
				: items.filter((it) => it.category === filterCategory);
		if (filterRoom === '__general__') {
			list = list.filter((it) => isGeneralRoom(it.room));
		} else if (filterRoom !== '__all__') {
			list = list.filter((it) => (it.room ?? '').trim() === filterRoom);
		}
		return list;
	});

	const totalVolume = $derived(
		items.reduce((sum, it) => sum + volumeCuFt(it.dimensions.l, it.dimensions.w, it.dimensions.h), 0)
	);

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
		donate = false;
		important = false;
		roomPreset = 'general';
		roomCustom = '';
		notes = '';
		photoUrl = null;
		showDeleteConfirm = false;
		draftContents = [];
		modelUrl = null;
		generate3dError = null;
	}

	function draftContentAdd(text: string) {
		draftContents = [...draftContents, { text, important: false }];
	}

	function draftContentRemove(index: number) {
		draftContents = draftContents.filter((_, i) => i !== index);
	}

	function draftContentToggleImportant(index: number) {
		draftContents = draftContents.map((c, i) =>
			i === index ? { ...c, important: !c.important } : c
		);
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
		donate = item.donate ?? false;
		important = item.important ?? false;
		const r = splitStoredRoom(item.room);
		roomPreset = r.preset;
		roomCustom = r.custom;
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
			donate,
			important,
			room: roomFromPresetAndCustom(roomPreset, roomCustom),
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
			donate,
			important,
			room: roomFromPresetAndCustom(roomPreset, roomCustom),
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

	function handleDuplicate() {
		if (!editingId) return;
		const newId = inventory.duplicate(editingId);
		if (!newId) return;
		// Open the copy in edit mode so the user can immediately rename/change it
		switchToView(newId);
		startEditing();
	}

	function openPhotoCapture() {
		sidebarMode = 'photo';
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
		photoUrl = dataUrl;
		sidebarMode = editingId ? 'edit' : 'add';
	}

	function cancelPhoto() {
		sidebarMode = editingId ? 'edit' : 'add';
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
		<BottomSheet bind:value={sheetState} peekHeight={SHEET_PEEK_H}>
		<div class="sidebar-header" class:sidebar-header-home={sidebarMode === 'home'}>
			{#if sidebarMode === 'home'}
				<h1 class="sidebar-title">Filters</h1>
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
				<div class="sidebar-filters-wrap">
					<p class="sidebar-filters-summary">{filterCategorySummary} · {filterRoomSummary}</p>
					<div
						class="filters-panel filters-panel-sidebar"
						role="region"
						aria-label="Filter items by category and room"
					>
						<p class="filters-section-title">Category</p>
						<div class="filter-row">
							{#each filters as f}
								<button
									type="button"
									class="filter-pill"
									class:active={filterCategory === f.value}
									onclick={() => (filterCategory = f.value)}
								>
									{f.label}
								</button>
							{/each}
						</div>

						<p class="filters-section-title filters-section-title-room">Room</p>
						<div class="filter-row filter-row-room-inner">
							<button
								type="button"
								class="filter-pill"
								class:active={filterRoom === '__all__'}
								onclick={() => (filterRoom = '__all__')}
							>
								All
							</button>
							<button
								type="button"
								class="filter-pill"
								class:active={filterRoom === '__general__'}
								onclick={() => (filterRoom = '__general__')}
							>
								General
							</button>
							{#each roomsInUse as roomName}
								<button
									type="button"
									class="filter-pill"
									class:active={filterRoom === roomName}
									onclick={() => (filterRoom = roomName)}
								>
									{roomName}
								</button>
							{/each}
						</div>
					</div>
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
							<span class="view-label">Room</span>
							<span class="view-value">{roomDisplayLabel(item.room)}</span>
						</div>
						<div class="view-row">
							<span class="view-label">Category</span>
							<span class="view-value">{catIcon(item.category)} {catLabel(item.category)}</span>
						</div>
						<div class="view-row">
							<span class="view-label">Shape</span>
							<span class="view-value">{shapeIcon(item.shape)} {shapeLabel(item.shape)}</span>
						</div>
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
					</div>

					<div class="view-badges">
						{#if item.important}
							<button class="badge badge-important" onclick={() => inventory.update(item.id, { important: false })} title="Unmark important">⭐ Important</button>
						{:else}
							<button class="badge badge-mark-important" onclick={() => inventory.update(item.id, { important: true })} title="Mark as important">☆ Mark important</button>
						{/if}
						{#if item.forSale}
							<span class="badge badge-sale">💲 For Sale</span>
						{/if}
						{#if item.donate}
							<span class="badge badge-donate">📦 Donate</span>
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
									<li class:content-important-li={c.important}>{#if c.important}⭐ {/if}{c.text}</li>
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

				<div class="view-actions">
					<button class="view-action-btn" onclick={handleDuplicate}>
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
							<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
						</svg>
						Duplicate &amp; Edit
					</button>
				</div>
			</div>
			{:else if sidebarMode === 'photo'}
					<div class="photo-capture-area">
						<CameraCapture onCapture={handleCapture} />
					</div>
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

					<RoomPicker bind:preset={roomPreset} bind:custom={roomCustom} fieldId="sidebar-room" />

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
						<label class="field-label" for="item-shape">3D Shape</label>
						<select id="item-shape" class="shape-select" bind:value={shape}>
							{#each SHAPE_OPTIONS as s}
								<option value={s.value}>{s.icon} {s.label}</option>
							{/each}
						</select>
					</div>

					<ItemFlagsDropdown
						bind:forSale
						bind:fragile
						bind:stackable
						bind:donate
						bind:important
						fieldId="sidebar-item-flags"
					/>

					{#if sidebarMode === 'add' && (category === 'box' || shape === 'bin')}
						<ContentsEditor
							draft={true}
							contents={draftContents}
							onDraftAdd={draftContentAdd}
							onDraftRemove={draftContentRemove}
							onDraftToggleImportant={draftContentToggleImportant}
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
			</header>

			{#if filtered.length === 0}
				<div class="empty-state">
					{#if items.length === 0}
						<div class="empty-icon">📦</div>
						<h3>No items yet</h3>
						<p>Fill out the form to add your first item</p>
					{:else}
						<p>No items match these filters</p>
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
		padding: 14px 20px;
		border-bottom: none;
		flex-shrink: 0;
	}

	.sidebar-header-home {
		padding: 22px 20px;
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

	/* On mobile: sidebar-scroll IS the scroll container (sheet-body is overflow:hidden) */
	.sidebar-scroll {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
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
		padding: 0 20px calc(80px + var(--safe-area-bottom));
	}

	/* View panel (read-only) */
	.view-panel {
		padding: 22px 20px;
		display: flex;
		flex-direction: column;
		gap: 22px;
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
		border: none;
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
		border: none;
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
		border: none;
		border-radius: var(--radius-sm);
		overflow: hidden;
	}

	.view-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 14px;
		gap: 12px;
	}

	.view-row + .view-row {
		border-top: 1px solid var(--color-divider);
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
		gap: 10px;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
		padding-bottom: 2px;
	}

	.view-badges::-webkit-scrollbar { display: none; }

	.badge {
		font-size: 12px;
		font-weight: 600;
		padding: 4px 10px;
		border-radius: 100px;
		white-space: nowrap;
		flex-shrink: 0;
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
		background: rgba(255, 255, 255, 0.08);
		color: #d4d4d4;
	}

	.badge-donate {
		background: rgba(255, 255, 255, 0.06);
		color: #a3a3a3;
	}

	.badge-important {
		background: rgba(250, 204, 21, 0.15);
		color: #eab308;
		cursor: pointer;
		border: none;
		font: inherit;
	}

	.badge-mark-important {
		background: rgba(255, 255, 255, 0.04);
		color: var(--color-text-muted);
		cursor: pointer;
		border: none;
		font: inherit;
		opacity: 0.6;
		transition: opacity 0.15s;
	}

	.badge-mark-important:hover {
		opacity: 1;
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

	.view-contents li.content-important-li {
		background: rgba(250, 204, 21, 0.06);
		font-weight: 500;
	}

	.view-notes {
		font-size: 13px;
		color: var(--color-text-secondary);
		line-height: 1.5;
		margin: 0;
	}

	.view-actions {
		margin-top: 4px;
		padding-top: 12px;
		border-top: 1px solid var(--color-divider);
	}

	.view-action-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 11px 16px;
		border-radius: var(--radius-md);
		border: none;
		font-size: 14px;
		font-weight: 500;
		color: var(--color-text-secondary);
		background: transparent;
		transition: background 0.15s, color 0.15s;
	}

	.view-action-btn:active {
		background: var(--color-accent-soft);
		color: var(--color-text);
	}

	/* Photo section */
	.sidebar-photo {
		padding: 16px 20px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
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
		border: none;
		border-radius: var(--radius-sm);
		color: var(--color-text-secondary);
	}

	.photo-btn.danger {
		color: var(--color-danger);
		background: var(--color-danger-soft);
	}

	.add-photo-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 20px;
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-secondary);
		border: none;
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
		border: none;
		border-radius: var(--radius-md);
		transition: all 0.15s;
	}

	.generate-3d-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.generate-3d-btn:not(:disabled):active {
		background: var(--color-bg-card);
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
		border: none;
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
		background: #3a3a3a;
		color: #e5e5e5;
		padding: 1px 5px;
		border-radius: 100px;
		flex-shrink: 0;
	}

	.ai-badge {
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: #4a4a4a;
		color: #f5f5f5;
		padding: 1px 5px;
		border-radius: 100px;
		flex-shrink: 0;
	}

	.gen-spinner {
		display: inline-block;
		width: 14px;
		height: 14px;
		border: 2px solid rgba(255, 255, 255, 0.12);
		border-top-color: var(--color-text-primary);
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
		padding: 20px 20px;
		display: flex;
		flex-direction: column;
		gap: 24px;
		padding-bottom: calc(88px + var(--safe-area-bottom));
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 10px;
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
		gap: 6px;
		margin-top: 8px;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
		padding-bottom: 2px;
	}

	.box-presets::-webkit-scrollbar { display: none; }

	.box-preset-btn {
		font-size: 10px;
		font-weight: 500;
		line-height: 1.3;
		white-space: nowrap;
		text-align: center;
		padding: 6px 10px;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--color-text-secondary);
		background: var(--color-bg-card);
		transition: all 0.15s;
		flex-shrink: 0;
	}

	.box-preset-btn.active,
	.box-preset-btn:active {
		background: var(--color-bg-elevated);
		color: var(--color-text-primary);
	}

	.cat-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}

	.cat-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 10px 8px;
		border: none;
		border-radius: var(--radius-md);
		background: var(--color-bg-card);
		transition: all 0.15s;
	}

	.cat-btn.active {
		background: var(--color-bg-elevated);
		box-shadow: inset 0 0 0 1px var(--color-border-subtle);
	}

	.cat-icon { font-size: 18px; }
	.cat-label { font-size: 11px; font-weight: 500; }

	.shape-select {
		width: 100%;
		cursor: pointer;
		appearance: auto;
		color-scheme: dark;
	}

	textarea {
		resize: vertical;
		min-height: 50px;
	}

	/* Danger zone */
	.danger-zone {
		padding-top: 12px;
		border-top: 1px solid var(--color-divider);
	}

	.delete-btn {
		width: 100%;
		padding: 12px;
		color: var(--color-danger);
		font-size: 14px;
		font-weight: 600;
		border: none;
		border-radius: var(--radius-md);
		background: var(--color-danger-soft);
	}

	.delete-btn:active {
		background: rgba(239, 68, 68, 0.2);
	}

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

	.cancel-delete { border: none; }
	.confirm-delete { background: var(--color-danger); color: white; }

	.sidebar-filters-wrap {
		padding: 8px 20px 104px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.sidebar-filters-summary {
		font-size: 14px;
		font-weight: 500;
		color: var(--color-text-muted);
		line-height: 1.4;
		margin: 0;
	}

	.add-item-float {
		position: fixed;
		z-index: 210; /* above the sheet */
		left: 20px;
		right: 20px;
		/* Float 12px above the top edge of the peek mini-card */
		bottom: calc(var(--safe-area-bottom, 0px) + 8px + 72px + 12px);
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
		padding: 22px 0 18px;
	}

	.header-top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 0;
	}

	h1 {
		font-size: 28px;
		font-weight: 700;
		letter-spacing: var(--letter-tight);
		line-height: 1.15;
		color: var(--color-text-primary);
	}

	.header-stats {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0;
	}

	.stat {
		font-size: 13px;
		color: var(--color-text-muted);
		font-weight: 500;
		letter-spacing: 0.01em;
	}

	.stat-dot { color: var(--color-text-muted); }

	.filters-panel {
		display: flex;
		flex-direction: column;
		gap: 0;
		margin-top: 10px;
		padding: 16px 14px 18px;
		background: var(--color-bg-card);
		border: none;
		border-radius: var(--radius-lg);
	}

	.filters-panel-sidebar {
		margin-top: 0;
	}

	.filters-section-title {
		margin: 0 0 8px;
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.filters-section-title-room {
		margin-top: 16px;
		margin-bottom: 8px;
	}

	.filter-row {
		display: flex;
		gap: 10px;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
		padding: 0 0 4px;
	}

	.filter-row::-webkit-scrollbar { display: none; }

	.filter-row-room-inner {
		align-items: center;
		padding-bottom: 0;
	}

	.filter-pill {
		white-space: nowrap;
		padding: 9px 16px;
		font-size: 13px;
		font-weight: 500;
		border-radius: var(--radius-pill);
		border: none;
		background: var(--color-bg-elevated);
		color: var(--color-text-secondary);
		transition: background 0.2s ease, color 0.2s ease;
		flex-shrink: 0;
	}

	.filter-pill.active {
		background: var(--color-accent);
		color: var(--color-accent-fg);
		font-weight: 600;
	}

	.item-list {
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin-top: 12px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 72px 28px;
		text-align: center;
	}

	.empty-icon { font-size: 48px; margin-bottom: 4px; }
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
			width: var(--sidebar-width);
			flex-shrink: 0;
			border-right: 1px solid var(--color-divider);
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
			left: 20px;
			right: auto;
			width: calc(var(--sidebar-width) - 40px);
			/* On desktop sit above the tab bar as before */
			bottom: calc(var(--tab-bar-height) + var(--safe-area-bottom) + 10px);
		}

		.inv-scroll {
			padding-left: 24px;
			padding-right: 28px;
		}
	}
</style>
