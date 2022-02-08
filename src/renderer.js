import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import GUI from "lil-gui";
import { Sky } from "three/examples/jsm/objects/Sky.js";

// Global variables
let mixer, clock, controls, renderer, scene, camera, gui;
let sky, sun;

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
    100
  );
  camera.position.x = 0;
  camera.position.y = -5;
  camera.position.z = 15;
  scene.add(camera);

  // Controls
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = true;
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
}

// Animate
function animate() {
  // Call tick again on the next frame
  requestAnimationFrame(animate);

  // Update objects
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);

  // Update Orbital Controls
  controls.update();

  // Render
  renderer.render(scene, camera);

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

  const sunControls = gui.addFolder("Sun Controls");
  sunControls
    .add(effectController, "elevation", 0, 180, 0.1)
    .onChange(guiChanged);

  guiChanged();
}
