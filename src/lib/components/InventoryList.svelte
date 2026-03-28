<script lang="ts">
	import type { InventoryItem, ItemCategory, ItemShape, Dimensions } from '$lib/types';
	import { inventory } from '$lib/stores/inventory';
	import { moveDate } from '$lib/stores/app';
	import { volumeCuFt } from '$lib/utils/measurement';
	import { SHAPE_OPTIONS, CATEGORY_DEFAULT_SHAPE } from '$lib/utils/shapes';
	import ItemCard from './ItemCard.svelte';
	import ContentsEditor from './ContentsEditor.svelte';
	import CameraCapture from './CameraCapture.svelte';
	import MeasurementCanvas from './MeasurementCanvas.svelte';

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
	let notes = $state('');
	let photoUrl = $state<string | null>(null);
	let showDeleteConfirm = $state(false);

	let photoStep = $state<'capture' | 'measure'>('capture');
	let rawPhoto = $state<string | null>(null);

	inventory.subscribe((v) => items = v);

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
		{ value: 'box', label: '📦 Boxes' },
		{ value: 'furniture', label: '🪑 Furniture' },
		{ value: 'appliance', label: '🔌 Appliances' },
		{ value: 'fragile', label: '⚠️ Fragile' },
		{ value: 'oddShape', label: '🔷 Odd' },
		{ value: 'other', label: '📋 Other' }
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
		notes = '';
		photoUrl = null;
		showDeleteConfirm = false;
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
		notes = item.notes ?? '';
		photoUrl = item.photo || null;
		showDeleteConfirm = false;
	}

	function setCategory(cat: ItemCategory) {
		category = cat;
		shape = CATEGORY_DEFAULT_SHAPE[cat] ?? 'generic';
	}

	function handleAdd() {
		if (!name.trim()) return;
		const placeholder = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%231e293b" width="200" height="200"/><text x="50%" y="50%" fill="%2364748b" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="40">📦</text></svg>');
		inventory.add({
			name: name.trim(),
			photo: photoUrl || placeholder,
			dimensions: { l, w, h },
			weight: weight || undefined,
			category,
			shape,
			fragile,
			stackable,
			contents: [],
			notes: notes || undefined
		});
		switchToHome();
	}

	function handleSave() {
		if (!editingId) return;
		inventory.update(editingId, {
			name,
			dimensions: { l, w, h },
			weight: weight || undefined,
			category,
			shape,
			fragile,
			stackable,
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

<div class="inv-page">
	<!-- Left sidebar -->
	<div class="left-panel">
		<div class="sidebar-header">
			{#if sidebarMode === 'home'}
				<h2>Overview</h2>
				<div style="width: 50px"></div>
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
							<span class="home-stat-label">{totalWeight > 0 ? 'lbs' : 'Weight'}</span>
						</div>
						<div class="home-stat">
							<span class="home-stat-val">{totalVolume > 0 ? Math.round(totalVolume * 10) / 10 : '—'}</span>
							<span class="home-stat-label">cu ft</span>
						</div>
					</div>

					<div class="home-date">
						<span class="home-date-label">Move Date</span>
						<input
							type="date"
							class="home-date-input"
							value={moveDateVal ?? ''}
							oninput={(e) => moveDate.set(e.currentTarget.value || null)}
						/>
						{#if daysUntilMove !== null}
							<span class="home-date-countdown" class:urgent={daysUntilMove <= 7}>
								{daysUntilMove} {daysUntilMove === 1 ? 'day' : 'days'} away
							</span>
						{/if}
					</div>

					<button class="home-add-btn" onclick={switchToAdd}>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
							<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
						</svg>
						Add Item
					</button>
				</div>
			{:else if sidebarMode === 'view' && editingItem}
				{@const item = editingItem}
				<div class="view-panel">
					{#if item.photo && !item.photo.includes('data:image/svg+xml')}
						<div class="view-photo">
							<img src={item.photo} alt={item.name} />
						</div>
					{/if}

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
							<button class="photo-btn" onclick={openPhotoCapture}>Replace</button>
							<button class="photo-btn danger" onclick={() => photoUrl = null}>Remove</button>
						</div>
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
						<span class="field-label">3D Shape</span>
						<div class="shape-grid">
							{#each SHAPE_OPTIONS as s}
								<button
									class="shape-btn"
									class:active={shape === s.value}
									onclick={() => shape = s.value}
								>
									<span class="shape-icon">{s.icon}</span>
									<span class="shape-label">{s.label}</span>
								</button>
							{/each}
						</div>
					</div>

					<div class="toggles">
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
</div>

<style>
	/* ---- Mobile-first (stacked) ---- */
	.inv-page {
		height: 100%;
		display: flex;
		flex-direction: column;
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

	.sidebar-scroll {
		display: none;
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
		padding: 0 16px 24px;
	}

	/* View panel (read-only) */
	.view-panel {
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
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

	.shape-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 4px;
	}

	.shape-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 6px 4px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		transition: all 0.15s;
	}

	.shape-btn.active {
		border-color: #525252;
		background: var(--color-bg-elevated);
	}

	.shape-btn .shape-icon { font-size: 16px; }
	.shape-btn .shape-label { font-size: 9px; font-weight: 500; color: var(--color-text-secondary); }

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
		padding: 20px 16px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.home-stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
	}

	.home-stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 16px 8px;
		background: var(--color-bg-card);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}

	.home-stat-val {
		font-size: 28px;
		font-weight: 700;
		line-height: 1;
	}

	.home-stat-label {
		font-size: 12px;
		font-weight: 500;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.home-date {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.home-date-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.home-date-input {
		font-size: 14px;
		font-weight: 500;
		color: var(--color-text);
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: 10px 12px;
		color-scheme: dark;
		width: 100%;
	}

	.home-date-countdown {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-text-secondary);
	}

	.home-date-countdown.urgent {
		color: var(--color-warning);
	}

	.home-add-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 14px;
		background: var(--color-accent);
		color: var(--color-accent-fg);
		font-size: 16px;
		font-weight: 600;
		border-radius: var(--radius-md);
		transition: background 0.15s;
	}

	.home-add-btn:active {
		background: var(--color-accent-hover);
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

		.sidebar-scroll {
			display: flex;
			flex-direction: column;
			flex: 1;
			overflow-y: auto;
			-webkit-overflow-scrolling: touch;
		}

		.right-panel {
			flex: 1;
			min-width: 0;
		}
	}
</style>
