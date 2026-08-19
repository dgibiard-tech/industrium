import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Shipment } from "./App";

type BuildingKind = "factory" | "warehouse" | "headquarters";
type Selection =
  | { kind: "vehicle"; shipment: Shipment }
  | { kind: "building"; buildingKind: BuildingKind; name: string }
  | null;
type Interior = { kind: BuildingKind; name: string } | null;

const inspectionImage = (model?: string) =>
  model === "Voltis E18"
    ? "/assets/voltis-e18-world-v2.png"
    : model === "Nova V6 Urban"
      ? "/assets/nova-v6-world-v2.png"
      : "/assets/atlas-tx480-world-v2.png";

const material = (color: number, metalness = 0.18, roughness = 0.72) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness });

function box(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) {
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

function addFactory(
  scene: THREE.Scene,
  x: number,
  z: number,
  name: string,
  scale = 1,
) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  const steel = material(0x3b464c, 0.42),
    dark = material(0x171d21, 0.5),
    orange = material(0xd66b21, 0.36);
  const glass = new THREE.MeshStandardMaterial({
    color: 0x7daebb,
    emissive: 0x183a43,
    emissiveIntensity: 1.25,
    roughness: 0.18,
  });
  group.add(box(23, 0.35, 18, material(0x45494a), 0, 0.16, 0));
  group.add(box(18, 4, 11, steel, 0, 2.2, 0));
  group.add(box(6, 6, 11, dark, -5, 5, 0));
  for (let i = -7; i <= 7; i += 3.5)
    group.add(box(2.2, 1.2, 0.14, glass, i, 2.2, -5.57));
  for (let i = -6; i <= 6; i += 4) {
    const chimney = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.92, 9, 18),
      dark,
    );
    chimney.position.set(i, 8, 2);
    chimney.castShadow = true;
    group.add(chimney);
    group.add(box(1.55, 0.38, 1.55, orange, i, 12.5, 2));
  }
  const sign = box(7, 1.1, 0.18, orange, 3.5, 5.1, -5.72);
  group.add(sign);
  mark(group, { kind: "building", buildingKind: "factory", name });
  scene.add(group);
}

function addWarehouse(
  scene: THREE.Scene,
  x: number,
  z: number,
  name: string,
  rotation = 0,
) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  group.add(box(17, 4.2, 10, material(0x586369, 0.35), 0, 2.2, 0));
  for (let i = -6; i <= 6; i += 4)
    group.add(box(3, 2.8, 0.18, material(0x1d2428, 0.4), i, 1.55, -5.1));
  group.add(box(17.6, 0.42, 10.6, material(0xc86120, 0.3), 0, 4.38, 0));
  group.add(box(6.5, 1, 0.2, material(0xd77a28), 3.5, 5.1, -5.22));
  mark(group, { kind: "building", buildingKind: "warehouse", name });
  scene.add(group);
}

function addHeadquarters(scene:THREE.Scene,x:number,z:number,name:string){
  const group=new THREE.Group();group.position.set(x,0,z);
  const glass=new THREE.MeshStandardMaterial({color:0x5da9c5,metalness:.45,roughness:.14,transparent:true,opacity:.78,emissive:0x103b4a,emissiveIntensity:.8});
  group.add(box(13,.3,11,material(0x343f44),0,.15,0),box(10,11,8,glass,0,5.6,0),box(12,2.4,10,material(0x202c32,.55),0,1.2,0));
  for(let y=3;y<10;y+=2)group.add(box(10.4,.18,8.4,material(0xd4832d,.55),0,y,0));
  group.add(box(5,.9,.22,new THREE.MeshStandardMaterial({color:0x30c6e8,emissive:0x116c83,emissiveIntensity:2}),0,7,-4.15));
  mark(group,{kind:"building",buildingKind:"headquarters",name});scene.add(group);
}

