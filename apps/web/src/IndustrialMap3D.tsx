import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Shipment } from "./App";

type BuildingKind = "factory" | "warehouse";
type Selection =
  | { kind: "vehicle"; shipment: Shipment }
  | { kind: "building"; buildingKind: BuildingKind; name: string }
  | null;
type Interior = { kind: BuildingKind; name: string } | null;

const material = (color: number, metalness = 0.18, roughness = 0.72) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness });

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function mark(group: THREE.Object3D, data: Record<string, unknown>) {
  group.userData = data;
  group.traverse((child) => (child.userData.pickRoot = group));
}

function addFactory(scene: THREE.Scene, x: number, z: number, name: string, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  const steel = material(0x3b464c, 0.42), dark = material(0x171d21, 0.5), orange = material(0xd66b21, 0.36);
  const glass = new THREE.MeshStandardMaterial({ color: 0x7daebb, emissive: 0x183a43, emissiveIntensity: 1.25, roughness: 0.18 });
  group.add(box(23, 0.35, 18, material(0x45494a), 0, 0.16, 0));
  group.add(box(18, 4, 11, steel, 0, 2.2, 0));
  group.add(box(6, 6, 11, dark, -5, 5, 0));
  for (let i = -7; i <= 7; i += 3.5) group.add(box(2.2, 1.2, 0.14, glass, i, 2.2, -5.57));
  for (let i = -6; i <= 6; i += 4) {
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.92, 9, 18), dark);
    chimney.position.set(i, 8, 2); chimney.castShadow = true; group.add(chimney);
    group.add(box(1.55, 0.38, 1.55, orange, i, 12.5, 2));
  }
  const sign = box(7, 1.1, 0.18, orange, 3.5, 5.1, -5.72); group.add(sign);
  mark(group, { kind: "building", buildingKind: "factory", name });
  scene.add(group);
}

function addWarehouse(scene: THREE.Scene, x: number, z: number, name: string, rotation = 0) {
  const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = rotation;
  group.add(box(17, 4.2, 10, material(0x586369, 0.35), 0, 2.2, 0));
  for (let i = -6; i <= 6; i += 4) group.add(box(3, 2.8, 0.18, material(0x1d2428, 0.4), i, 1.55, -5.1));
  group.add(box(17.6, 0.42, 10.6, material(0xc86120, 0.3), 0, 4.38, 0));
  group.add(box(6.5, 1, 0.2, material(0xd77a28), 3.5, 5.1, -5.22));
  mark(group, { kind: "building", buildingKind: "warehouse", name });
  scene.add(group);
}

function addRoad(scene: THREE.Scene, a: THREE.Vector3, b: THREE.Vector3) {
  const length = a.distanceTo(b), road = box(4.3, 0.12, length, material(0x24292b, 0.05, 0.9));
  road.position.copy(a).lerp(b, 0.5); road.lookAt(b); scene.add(road);
  const line = box(0.1, 0.14, length, new THREE.MeshBasicMaterial({ color: 0xe5b768 }), 0, 0.14, 0);
  line.position.copy(road.position); line.rotation.copy(road.rotation); scene.add(line);
}

function addTree(scene: THREE.Scene, x: number, z: number, size: number) {
  const group = new THREE.Group(); group.position.set(x, 0, z);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * size, 0.22 * size, 1.8 * size, 7), material(0x59452e));
  trunk.position.y = 0.9 * size; trunk.castShadow = true; group.add(trunk);
  for (let i = 0; i < 3; i++) {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry((1.05 - i * 0.12) * size, 1), material(i % 2 ? 0x315a34 : 0x254a2d, 0, 0.94));
    crown.position.set((i - 1) * 0.3 * size, (2.05 + i * 0.4) * size, (i % 2) * 0.18); crown.castShadow = true; group.add(crown);
  }
  scene.add(group);
}

