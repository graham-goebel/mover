import * as THREE from 'three';
import type { ItemShape } from '$lib/types';

/**
 * Procedural 3D shape builders for common household items.
 * Each returns a THREE.Group sized to fit within a unit cube (1×1×1).
 * The caller scales to actual item dimensions.
 */

const MAT_OPTS = { roughness: 0.5, metalness: 0.05 } as const;

function mat(color: string, opacity: number) {
	return new THREE.MeshStandardMaterial({
		color,
		transparent: opacity < 1,
		opacity,
		...MAT_OPTS
	});
}

function boxMesh(
	w: number,
	h: number,
	d: number,
	material: THREE.Material,
	pos?: [number, number, number]
) {
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
	if (pos) mesh.position.set(...pos);
	return mesh;
}

function roundedBox(
	w: number,
	h: number,
	d: number,
	r: number,
	material: THREE.Material,
	pos?: [number, number, number]
) {
	const shape = new THREE.Shape();
	const hw = w / 2,
		hh = h / 2;
	shape.moveTo(-hw + r, -hh);
	shape.lineTo(hw - r, -hh);
	shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
	shape.lineTo(hw, hh - r);
	shape.quadraticCurveTo(hw, hh, hw - r, hh);
	shape.lineTo(-hw + r, hh);
	shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
	shape.lineTo(-hw, -hh + r);
	shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

	const geo = new THREE.ExtrudeGeometry(shape, {
		depth: d,
		bevelEnabled: false
	});
	geo.translate(0, 0, -d / 2);
	geo.rotateX(Math.PI / 2);
	const mesh = new THREE.Mesh(geo, material);
	if (pos) mesh.position.set(...pos);
	return mesh;
}

function buildBox(color: string): THREE.Group {
	const g = new THREE.Group();
	const body = mat(color, 0.85);
	g.add(boxMesh(1, 1, 1, body));
	const tape = mat('#888888', 0.6);
	g.add(boxMesh(0.12, 1.01, 0.01, tape, [0, 0, 0.505]));
	g.add(boxMesh(0.12, 1.01, 0.01, tape, [0, 0, -0.505]));
	g.add(boxMesh(1.01, 0.01, 0.12, tape, [0, 0.505, 0]));
	return g;
}

function buildBin(color: string): THREE.Group {
	const g = new THREE.Group();
	const wall = mat(color, 0.8);
	const thick = 0.05;
	g.add(boxMesh(1, thick, 1, wall, [0, -0.5 + thick / 2, 0]));
	g.add(boxMesh(thick, 1, 1, wall, [-0.5 + thick / 2, 0, 0]));
	g.add(boxMesh(thick, 1, 1, wall, [0.5 - thick / 2, 0, 0]));
	g.add(boxMesh(1, 1, thick, wall, [0, 0, -0.5 + thick / 2]));
	g.add(boxMesh(1, 1, thick, wall, [0, 0, 0.5 - thick / 2]));
	const lip = mat(color, 0.9);
	g.add(boxMesh(1.04, 0.06, 1.04, lip, [0, 0.5, 0]));
	return g;
}

function buildBag(color: string): THREE.Group {
	const g = new THREE.Group();
	const geo = new THREE.SphereGeometry(0.5, 12, 10);
	geo.scale(1, 0.75, 0.85);
	const m = mat(color, 0.8);
	const mesh = new THREE.Mesh(geo, m);
	mesh.position.y = -0.12;
	g.add(mesh);
	const tie = mat('#666666', 0.9);
	g.add(boxMesh(0.06, 0.18, 0.06, tie, [0, 0.32, 0]));
	return g;
}

function buildCouch(color: string): THREE.Group {
	const g = new THREE.Group();
	const body = mat(color, 0.85);
	const dark = mat(new THREE.Color(color).multiplyScalar(0.7).getHexString(), 0.85);

	const seatH = 0.35,
		backH = 0.35,
		armW = 0.12,
		armH = 0.2;
	g.add(roundedBox(1, seatH, 0.9, 0.04, body, [0, -0.5 + seatH / 2, 0.05]));
	g.add(
		roundedBox(1, backH, 0.18, 0.04, dark, [0, -0.5 + seatH + backH / 2, -0.41])
	);
	g.add(
		roundedBox(armW, armH, 0.75, 0.03, dark, [-0.5 + armW / 2, -0.5 + seatH + armH / 2, 0.05])
	);
	g.add(
		roundedBox(armW, armH, 0.75, 0.03, dark, [0.5 - armW / 2, -0.5 + seatH + armH / 2, 0.05])
	);
	const legM = mat('#333333', 0.9);
	const legH = 0.08;
	for (const x of [-0.38, 0.38]) {
		for (const z of [-0.3, 0.35]) {
			const leg = new THREE.Mesh(
				new THREE.CylinderGeometry(0.025, 0.025, legH, 8),
				legM
			);
			leg.position.set(x, -0.5 + legH / 2 - 0.01, z);
			g.add(leg);
		}
	}
	g.position.y += 0.08;
	return g;
}