function addRoad(scene: THREE.Scene, a: THREE.Vector3, b: THREE.Vector3) {
  const length = a.distanceTo(b)+.35,
    road = box(4.5, 0.12, length, material(0x24292b, 0.05, 0.9));
  road.position.copy(a).lerp(b, 0.5);
  road.lookAt(b);
  scene.add(road);
  const line = box(
    0.1,
    0.14,
    length,
    new THREE.MeshBasicMaterial({ color: 0xe5b768 }),
    0,
    0.14,
    0,
  );
  line.position.copy(road.position);
  line.rotation.copy(road.rotation);
  scene.add(line);
  const direction=b.clone().sub(a).normalize(),perpendicular=new THREE.Vector3(-direction.z,0,direction.x);
  for(const side of [-1,1]){const edge=box(.09,.145,length,new THREE.MeshBasicMaterial({color:0xe8ece8}),0,.145,0);edge.position.copy(road.position).addScaledVector(perpendicular,side*1.82);edge.rotation.copy(road.rotation);scene.add(edge)}
}

function addCurvedRoad(scene:THREE.Scene,points:THREE.Vector3[]){
  const curve=new THREE.CatmullRomCurve3(points.map(point=>point.clone()),false,"catmullrom",.35),samples=16;
  for(let index=0;index<samples;index++)addRoad(scene,curve.getPoint(index/samples),curve.getPoint((index+1)/samples));
  return curve;
}

function addTree(scene: THREE.Scene, x: number, z: number, size: number) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14 * size, 0.22 * size, 1.8 * size, 7),
    material(0x59452e),
  );
  trunk.position.y = 0.9 * size;
  trunk.castShadow = true;
  group.add(trunk);
  for (let i = 0; i < 3; i++) {
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry((1.05 - i * 0.12) * size, 1),
      material(i % 2 ? 0x315a34 : 0x254a2d, 0, 0.94),
    );
    crown.position.set(
      (i - 1) * 0.3 * size,
      (2.05 + i * 0.4) * size,
      (i % 2) * 0.18,
    );
    crown.castShadow = true;
    group.add(crown);
  }
  scene.add(group);
}

function addWorldDetails(scene: THREE.Scene) {
  const animations: Array<(time: number) => void> = [];

  for (const [x, z, rotation] of [[-43,-22,0.1],[39,-7,-0.2],[-8,35,0.25]] as const) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(.22,.55,12,12), material(0xdce6e8,.22,.35));
    tower.position.set(x,6,z); scene.add(tower);
    const rotor = new THREE.Group(); rotor.position.set(x,12,z); rotor.rotation.y=rotation;
    for(let blade=0;blade<3;blade++){const arm=box(.28,5,.18,material(0xf0f5f5,.15,.3),0,2.5,0);arm.rotation.z=blade*Math.PI*2/3;rotor.add(arm)}
    scene.add(rotor); animations.push(time=>{rotor.rotation.z=time*.55});
  }
  for(let i=0;i<16;i++){
    const angle=i/16*Math.PI*2, radius=31+(i%3)*5;
    const house=new THREE.Group(); house.position.set(Math.cos(angle)*radius,0,Math.sin(angle)*radius);
    house.add(box(3.6,2.2,3,material(i%3===0?0xd5c4a5:0xaeb8bc),0,1.1,0));
    const roof=new THREE.Mesh(new THREE.ConeGeometry(2.65,1.4,4),material(i%2?0x7c392c:0x465b66));roof.position.y=2.9;roof.rotation.y=Math.PI/4;house.add(roof);scene.add(house);
  }
  for(let i=0;i<22;i++){
    const x=-36+i*3.45;
    const pole=box(.12,3.5,.12,material(0x263239,.6),x,1.75,7);scene.add(pole);
    const lamp=box(.45,.12,.2,new THREE.MeshStandardMaterial({color:0xffe2a2,emissive:0xffb347,emissiveIntensity:2}),x,3.45,7);scene.add(lamp);
  }
  for(let i=0;i<18;i++){
    const panel=box(3,.12,1.65,new THREE.MeshStandardMaterial({color:0x163f5c,metalness:.65,roughness:.2}),-41+(i%6)*3.4,.55,-34+Math.floor(i/6)*2.2);panel.rotation.x=-.25;scene.add(panel);
  }
  for(let i=0;i<5;i++){
    const car=new THREE.Group();car.add(box(1.05,.5,2,material([0x2ea5d0,0xe4b43c,0xd94d44,0xe8ecee,0x4f6575][i]),0,.45,0));car.position.set(-31+i*9,.12,6.3);scene.add(car);
    animations.push(time=>{car.position.x=-40+((time*(2.4+i*.16)+i*13)%80);});
  }
  return animations;
}