function addTruck(scene: THREE.Scene, shipment: Shipment, index: number) {
  const group = new THREE.Group();
  const cab = material(index % 2 ? 0x46535b : 0xcf641c, 0.52, 0.34), trailer = material(0x626b6e, 0.35, 0.6);
  group.add(box(1.7, 1.7, 1.6, cab, 0, 1.2, -2.15));
  group.add(box(1.62, 0.85, 0.5, cab, 0, 0.82, -3.15));
  group.add(box(1.9, 1.75, 4.5, trailer, 0, 1.35, 0.75));
  group.add(box(1.45, 0.58, 0.05, new THREE.MeshStandardMaterial({ color: 0x8bb9c7, emissive: 0x16353e }), 0, 1.45, -2.98));
  for (const z of [-2.45, -0.45, 1.65, 2.15]) for (const x of [-0.95, 0.95]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.25, 18), material(0x0d1011, 0, 0.95));
    wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.46, z); wheel.castShadow = true; group.add(wheel);
  }
  group.scale.setScalar(0.72);
  mark(group, { kind: "vehicle", shipment }); scene.add(group); return group;
}

function addLandscape(scene: THREE.Scene) {
  const terrainGeo = new THREE.PlaneGeometry(150, 118, 30, 24);
  const pos = terrainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const edge = Math.max(0, (Math.abs(x) - 43) / 18, (Math.abs(y) - 34) / 17);
    pos.setZ(i, edge * edge * 8 + Math.sin(x * 0.12) * Math.cos(y * 0.13) * 0.28);
  }
  terrainGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(terrainGeo, material(0x304b31, 0, 0.96)); terrain.rotation.x = -Math.PI / 2; terrain.receiveShadow = true; scene.add(terrain);
  const pond = new THREE.Mesh(new THREE.CircleGeometry(10, 48), new THREE.MeshStandardMaterial({ color: 0x315d68, roughness: 0.2, metalness: 0.2, transparent: true, opacity: 0.88 }));
  pond.rotation.x = -Math.PI / 2; pond.scale.set(1.6, 0.7, 1); pond.position.set(45, 0.15, 27); scene.add(pond);
  const trees: Array<[number, number, number]> = [];
  for (let i = 0; i < 80; i++) {
    const angle = i * 2.399, radius = 43 + (i % 9) * 2.7;
    trees.push([Math.cos(angle) * radius, Math.sin(angle) * radius * 0.72, 0.65 + (i % 5) * 0.11]);
  }
  trees.forEach(([x, z, s]) => addTree(scene, x, z, s));
}

function addExterior(scene: THREE.Scene, active: Shipment[]) {
  addLandscape(scene);
  addFactory(scene, -19, -10, "Usine Métallurgique Nord", 1.12);
  addFactory(scene, 25, -22, "Complexe d’Assemblage Atlas", 0.78);
  addWarehouse(scene, 15, 18, "Entrepôt Logistique Central", 0.22);
  addWarehouse(scene, -29, 25, "Plateforme Fret Ouest", -0.18);
  const hubs = [new THREE.Vector3(-32, 0.17, 31), new THREE.Vector3(-19, 0.17, -10), new THREE.Vector3(15, 0.17, 18), new THREE.Vector3(29, 0.17, -23)];
  addRoad(scene, hubs[0], hubs[1]); addRoad(scene, hubs[1], hubs[2]); addRoad(scene, hubs[2], hubs[3]); addRoad(scene, hubs[1], hubs[3]);
  for (let i = 0; i < 28; i++) scene.add(box(3, 0.9, 1.2, material([0x91462d, 0x345e70, 0x6d713d, 0xb07132][i % 4]), 14 + (i % 7) * 3.15, 0.56 + Math.floor(i / 14), 25 + Math.floor(i / 7) * 1.35));
  return { hubs, trucks: active.map((shipment, i) => addTruck(scene, shipment, i)) };
}

