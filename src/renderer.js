import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import GUI from "lil-gui";

// Global variables
let mixer, clock, camera, scene, renderer, controls;

//Init scene
init();
animate();

function init() {
  // Clock
  clock = new THREE.Clock();

  // Textures loaders
  const textureLoader = new THREE.TextureLoader();

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
  });

  // Debug
  const gui = new GUI();

  // Canvas
  const canvas = document.querySelector("canvas.webgl");

  // Scene
  scene = new THREE.Scene();

  // Lights
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 4, 2);
  scene.add(directionalLight);

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
}

/**
 * Animate
 */
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