function addTruck(scene: THREE.Scene, shipment: Shipment, index: number) {
  const group = new THREE.Group();
  const cab = material(index % 2 ? 0x46535b : 0xcf641c, 0.52, 0.34),
    trailer = material(0x626b6e, 0.35, 0.6);
  group.add(box(1.7, 1.7, 1.6, cab, 0, 1.2, -2.15));
  group.add(box(1.62, 0.85, 0.5, cab, 0, 0.82, -3.15));
  group.add(box(1.9, 1.75, 4.5, trailer, 0, 1.35, 0.75));
  group.add(
    box(
      1.45,
      0.58,
      0.05,
      new THREE.MeshStandardMaterial({ color: 0x8bb9c7, emissive: 0x16353e }),
      0,
      1.45,
      -2.98,
    ),
  );
  for (const z of [-2.45, -0.45, 1.65, 2.15])
    for (const x of [-0.95, 0.95]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.38, 0.25, 18),
        material(0x0d1011, 0, 0.95),
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.46, z);
      wheel.castShadow = true;
      group.add(wheel);
    }
  group.scale.setScalar(0.72);
  mark(group, { kind: "vehicle", shipment });
  scene.add(group);
  return group;
}

function addLandscape(scene: THREE.Scene) {
  const terrainGeo = new THREE.PlaneGeometry(150, 118, 30, 24);
  const pos = terrainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i);
    const edge = Math.max(0, (Math.abs(x) - 43) / 18, (Math.abs(y) - 34) / 17);
    pos.setZ(
      i,
      edge * edge * 8 + Math.sin(x * 0.12) * Math.cos(y * 0.13) * 0.28,
    );
  }
  terrainGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(terrainGeo, material(0x304b31, 0, 0.96));
  terrain.rotation.x = -Math.PI / 2;
  terrain.receiveShadow = true;
  scene.add(terrain);
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(10, 48),
    new THREE.MeshStandardMaterial({
      color: 0x315d68,
      roughness: 0.2,
      metalness: 0.2,
      transparent: true,
      opacity: 0.88,
    }),
  );
  pond.rotation.x = -Math.PI / 2;
  pond.scale.set(1.6, 0.7, 1);
  pond.position.set(45, 0.15, 27);
  scene.add(pond);
  const trees: Array<[number, number, number]> = [];
  for (let i = 0; i < 80; i++) {
    const angle = i * 2.399,
      radius = 43 + (i % 9) * 2.7;
    trees.push([
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.72,
      0.65 + (i % 5) * 0.11,
    ]);
  }
  trees.forEach(([x, z, s]) => addTree(scene, x, z, s));
}

function addExterior(scene: THREE.Scene, active: Shipment[]) {
  addLandscape(scene);
  const animations=addWorldDetails(scene);
  addFactory(scene, -19, -10, "Usine Métallurgique Nord", 1.12);
  addFactory(scene, 25, -22, "Complexe d’Assemblage Atlas", 0.78);
  addWarehouse(scene, 15, 18, "Entrepôt Logistique Central", 0.22);
  addWarehouse(scene, -29, 25, "Plateforme Fret Ouest", -0.18);
  addHeadquarters(scene,2,-30,"Siège social Industrium");
  const hubs = [
    new THREE.Vector3(-32, 0.17, 31),
    new THREE.Vector3(-19, 0.17, -10),
    new THREE.Vector3(15, 0.17, 18),
    new THREE.Vector3(29, 0.17, -23),
  ];
  const routes=[
    addCurvedRoad(scene,[hubs[0],new THREE.Vector3(-34,.17,8),new THREE.Vector3(-25,.17,-2),hubs[1]]),
    addCurvedRoad(scene,[hubs[1],new THREE.Vector3(-8,.17,-1),new THREE.Vector3(3,.17,12),hubs[2]]),
    addCurvedRoad(scene,[hubs[2],new THREE.Vector3(27,.17,10),new THREE.Vector3(33,.17,-8),hubs[3]]),
    addCurvedRoad(scene,[hubs[1],new THREE.Vector3(-4,.17,-18),new THREE.Vector3(13,.17,-24),hubs[3]]),
    addCurvedRoad(scene,[hubs[0],new THREE.Vector3(-13,.17,35),new THREE.Vector3(8,.17,30),hubs[2]]),
  ];
  const roundabout=new THREE.Mesh(new THREE.RingGeometry(4.2,7.2,48),material(0x24292b,.05,.9));roundabout.rotation.x=-Math.PI/2;roundabout.position.set(-5,.09,2);scene.add(roundabout);
  for(let angle=0;angle<Math.PI*2;angle+=Math.PI/2){const islandLight=new THREE.PointLight(0xffb35b,3,7);islandLight.position.set(-5+Math.cos(angle)*5.7,1.2,2+Math.sin(angle)*5.7);scene.add(islandLight)}
  for (let i = 0; i < 28; i++)
    scene.add(
      box(
        3,
        0.9,
        1.2,
        material([0x91462d, 0x345e70, 0x6d713d, 0xb07132][i % 4]),
        14 + (i % 7) * 3.15,
        0.56 + Math.floor(i / 14),
        25 + Math.floor(i / 7) * 1.35,
      ),
    );
  return {
    hubs,
    trucks: active.map((shipment, i) => addTruck(scene, shipment, i)),
    animations,
    routes,
  };
}