function addInterior(scene: THREE.Scene, interior: NonNullable<Interior>) {
  scene.background = new THREE.Color(0x11171a); scene.fog = new THREE.Fog(0x11171a, 35, 90);
  scene.add(box(52, 0.35, 38, material(0x3b4040), 0, -0.1, 0));
  scene.add(box(52, 13, 0.5, material(0x30373a), 0, 6.5, 18.5));
  for (const x of [-25, 25]) scene.add(box(0.5, 13, 38, material(0x30373a), x, 6.5, 0));
  for (let x = -20; x <= 20; x += 10) {
    const lamp = box(5, 0.12, 0.45, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdcefff, emissiveIntensity: 5 }), x, 11, 0); scene.add(lamp);
    const light = new THREE.PointLight(0xddeeff, 16, 18); light.position.set(x, 10, 0); scene.add(light);
  }
  if (interior.kind === "warehouse") {
    for (const z of [-11, -4, 4, 11]) for (const x of [-17, -7, 7, 17]) {
      scene.add(box(5.5, 6.5, 2.2, material(0x3b454a, 0.55), x, 3.25, z));
      for (let y = 1; y <= 5; y += 2) scene.add(box(4.8, 1.15, 1.7, material((x + z + y) % 3 ? 0x9a673b : 0x375c6d), x, y, z));
    }
    const forklift = new THREE.Group(); forklift.add(box(2.4, 1.5, 3, material(0xe58a1d, 0.4), 0, 0.95, 0), box(0.16, 3.5, 0.16, material(0x171b1d), -0.75, 2.1, -1.4), box(0.16, 3.5, 0.16, material(0x171b1d), 0.75, 2.1, -1.4)); forklift.position.set(0, 0, 8); scene.add(forklift);
  } else {
    for (const z of [-8, 0, 8]) {
      scene.add(box(38, 0.8, 2.2, material(0x333b3e, 0.5), 0, 1.1, z));
      for (let x = -17; x <= 17; x += 5.5) {
        const machine = box(3.3, 2.8, 3.2, material((x + z) % 2 ? 0x375966 : 0x596166, 0.55), x, 2.5, z); scene.add(machine);
        scene.add(box(2.2, 0.38, 0.12, new THREE.MeshStandardMaterial({ color: 0x79b7c6, emissive: 0x1a6070, emissiveIntensity: 2 }), x, 2.7, z - 1.66));
      }
    }
    for (const x of [-21, 21]) { const pipe = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 10, 20), material(0x4a5255, 0.65)); pipe.position.set(x, 5, 13); scene.add(pipe); }
  }
}

