# Mover

A mobile-first web app for managing moving inventory and planning trailer packing.

## Features

- **Camera Capture** -- Photograph items using your iPhone's native camera
- **Dimension Estimation** -- Calibrate with a credit card reference to measure item dimensions from photos
- **Inventory Management** -- Persistent item list with photos, dimensions, categories, and box contents
- **3D Pack Planner** -- Bin-packing algorithm with interactive Three.js trailer visualization and load-order stepping

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` on your phone (or use `--host` to access from your local network).

### Install as PWA

On iPhone Safari, tap **Share > Add to Home Screen** for a fullscreen app experience.

## Tech Stack

- **SvelteKit** with static adapter
- **Threlte** (Svelte + Three.js) for 3D visualization
- **localStorage** for offline-first persistence
- **PWA** with service worker for installability

## Build

```bash
npm run build
npm run preview
```

The `build/` directory contains the static site ready for deployment.
