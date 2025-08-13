// Littlest Tokyo — Keyframe Animation (inspired by threejs example)
// Loads GLTF with DRACO+KTX2, sets environment lighting, and exposes
// animation controls (play/pause, speed, scrub).

import * as THREE from 'three';
import { OrbitControls } from 'https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.158.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://unpkg.com/three@0.158.0/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'https://unpkg.com/three@0.158.0/examples/jsm/loaders/KTX2Loader.js';
import { RoomEnvironment } from 'https://unpkg.com/three@0.158.0/examples/jsm/environments/RoomEnvironment.js';
import { GUI } from 'https://unpkg.com/three@0.158.0/examples/jsm/libs/lil-gui.module.min.js';

let renderer, scene, camera, controls;
let mixer, clock, action, clipDuration = 0;
let model;

const params = {
  paused: false,
  timeScale: 1.0,
  time: 0,
};

init();
animate();

function init() {
  const container = document.getElementById('app');

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0e14);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.25, 100);
  camera.position.set(4.5, 2.0, 7.0);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 1.0, 0);

  clock = new THREE.Clock();

  // Shadow catcher ground (smaller, slightly below origin, semi-transparent)
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.25 });
  groundMat.depthWrite = false;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.005;
  ground.receiveShadow = true;
  scene.add(ground);

  // Subtle grid just around the model
  const grid = new THREE.GridHelper(12, 24, 0x334, 0x223);
  grid.material.opacity = 0.12;
  grid.material.transparent = true;
  grid.position.y = -0.004;
  scene.add(grid);

  // Environment lighting using RoomEnvironment (matches official examples)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environment = envMap;
  pmrem.dispose();

  // Load GLTF after env is set
  loadGLTF();

  window.addEventListener('resize', onWindowResize);
}

function loadGLTF() {
  const gltfLoader = new GLTFLoader();

  const draco = new DRACOLoader();
  draco.setDecoderPath('./assets/draco/');
  gltfLoader.setDRACOLoader(draco);

  const ktx2 = new KTX2Loader();
  ktx2.setTranscoderPath('./assets/basis/');
  ktx2.detectSupport(renderer);
  gltfLoader.setKTX2Loader(ktx2);

  gltfLoader.load(
    './assets/LittlestTokyo.glb',
    (gltf) => {
      // Pivot group so we can center the model easily
      const pivot = new THREE.Group();
      pivot.name = 'ModelPivot';
      scene.add(pivot);

      model = gltf.scene;
      model.scale.set(0.01, 0.01, 0.01);
      model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      pivot.add(model);

      // Center the model at origin and place base at y=0
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      model.position.set(-center.x, -center.y, -center.z);
      box.setFromObject(model);
      const yOffset = -box.min.y;
      model.position.y += yOffset;

      // Frame camera and controls to the model bounds
      frameToBox(box);

      mixer = new THREE.AnimationMixer(model);
      // The model contains a single keyframe animation clip
      const clip = gltf.animations[0];
      clipDuration = clip.duration;
      action = mixer.clipAction(clip);
      action.play();

      setupGUI();
    }
  );
}

function setupGUI() {
  const gui = new GUI({ title: 'Littlest Tokyo' });
  gui.domElement.style.right = '12px';
  gui.domElement.style.top = '12px';

  gui.add(params, 'paused').name('Paused').onChange((v) => {
    if (!mixer) return;
    mixer.timeScale = v ? 0 : params.timeScale;
  });
  gui.add(params, 'timeScale', 0, 2, 0.01).name('Speed').onChange((v) => {
    if (!mixer || params.paused) return;
    mixer.timeScale = v;
  });
  gui.add(params, 'time', 0, 1, 0.001).name('Scrub').onChange((v) => {
    if (!mixer) return;
    const t = v * clipDuration;
    mixer.setTime(t);
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock ? clock.getDelta() : 0.016;
  if (mixer && !params.paused) mixer.update(dt * params.timeScale);
  controls.update();
  renderer.render(scene, camera);
}

function frameToBox(box) {
  const size = box.getSize(new THREE.Vector3());
  const center = new THREE.Vector3(0, (box.max.y + box.min.y) * 0.5, 0); // model centered at origin

  // Set controls target to model center
  controls.target.copy(center);

  // Compute a good distance to frame the object
  const maxSize = Math.max(size.x, size.y, size.z);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const fitHeightDistance = maxSize / (2 * Math.tan(fov / 2));
  const fitWidthDistance = fitHeightDistance / camera.aspect;
  const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.4; // add some margin

  // Keep a nice viewing angle (azimuth -35°, elevation 25°)
  const phi = THREE.MathUtils.degToRad(65); // from Y axis
  const theta = THREE.MathUtils.degToRad(-35);
  const pos = new THREE.Spherical(distance, phi, theta);
  const posVec = new THREE.Vector3().setFromSpherical(pos).add(center);

  camera.position.copy(posVec);
  camera.near = distance / 100;
  camera.far = distance * 100;
  camera.updateProjectionMatrix();
  controls.update();
}