export default function IndustrialMap3D({ shipments }: { shipments: Shipment[] }) {
  const mount = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [interior, setInterior] = useState<Interior>(null);
  const active = shipments.filter((s) => s.status === "ASSIGNED" || s.status === "IN_TRANSIT");
  const activeKey = active.map((s) => `${s.id}:${s.progressPercent}`).join("|");

  useEffect(() => {
    const host = mount.current; if (!host) return;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x91b4ca); scene.fog = new THREE.FogExp2(interior ? 0x11171a : 0x9bb5bf, interior ? 0.008 : 0.0065);
    const camera = new THREE.PerspectiveCamera(48, host.clientWidth / host.clientHeight, 0.1, 500);
    camera.position.set(interior ? 29 : 50, interior ? 16 : 43, interior ? 30 : 61);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(host.clientWidth, host.clientHeight); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12; renderer.outputColorSpace = THREE.SRGBColorSpace; host.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(interior ? 0xc9e5f0 : 0xc7e1ee, interior ? 0x131719 : 0x263421, interior ? 1.2 : 2.4));
    const sun = new THREE.DirectionalLight(0xffd3a3, interior ? 1.2 : 3.6); sun.position.set(-28, 48, 20); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -70; sun.shadow.camera.right = 70; sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70; scene.add(sun);
    const world = interior ? (addInterior(scene, interior), null) : addExterior(scene, active);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.06; controls.minDistance = interior ? 8 : 18; controls.maxDistance = interior ? 65 : 120; controls.maxPolarAngle = Math.PI * 0.49; controls.target.set(0, interior ? 2.5 : 0, 0);
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(); let downX = 0, downY = 0;
    const pointerDown = (event: PointerEvent) => { downX = event.clientX; downY = event.clientY; };
    const pointerUp = (event: PointerEvent) => {
      if (interior || Math.hypot(event.clientX - downX, event.clientY - downY) > 7) return;
      const rect = renderer.domElement.getBoundingClientRect(); pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(scene.children, true).find((entry) => entry.object.userData.pickRoot);
      const root = hit?.object.userData.pickRoot as THREE.Object3D | undefined;
      if (!root) { setSelection(null); return; }
      if (root.userData.kind === "vehicle") setSelection({ kind: "vehicle", shipment: root.userData.shipment as Shipment });
      if (root.userData.kind === "building") setSelection({ kind: "building", buildingKind: root.userData.buildingKind as BuildingKind, name: String(root.userData.name) });
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown); renderer.domElement.addEventListener("pointerup", pointerUp);
    const resize = () => { camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight); }; window.addEventListener("resize", resize);
    const clock = new THREE.Clock(); let frame = 0;
    const animate = () => { frame = requestAnimationFrame(animate); const t = clock.getElapsedTime(); if (world) world.trucks.forEach((truck, i) => { const p = ((active[i].progressPercent / 100) + t * 0.012 + i * 0.17) % 1, segment = Math.min(2, Math.floor(p * 3)), local = p * 3 - segment; truck.position.copy(world.hubs[segment]).lerp(world.hubs[segment + 1], local); truck.position.y = 0.2; truck.lookAt(world.hubs[segment + 1]); }); controls.update(); renderer.render(scene, camera); }; animate();
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); renderer.domElement.removeEventListener("pointerdown", pointerDown); renderer.domElement.removeEventListener("pointerup", pointerUp); controls.dispose(); renderer.dispose(); scene.traverse((object) => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach((item) => item.dispose()); } }); if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement); };
  }, [activeKey, interior]);

  const enterBuilding = () => { if (selection?.kind === "building") { setInterior({ kind: selection.buildingKind, name: selection.name }); setSelection(null); } };
  return <section>
    <div className="mapToolbar"><div><small>JUMEAU NUMÉRIQUE · TEMPS RÉEL</small><h2>{interior ? interior.name : "Monde industriel 3D"}</h2></div><div>{interior ? <button className="mapBack" onClick={() => setInterior(null)}>← Retour à la carte</button> : <><span className="legend orange"></span> Convoi actif <span className="legend white"></span> Site visitable</>}</div></div>
    <div className="map3d" ref={mount}>
      <div className="map3dHelp">{interior ? "VISITE INTÉRIEURE · ROTATION, ZOOM ET DÉPLACEMENT" : "CLIQUEZ UN VÉHICULE OU UN BÂTIMENT · GLISSEZ POUR EXPLORER"}</div>
      {!interior && !selection && <div className="mapPanel"><small>RÉSEAU LOGISTIQUE</small><strong>{active.length} convois actifs</strong><span>2 usines · 2 entrepôts visitables</span><span>{shipments.filter((s) => s.status === "OPEN").length} contrats disponibles</span></div>}
      {interior && <div className="interiorBadge"><small>VISITE EN COURS</small><strong>{interior.kind === "factory" ? "Lignes de production" : "Zone de stockage"}</strong><span>Explorez librement le bâtiment</span></div>}
      {selection?.kind === "vehicle" && <article className="inspectionCard"><button className="closeInspect" onClick={() => setSelection(null)}>×</button><img src="/assets/atlas-tx480-inspection.png" alt="Camion Atlas TX 480 dans un dépôt logistique"/><div className="inspectionBody"><small>INSPECTION DU VÉHICULE</small><h3>{selection.shipment.vehicle?.model ?? "Atlas TX 480"}</h3><b>{selection.shipment.vehicle?.registration ?? "Convoi industriel"}</b><dl><div><dt>Mission</dt><dd>{selection.shipment.reference}</dd></div><div><dt>Cargaison</dt><dd>{selection.shipment.cargoName}</dd></div><div><dt>Trajet</dt><dd>{selection.shipment.originCity} → {selection.shipment.destinationCity}</dd></div><div><dt>Progression</dt><dd>{selection.shipment.progressPercent}%</dd></div><div><dt>État</dt><dd>{selection.shipment.vehicle?.condition ?? 100}%</dd></div><div><dt>Kilométrage</dt><dd>{Number(selection.shipment.vehicle?.mileageKm ?? 0).toLocaleString("fr-FR")} km</dd></div></dl><div className="inspectProgress"><i style={{ width: `${selection.shipment.progressPercent}%` }} /></div></div></article>}
      {selection?.kind === "building" && <article className="buildingCard"><button className="closeInspect" onClick={() => setSelection(null)}>×</button><small>SITE INDUSTRIEL ACCESSIBLE</small><h3>{selection.name}</h3><p>{selection.buildingKind === "factory" ? "Observez les machines, les lignes de production et les installations techniques." : "Parcourez les rayonnages, les palettes et la zone de manutention."}</p><button className="enterBuilding" onClick={enterBuilding}>Entrer dans le bâtiment →</button></article>}
    </div>
  </section>;
}
