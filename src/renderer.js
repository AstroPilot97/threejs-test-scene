import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import GUI from "lil-gui";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise.js";
import WebGL from "three/examples/jsm/capabilities/WebGL.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { Vector3 } from "three";

if (WebGL.isWebGL2Available() === false) {
  document.body.appendChild(WebGL.getWebGL2ErrorMessage());
}

// Global variables
let mixer, clock, controls, renderer, scene, camera, gui;
let sky, sun, cloudMesh, cloudMesh2, cloudMesh3;
let stats;

//Init scene and render animation loop
init();
animate();

function init() {
  // Clock
  clock = new THREE.Clock();

  // Debug
  gui = new GUI();

  // Canvas
  const canvas = document.querySelector("canvas.webgl");

  // Scene
  scene = new THREE.Scene();

  // Models
  const gltfLoader = new GLTFLoader();
  gltfLoader.load("models/peachy_balloon/scene.glb", (gltf) => {
    const model = gltf.scene;
    scene.add(model);
    model.scale.set(0.005, 0.005, 0.005);
    model.position.set(0, 5, 0);
    model.rotateY(Math.PI);
    mixer = new THREE.AnimationMixer(gltf.scene);
    gltf.animations.forEach((clip) => {
      mixer.clipAction(clip).play();
    });

    model.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
  });

  /**
   * Sizes
   */
  const sizes = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  window.addEventListener("resize", () => {
    // Update sizes
    sizes.width = window.innerWidth;
    sizes.height = window.innerHeight;

    // Update camera
    camera.aspect = sizes.width / sizes.height;
    camera.updateProjectionMatrix();

    // Update renderer
    renderer.setSize(sizes.width, sizes.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });

  /**
   * Camera
   */
  // Base camera
  camera = new THREE.PerspectiveCamera(
    75,
    sizes.width / sizes.height,
    0.1,
    2000
  );
  camera.position.x = 0;
  camera.position.y = -5;
  camera.position.z = 15;
  scene.add(camera);

  // Stats
  stats = new Stats();
  const panels = [0, 1, 2]; // 0: fps, 1: ms, 2: mb
  Array.from(stats.dom.children).forEach((child, index) => {
    child.style.display = panels.includes(index) ? "inline-block" : "none";
  });
  document.body.appendChild(stats.dom);

  // Controls
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.enableKeys = true;

  /**
   * Renderer
   */
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
  });

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.35;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Hemisphere light
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
  hemiLight.color.setHSL(0.6, 0.75, 0.5);
  hemiLight.groundColor.setHSL(0.095, 0.5, 0.5);
  scene.add(hemiLight);

  // Init sky
  initSky();

  // Init clouds
  initClouds();
}

// Animate
function animate() {
  // Call tick again on the next frame
  requestAnimationFrame(animate);

  // Update objects
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);
  if (cloudMesh && cloudMesh2 && cloudMesh3) {
    cloudMesh.material.uniforms.cameraPos.value.copy(camera.position);
    cloudMesh.material.uniforms.frame.value++;
    cloudMesh.rotation.y = performance.now() / 5000;

    cloudMesh2.material.uniforms.cameraPos.value.copy(camera.position);
    cloudMesh2.material.uniforms.frame.value++;
    cloudMesh2.rotation.y = performance.now() / 10000;

    cloudMesh3.material.uniforms.cameraPos.value.copy(camera.position);
    cloudMesh3.material.uniforms.frame.value++;
    cloudMesh3.rotation.y = performance.now() / 6000;
  }

  // Update Orbital Controls
  controls.update();

  // Render
  renderer.render(scene, camera);

  // Stats update
  stats.update();

  //Three-Devtools API
  if (typeof __THREE_DEVTOOLS__ !== "undefined") {
    __THREE_DEVTOOLS__.dispatchEvent(
      new CustomEvent("observe", { detail: scene })
    );
    __THREE_DEVTOOLS__.dispatchEvent(
      new CustomEvent("observe", { detail: renderer })
    );
  }
}