function buildChair(color: string): THREE.Group {
	const g = new THREE.Group();
	const body = mat(color, 0.85);

	const seatH = 0.08;
	g.add(roundedBox(0.7, seatH, 0.7, 0.03, body, [0, 0, 0.05]));
	const backM = mat(new THREE.Color(color).multiplyScalar(0.75).getHexString(), 0.85);
	g.add(roundedBox(0.65, 0.5, 0.06, 0.03, backM, [0, 0.29, -0.32]));

	const legM = mat('#444444', 0.9);
	const legH = 0.44;
	for (const x of [-0.26, 0.26]) {
		for (const z of [-0.26, 0.26]) {
			const leg = new THREE.Mesh(
				new THREE.CylinderGeometry(0.025, 0.02, legH, 8),
				legM
			);
			leg.position.set(x, -legH / 2 - seatH / 2 + 0.02, z + 0.05);
			g.add(leg);
		}
	}
	return g;
}

function buildTable(color: string): THREE.Group {
	const g = new THREE.Group();
	const top = mat(color, 0.85);
	g.add(roundedBox(1, 0.06, 0.8, 0.02, top, [0, 0.47, 0]));

	const legM = mat(new THREE.Color(color).multiplyScalar(0.6).getHexString(), 0.9);
	const legH = 0.88;
	for (const x of [-0.42, 0.42]) {
		for (const z of [-0.32, 0.32]) {
			const leg = new THREE.Mesh(
				new THREE.CylinderGeometry(0.03, 0.025, legH, 8),
				legM
			);
			leg.position.set(x, 0, z);
			g.add(leg);
		}
	}
	return g;
}

function buildDresser(color: string): THREE.Group {
	const g = new THREE.Group();
	const body = mat(color, 0.85);
	g.add(roundedBox(1, 1, 0.7, 0.03, body));

	const drawerM = mat(
		new THREE.Color(color).multiplyScalar(0.85).getHexString(),
		0.9
	);
	const rows = 4;
	const gap = 0.04;
	const drawerH = (1 - gap * (rows + 1)) / rows;
	for (let i = 0; i < rows; i++) {
		const y = -0.5 + gap + drawerH / 2 + i * (drawerH + gap);
		g.add(boxMesh(0.88, drawerH, 0.02, drawerM, [0, y, 0.35]));
		const knob = mat('#666666', 0.9);
		g.add(
			new THREE.Mesh(
				new THREE.SphereGeometry(0.02, 8, 8),
				knob
			)
		).position.set(0, y, 0.37);
	}

	const legM = mat('#333333', 0.9);
	for (const x of [-0.4, 0.4]) {
		for (const z of [-0.28, 0.28]) {
			const leg = new THREE.Mesh(
				new THREE.CylinderGeometry(0.025, 0.025, 0.08, 8),
				legM
			);
			leg.position.set(x, -0.54, z);
			g.add(leg);
		}
	}
	return g;
}

function buildMattress(color: string): THREE.Group {
	const g = new THREE.Group();
	const body = mat(color, 0.85);
	g.add(roundedBox(1, 0.3, 0.85, 0.06, body));

	const piping = mat('#999999', 0.5);
	g.add(boxMesh(1.01, 0.01, 0.86, piping, [0, 0.15, 0]));
	g.add(boxMesh(1.01, 0.01, 0.86, piping, [0, -0.05, 0]));
	return g;
}

function buildTV(color: string): THREE.Group {
	const g = new THREE.Group();
	const bezel = mat('#1a1a1a', 0.95);
	g.add(roundedBox(1, 0.62, 0.04, 0.02, bezel, [0, 0.1, 0]));

	const screen = mat('#222233', 0.9);
	g.add(boxMesh(0.92, 0.54, 0.01, screen, [0, 0.1, 0.025]));

	const standM = mat('#333333', 0.9);
	g.add(boxMesh(0.08, 0.18, 0.06, standM, [0, -0.3, 0]));
	g.add(roundedBox(0.5, 0.03, 0.25, 0.04, standM, [0, -0.39, 0]));
	return g;
}