function addInterior(scene: THREE.Scene, interior: NonNullable<Interior>) {
  const animations: Array<(time: number) => void> = [];
  scene.background = new THREE.Color(0x11171a);
  scene.fog = new THREE.Fog(0x11171a, 35, 90);
  if(interior.kind!=="headquarters"){
    const environmentTexture=new THREE.TextureLoader().load(interior.kind==="factory"?"/assets/factory-interior-360-v4.png":"/assets/warehouse-interior-360-v4.png");
    environmentTexture.colorSpace=THREE.SRGBColorSpace;environmentTexture.mapping=THREE.EquirectangularReflectionMapping;scene.background=environmentTexture;scene.userData.environmentTexture=environmentTexture;
  }else{
    const backdropTexture=new THREE.TextureLoader().load("/assets/headquarters-interior-v1.png");backdropTexture.colorSpace=THREE.SRGBColorSpace;
    const backdrop=new THREE.Mesh(new THREE.PlaneGeometry(26,14.6),new THREE.MeshBasicMaterial({map:backdropTexture,toneMapped:false}));backdrop.position.set(0,6.8,18.15);scene.add(backdrop);
  }
  scene.add(box(52, 0.35, 38, material(0x3b4040), 0, -0.1, 0));
  if(interior.kind==="headquarters"){
    scene.add(box(52,13,.5,material(0x30373a),0,6.5,18.5));
    for(const x of [-25,25])scene.add(box(.5,13,38,material(0x30373a),x,6.5,0));
  }
  for (let z = -16; z <= 16; z += 5.4) {
    scene.add(box(52, 0.24, 0.28, material(0x1c252a, 0.65), 0, 11.8, z));
  }
  const zoneColors = [0x00c8ff, 0xff8a24, 0x7ee35b, 0xc45cff];
  for (const [index, x] of [-9.6, -3.2, 3.2, 9.6].entries()) {
    scene.add(box(0.18, 0.035, 36, new THREE.MeshBasicMaterial({ color: zoneColors[index] }), x, 0.1, 0));
    const zoneLight = new THREE.PointLight(zoneColors[index], 7, 12);
    zoneLight.position.set(x, 3.5, -2);
    scene.add(zoneLight);
  }
  for (let x = -20; x <= 20; x += 10) {
    const lamp = box(
      5,
      0.12,
      0.45,
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xdcefff,
        emissiveIntensity: 5,
      }),
      x,
      11,
      0,
    );
    scene.add(lamp);
    const light = new THREE.PointLight(0xddeeff, 16, 18);
    light.position.set(x, 10, 0);
    scene.add(light);
  }
  if(interior.kind==="headquarters"){
    for(let i=0;i<9;i++){
      const desk=box(3,.18,1.5,material(i%2?0x6d4d35:0x344c58),-16+(i%5)*8,.85,-8+Math.floor(i/5)*8);scene.add(desk);
      const screen=box(1.1,.75,.08,new THREE.MeshStandardMaterial({color:0x1f708b,emissive:0x1b91ad,emissiveIntensity:2}),desk.position.x,1.35,desk.position.z);scene.add(screen);
    }
    for(let i=0;i<12;i++){
      const employee=new THREE.Group();const body=new THREE.Mesh(new THREE.CylinderGeometry(.28,.4,1.25,12),material([0x247b9b,0x7648a2,0xb8662b,0x3e8b67][i%4]));body.position.y=1.05;employee.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.27,12,8),material(0xd1a47f));head.position.y=1.88;employee.add(head);employee.position.set(-18+(i%6)*7,0,-12+Math.floor(i/6)*11);scene.add(employee);animations.push(time=>{employee.position.x=-20+((time*(.55+i%3*.08)+i*5)%40);employee.rotation.y=Math.PI/2;});
    }
  } else if (interior.kind === "warehouse") {
    for (const z of [-11, -4, 4, 11])
      for (const x of [-17, -7, 7, 17]) {
        scene.add(box(5.5, 6.5, 2.2, material(0x3b454a, 0.55), x, 3.25, z));
        for (let y = 1; y <= 5; y += 2)
          scene.add(
            box(
              4.8,
              1.15,
              1.7,
              material(zoneColors[Math.abs(Math.round(x + z + y)) % zoneColors.length], 0.4),
              x,
              y,
              z,
            ),
          );
      }
    const forklift = new THREE.Group();
    forklift.add(
      box(2.4, 1.5, 3, material(0xe58a1d, 0.4), 0, 0.95, 0),
      box(0.16, 3.5, 0.16, material(0x171b1d), -0.75, 2.1, -1.4),
      box(0.16, 3.5, 0.16, material(0x171b1d), 0.75, 2.1, -1.4),
    );
    forklift.position.set(0, 0, 8);
    scene.add(forklift);
    const pallet = box(2.1, 0.75, 1.6, material(0x9a673b), 0, 0.75, -1.8);
    forklift.add(pallet);
    animations.push((time) => {
      forklift.position.z = 8 - ((time * 2.2) % 24);
      forklift.position.x = Math.sin(time * 0.32) * 1.2;
      pallet.position.y = 0.75 + (Math.sin(time * 1.3) + 1) * 0.32;
    });
    for (let i = 0; i < 7; i++) {
      const parcel = box(1.2, 0.65, 0.9, material(i % 2 ? 0x8b6039 : 0x536b70), 0, 1.05, -14 + i * 4);
      scene.add(parcel);
      animations.push((time) => { parcel.position.z = -16 + ((time * 1.8 + i * 4) % 32); });
    }
  } else {
    for (const z of [-8, 0, 8]) {
      scene.add(box(38, 0.8, 2.2, material(0x333b3e, 0.5), 0, 1.1, z));
      for (let x = -17; x <= 17; x += 5.5) {
        const machine = box(
          3.3,
          2.8,
          3.2,
          material((x + z) % 2 ? 0x375966 : 0x596166, 0.55),
          x,
          2.5,
          z,
        );
        scene.add(machine);
        scene.add(
          box(
            2.2,
            0.38,
            0.12,
            new THREE.MeshStandardMaterial({
              color: 0x79b7c6,
              emissive: 0x1a6070,
              emissiveIntensity: 2,
            }),
            x,
            2.7,
            z - 1.66,
          ),
        );
      }
    }
    for (const x of [-21, 21]) {
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.1, 10, 20),
        material(0x4a5255, 0.65),
      );
      pipe.position.set(x, 5, 13);
      scene.add(pipe);
    }
    for (let i = 0; i < 6; i++) {
      const robot = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1, 0.75, 16), material(0xd56f22, 0.55));
      base.position.y = 0.38; robot.add(base);
      const shoulder = new THREE.Group(); shoulder.position.y = 0.75; robot.add(shoulder);
      const lowerArm = box(0.7, 3.2, 0.72, material(0xd97929, 0.5), 0, 1.5, 0); shoulder.add(lowerArm);
      const elbow = new THREE.Group(); elbow.position.y = 3; shoulder.add(elbow);
      const upperArm = box(0.58, 2.7, 0.58, material(0xe18a36, 0.5), 0, 1.25, 0); elbow.add(upperArm);
      const tool = box(1.1, 0.45, 0.7, material(0x20292e, 0.65), 0, 2.65, 0); elbow.add(tool);
      robot.position.set(i % 2 ? 6.4 : -6.4, 0, -11 + i * 4.4); robot.rotation.y = i % 2 ? -Math.PI / 2 : Math.PI / 2; scene.add(robot);
      animations.push((time) => {
        const phase = time * 1.15 + i * 0.9;
        robot.rotation.y = (i % 2 ? -Math.PI / 2 : Math.PI / 2) + Math.sin(phase * 0.55) * 0.28;
        shoulder.rotation.z = Math.sin(phase) * 0.48;
        elbow.rotation.z = -0.55 + Math.sin(phase + 1.2) * 0.62;
      });
    }
    for (let i = 0; i < 8; i++) {
      const chassis = box(2.3, 0.42, 1.25, material(0x8d979b, 0.7), -14 + i * 4, 1.65, 0);
      scene.add(chassis);
      animations.push((time) => { chassis.position.x = -18 + ((time * 1.25 + i * 4.5) % 36); });
    }
  }
  return animations;
}