// Sky
function initSky() {
  // Add Sky
  sky = new Sky();
  sky.scale.setScalar(100000);
  scene.add(sky);
  sun = new THREE.Vector3();

  // Sun light
  const light = new THREE.DirectionalLight(0xffffff, 4);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.bias = -0.0009;
  light.shadow.camera.left = -15;
  light.shadow.camera.right = 15;
  light.shadow.camera.top = 15;
  light.shadow.camera.bottom = -15;
  scene.add(light);

  const opposingLight = light.clone();
  opposingLight.castShadow = false;
  opposingLight.intensity = light.intensity - 3;
  scene.add(opposingLight);

  /// GUI
  const effectController = {
    turbidity: 5.5,
    rayleigh: 1.1,
    mieCoefficient: 0.008,
    mieDirectionalG: 0.975,
    elevation: 155,
    exposure: renderer.toneMappingExposure,
    azimuth: 113,
  };

  function guiChanged() {
    const uniforms = sky.material.uniforms;
    uniforms["turbidity"].value = effectController.turbidity;
    uniforms["rayleigh"].value = effectController.rayleigh;
    uniforms["mieCoefficient"].value = effectController.mieCoefficient;
    uniforms["mieDirectionalG"].value = effectController.mieDirectionalG;

    const phi = THREE.MathUtils.degToRad(90 - effectController.elevation);
    const theta = THREE.MathUtils.degToRad(effectController.azimuth);

    sun.setFromSphericalCoords(1, phi, theta);
    light.position.setFromSphericalCoords(50, phi, theta);

    uniforms["sunPosition"].value.copy(sun);

    renderer.toneMappingExposure = effectController.exposure;
  }

  guiChanged();
}

function initClouds() {
  // Texture
  const size = 128;
  const data = new Uint8Array(size * size * size);
  let i = 0;
  const scale = 0.05;
  const perlin = new ImprovedNoise();
  const vector = new THREE.Vector3();

  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d =
          1.0 -
          vector
            .set(x, y, z)
            .subScalar(size / 2)
            .divideScalar(size)
            .length();
        data[i] =
          (128 +
            128 *
              perlin.noise((x * scale) / 1.5, y * scale, (z * scale) / 1.5)) *
          d *
          d;
        i++;
      }
    }
  }

  const texture = new THREE.DataTexture3D(data, size, size, size);
  texture.format = THREE.RedFormat;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;

  // Geometry
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      base: { value: new THREE.Color(0x798aa0) },
      map: { value: texture },
      cameraPos: { value: new THREE.Vector3() },
      threshold: { value: 0.25 },
      opacity: { value: 0.25 },
      range: { value: 0.1 },
      steps: { value: 10 },
      frame: { value: 0 },
    },
    vertexShader: document.getElementById("cloudVS").textContent,
    fragmentShader: document.getElementById("cloudFS").textContent,
    side: THREE.BackSide,
    transparent: true,
  });

  cloudMesh = new THREE.Mesh(geometry, material);
  cloudMesh.translateY(-40);
  cloudMesh.scale.set(3000, 50, 3000);
  cloudMesh.receiveShadow = true;

  scene.add(cloudMesh);
  const material2 = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      base: { value: new THREE.Color(0x798aa0) },
      map: { value: texture },
      cameraPos: { value: new THREE.Vector3() },
      threshold: { value: 0.25 },
      opacity: { value: 0.4 },
      range: { value: 0.1 },
      steps: { value: 40 },
      frame: { value: 0 },
    },
    vertexShader: document.getElementById("cloudVS").textContent,
    fragmentShader: document.getElementById("cloudFS").textContent,
    side: THREE.BackSide,
    transparent: true,
  });

  cloudMesh2 = new THREE.Mesh(geometry, material2);
  cloudMesh2.translateOnAxis(new Vector3(-60, 20, 50), 1);
  cloudMesh2.scale.set(50, 30, 50);
  scene.add(cloudMesh2);

  cloudMesh3 = new THREE.Mesh(geometry, material2);
  cloudMesh3.translateOnAxis(new Vector3(50, 70, -50), 1);
  cloudMesh3.scale.set(80, 30, 80);
  scene.add(cloudMesh3);
}