function buildLamp(color: string): THREE.Group {
	const g = new THREE.Group();
	const baseM = mat('#444444', 0.9);
	const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.06, 16), baseM);
	base.position.y = -0.47;
	g.add(base);

	const pole = new THREE.Mesh(
		new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8),
		baseM
	);
	pole.position.y = -0.1;
	g.add(pole);

	const shade = mat(color, 0.7);
	const shadeGeo = new THREE.CylinderGeometry(0.15, 0.3, 0.3, 16, 1, true);
	const shadeMesh = new THREE.Mesh(shadeGeo, shade);
	shadeMesh.position.y = 0.35;
	g.add(shadeMesh);

	return g;
}

function buildApplianceTall(color: string): THREE.Group {
	const g = new THREE.Group();
	const body = mat(color, 0.85);
	g.add(roundedBox(0.85, 1, 0.85, 0.03, body));

	const handle = mat('#666666', 0.9);
	g.add(boxMesh(0.03, 0.4, 0.04, handle, [0.38, 0.15, 0.44]));

	const detail = mat(new THREE.Color(color).multiplyScalar(0.9).getHexString(), 0.9);
	g.add(boxMesh(0.78, 0.01, 0.8, detail, [0, 0.15, 0]));
	return g;
}

function buildApplianceWide(color: string): THREE.Group {
	const g = new THREE.Group();
	const body = mat(color, 0.85);
	g.add(roundedBox(1, 0.65, 0.85, 0.03, body));

	const door = mat(new THREE.Color(color).multiplyScalar(0.92).getHexString(), 0.9);
	g.add(boxMesh(0.44, 0.5, 0.01, door, [-0.23, 0.02, 0.43]));
	g.add(boxMesh(0.44, 0.5, 0.01, door, [0.23, 0.02, 0.43]));

	const handle = mat('#666666', 0.9);
	g.add(boxMesh(0.03, 0.2, 0.03, handle, [-0.02, 0.05, 0.45]));
	g.add(boxMesh(0.03, 0.2, 0.03, handle, [0.02, 0.05, 0.45]));
	return g;
}

function buildGeneric(color: string): THREE.Group {
	const g = new THREE.Group();
	g.add(boxMesh(1, 1, 1, mat(color, 0.85)));
	return g;
}

const BUILDERS: Record<ItemShape, (color: string) => THREE.Group> = {
	box: buildBox,
	bin: buildBin,
	bag: buildBag,
	couch: buildCouch,
	chair: buildChair,
	table: buildTable,
	dresser: buildDresser,
	mattress: buildMattress,
	tv: buildTV,
	lamp: buildLamp,
	'appliance-tall': buildApplianceTall,
	'appliance-wide': buildApplianceWide,
	generic: buildGeneric
};

export function createItemMesh(
	shape: ItemShape,
	color: string,
	scaleX: number,
	scaleY: number,
	scaleZ: number
): THREE.Group {
	const builder = BUILDERS[shape] ?? BUILDERS.generic;
	const group = builder(color);

	const box = new THREE.Box3().setFromObject(group);
	const offsetY = -(box.min.y + 0.5);
	if (Math.abs(offsetY) > 0.001) {
		group.children.forEach((child) => {
			child.position.y += offsetY;
		});
	}

	group.scale.set(scaleX, scaleY, scaleZ);
	return group;
}

export const SHAPE_OPTIONS: { value: ItemShape; label: string; icon: string }[] = [
	{ value: 'box', label: 'Box', icon: '📦' },
	{ value: 'bin', label: 'Bin', icon: '🗑️' },
	{ value: 'bag', label: 'Bag', icon: '🎒' },
	{ value: 'couch', label: 'Couch', icon: '🛋️' },
	{ value: 'chair', label: 'Chair', icon: '🪑' },
	{ value: 'table', label: 'Table', icon: '🪵' },
	{ value: 'dresser', label: 'Dresser', icon: '🗄️' },
	{ value: 'mattress', label: 'Mattress', icon: '🛏️' },
	{ value: 'tv', label: 'TV', icon: '📺' },
	{ value: 'lamp', label: 'Lamp', icon: '💡' },
	{ value: 'appliance-tall', label: 'Fridge', icon: '🧊' },
	{ value: 'appliance-wide', label: 'Washer', icon: '🫧' },
	{ value: 'generic', label: 'Other', icon: '📐' }
];

export const CATEGORY_DEFAULT_SHAPE: Record<string, ItemShape> = {
	box: 'box',
	furniture: 'couch',
	appliance: 'appliance-tall',
	fragile: 'box',
	oddShape: 'generic',
	other: 'generic'
};