export default function IndustrialMap3D({
  shipments,
  onNavigate,
}: {
  shipments: Shipment[];
  onNavigate: (tab: string) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [interior, setInterior] = useState<Interior>(null);
  const [activeZone, setActiveZone] = useState(0);
  const [mapView, setMapView] = useState<"regional" | "sites" | "traffic">("regional");
  const active = shipments.filter(
    (s) => s.status === "ASSIGNED" || s.status === "IN_TRANSIT",
  );
  const activeKey = active.map((s) => `${s.id}:${s.progressPercent}`).join("|");

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x91b4ca);
    let environmentTexture:THREE.Texture|undefined;
    if(!interior){environmentTexture=new THREE.TextureLoader().load("/assets/industrial-valley-360-v2.png");environmentTexture.colorSpace=THREE.SRGBColorSpace;environmentTexture.mapping=THREE.EquirectangularReflectionMapping;scene.background=environmentTexture;}
    scene.fog = new THREE.FogExp2(
      interior ? 0x11171a : 0x9bb5bf,
      interior ? 0.008 : 0.0065,
    );
    const camera = new THREE.PerspectiveCamera(
      48,
      host.clientWidth / host.clientHeight,
      0.1,
      500,
    );
    const exteriorCamera = mapView === "sites" ? [38,24,42] : mapView === "traffic" ? [8,15,39] : [50,43,61];
    camera.position.set(interior ? 29 : exteriorCamera[0], interior ? 16 : exteriorCamera[1], interior ? 30 : exteriorCamera[2]);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    scene.add(
      new THREE.HemisphereLight(
        interior ? 0xc9e5f0 : 0xc7e1ee,
        interior ? 0x131719 : 0x263421,
        interior ? 1.2 : 2.4,
      ),
    );
    const sun = new THREE.DirectionalLight(0xffd3a3, interior ? 1.2 : 3.6);
    sun.position.set(-28, 48, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70;
    sun.shadow.camera.bottom = -70;
    scene.add(sun);
    const interiorAnimations = interior ? addInterior(scene, interior) : [];
    const world = interior ? null : addExterior(scene, active);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = interior ? 8 : 18;
    controls.maxDistance = interior ? 65 : 120;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, interior ? 2.5 : 0, 0);
    const raycaster = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let downX = 0,
      downY = 0;
    const pointerDown = (event: PointerEvent) => {
      downX = event.clientX;
      downY = event.clientY;
    };
    const pointerUp = (event: PointerEvent) => {
      if (
        interior ||
        Math.hypot(event.clientX - downX, event.clientY - downY) > 7
      )
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster
        .intersectObjects(scene.children, true)
        .find((entry) => entry.object.userData.pickRoot);
      const root = hit?.object.userData.pickRoot as THREE.Object3D | undefined;
      if (!root) {
        setSelection(null);
        return;
      }
      if (root.userData.kind === "vehicle")
        setSelection({
          kind: "vehicle",
          shipment: root.userData.shipment as Shipment,
        });
      if (root.userData.kind === "building")
        setSelection({
          kind: "building",
          buildingKind: root.userData.buildingKind as BuildingKind,
          name: String(root.userData.name),
        });
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    const resize = () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };
    window.addEventListener("resize", resize);
    const clock = new THREE.Clock();
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      if (world)
        world.trucks.forEach((truck, i) => {
          const durationSeconds=Math.max(1,(new Date(active[i].arrivesAt??Date.now()).getTime()-new Date(active[i].acceptedAt??Date.now()).getTime())/1000),p=Math.min(.998,active[i].progressPercent/100+t/durationSeconds),
            route=world.routes[i%world.routes.length],next=route.getPointAt(Math.min(1,p+.008));
          truck.position.copy(route.getPointAt(p));
          truck.position.y = 0.2;
          truck.lookAt(next);
        });
      world?.animations.forEach((update) => update(t));
      interiorAnimations.forEach((update) => update(t));
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      controls.dispose();
      renderer.dispose();
      environmentTexture?.dispose();
      const interiorTexture=scene.userData.environmentTexture as THREE.Texture|undefined;interiorTexture?.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          (Array.isArray(object.material)
            ? object.material
            : [object.material]
          ).forEach((item) => {
            if (item instanceof THREE.MeshBasicMaterial && item.map)
              item.map.dispose();
            item.dispose();
          });
        }
      });
      if (renderer.domElement.parentNode === host)
        host.removeChild(renderer.domElement);
    };
  }, [activeKey, interior, mapView]);

  const enterBuilding = () => {
    if (selection?.kind === "building") {
      setInterior({ kind: selection.buildingKind, name: selection.name });
      setSelection(null);
    }
  };
  return (
    <section>
      <div className="mapToolbar">
        <div>
          <small>JUMEAU NUMÉRIQUE · TEMPS RÉEL</small>
          <h2>{interior ? interior.name : "Monde industriel 3D"}</h2>
        </div>
        <div>
          {interior ? (
            <button className="mapBack" onClick={() => setInterior(null)}>
              ← Retour à la carte
            </button>
          ) : (
            <>
              <div className="mapViewControls">
                {([['regional','Vue région'],['sites','Sites'],['traffic','Trafic']] as const).map(([mode,label]) => <button className={mapView===mode?'active':''} key={mode} onClick={()=>setMapView(mode)}>{label}</button>)}
              </div>
              <span className="legend orange"></span> Convoi actif{" "}
              <span className="legend white"></span> Site visitable
            </>
          )}
        </div>
      </div>
      <div className="map3d" ref={mount}>
        <div className="map3dHelp">
          {interior
            ? "VISITE INTÉRIEURE · ROTATION, ZOOM ET DÉPLACEMENT"
            : "CLIQUEZ UN VÉHICULE OU UN BÂTIMENT · GLISSEZ POUR EXPLORER"}
        </div>
        {!interior && !selection && (
          <>
            <div className="worldLiveBar"><span><i /> MONDE EN DIRECT</span><b>5 sites connectés</b><b>{active.length} véhicules suivis</b><b>Énergie renouvelable 38 %</b></div>
            <div className="mapPanel">
              <small>RÉSEAU LOGISTIQUE</small>
              <strong>{active.length} convois actifs</strong>
              <span>2 usines · 2 entrepôts · 1 siège social visitables</span>
              <span>{shipments.filter((s) => s.status === "OPEN").length} contrats disponibles</span>
              <span>16 quartiers · 3 éoliennes · 18 panneaux solaires</span>
            </div>
          </>
        )}
        {!interior&&active.length>0&&<div className="vehicleTracker"><header><div><small>FLEET GPS · TEMPS RÉEL</small><b>{active.length} véhicule(s) localisé(s)</b></div><i/></header><div>{active.slice(0,8).map(shipment=><button key={shipment.id} onClick={()=>setSelection({kind:"vehicle",shipment})}><span className="trackerTruck">▰</span><div><b>{shipment.vehicle?.registration??shipment.reference}</b><small>{shipment.vehicle?.model??"Véhicule logistique"} · {shipment.cargoName}</small><em>{shipment.originCity} → {shipment.destinationCity}</em></div><strong>{shipment.progressPercent}%<small>État {shipment.vehicle?.condition??100}%</small></strong></button>)}</div></div>}
        {interior && (
          <>
            <div className="interiorBadge">
              <small>SITE ULTRA-MODERNE · CONNECTÉ</small>
              <strong>{interior.kind === "factory" ? "Smart Factory 4.0" : interior.kind === "warehouse" ? "Smart Hub logistique" : "Direction & collaborateurs"}</strong>
              <span>{interior.kind==="headquarters"?"Employés et services pilotés en temps réel":"Robots, énergie et sécurité pilotés en temps réel"}</span>
            </div>
            <div className="facilityConsole">
              <small>CENTRE DE CONTRÔLE</small>
              <div className="facilityTabs">
                {(interior.kind === "factory"
                  ? ["Production", "Robots", "Qualité", "Énergie"]
                  : interior.kind === "warehouse" ? ["Stockage", "Tri robotisé", "Quais", "Énergie"] : ["Direction","Finance","Ressources humaines","Opérations"]
                ).map((zone, index) => (
                  <button className={activeZone === index ? "active" : ""} key={zone} onClick={() => setActiveZone(index)}>{zone}</button>
                ))}
              </div>
              <div className="facilityStatus">
                <i className={`statusOrb color${activeZone}`} />
                <div><b>{["Opérationnel", "Automatique", "Contrôle actif", "Optimisé"][activeZone]}</b><span>{["Cadence nominale 94 %", "18 unités connectées", "Défauts détectés 0,3 %", "Économie actuelle 21 %"][activeZone]}</span></div>
                <em>EN LIGNE</em>
              </div>
              <div className="operationsTerminal">
                <small>TERMINAL DE GESTION</small>
                <div>
                  {(interior.kind === "factory"
                    ? [["Usines","Production"],["Commandes","Commandes"],["Stocks","Matières"],["Emplois","Personnel"],["Transport","Expéditions"],["Marché mondial","Marché"]]
                    : interior.kind === "warehouse" ? [["Stocks","Inventaire"],["Commandes","Commandes"],["Marché mondial","Marché"],["Transport","Quais"],["Usines","Production"],["Emplois","Personnel"]] : [["Vue d’ensemble","Direction"],["Emplois","Collaborateurs"],["Commandes","Commercial"],["Marché mondial","Finance"],["Usines","Industrie"],["Transport","Logistique"]]
                  ).map(([tab,label],index)=><button key={tab} onClick={()=>onNavigate(tab)}><i>{["▦","≡","◈","⇄","⚙","♟"][index]}</i><span>{label}</span><em>OUVRIR →</em></button>)}
                </div>
              </div>
            </div>
          </>
        )}
        {selection?.kind === "vehicle" && (
          <article className="inspectionCard">
            <button className="closeInspect" onClick={() => setSelection(null)}>
              ×
            </button>
            <img
              src={inspectionImage(selection.shipment.vehicle?.model)}
              alt={selection.shipment.vehicle?.model ?? "Véhicule logistique"}
            />
            <div className="inspectionBody">
              <small>INSPECTION DU VÉHICULE</small>
              <h3>{selection.shipment.vehicle?.model ?? "Atlas TX 480"}</h3>
              <b>
                {selection.shipment.vehicle?.registration ??
                  "Convoi industriel"}
              </b>
              <dl>
                <div>
                  <dt>Mission</dt>
                  <dd>{selection.shipment.reference}</dd>
                </div>
                <div>
                  <dt>Cargaison</dt>
                  <dd>{selection.shipment.cargoName}</dd>
                </div>
                <div>
                  <dt>Trajet</dt>
                  <dd>
                    {selection.shipment.originCity} →{" "}
                    {selection.shipment.destinationCity}
                  </dd>
                </div>
                <div>
                  <dt>Progression</dt>
                  <dd>{selection.shipment.progressPercent}%</dd>
                </div>
                <div>
                  <dt>État</dt>
                  <dd>{selection.shipment.vehicle?.condition ?? 100}%</dd>
                </div>
                <div>
                  <dt>Kilométrage</dt>
                  <dd>
                    {Number(
                      selection.shipment.vehicle?.mileageKm ?? 0,
                    ).toLocaleString("fr-FR")}{" "}
                    km
                  </dd>
                </div>
              </dl>
              <div className="inspectProgress">
                <i
                  style={{ width: `${selection.shipment.progressPercent}%` }}
                />
              </div>
            </div>
          </article>
        )}
        {selection?.kind === "building" && (
          <article className="buildingCard">
            <button className="closeInspect" onClick={() => setSelection(null)}>
              ×
            </button>
            <small>SITE INDUSTRIEL ACCESSIBLE</small>
            <h3>{selection.name}</h3>
            <p>
              {selection.buildingKind === "factory"
                ? "Observez les machines, les lignes de production et les installations techniques."
                : selection.buildingKind === "warehouse" ? "Parcourez les rayonnages, les palettes et la zone de manutention." : "Rejoignez les collaborateurs, la direction, les ressources humaines et le centre de pilotage du groupe."}
            </p>
            <button className="enterBuilding" onClick={enterBuilding}>
              Entrer dans le bâtiment →
            </button>
          </article>
        )}
      </div>
    </section>
  );
}
