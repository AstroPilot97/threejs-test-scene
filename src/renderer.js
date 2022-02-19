import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import GUI from "lil-gui";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise.js";
import WebGL from "three/examples/jsm/capabilities/WebGL.js";
import Stats from "three/examples/jsm/libs/stats.module.js";

if (WebGL.isWebGL2Available() === false) {
  document.body.appendChild(WebGL.getWebGL2ErrorMessage());
}

// Global variables
let mixer, clock, controls, renderer, scene, camera, gui;
let sky, sun, cloudMesh, clouds, groundPlaneMesh;
let stats, textureLoader;

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

  // Texture loader
  textureLoader = new THREE.TextureLoader();

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

    document.getElementById("loader").style.display = "none";
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
  controls.maxDistance = 25;

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

  // Init ground plane
  initGroundPlane();
}

// Animate
function animate() {
  // Call tick again on the next frame
  requestAnimationFrame(animate);

  // Update objects
  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);
  if (clouds) {
    clouds.forEach((cloud) => {
      cloud.material.uniforms.cameraPos.value.copy(camera.position);
      cloud.material.uniforms.frame.value++;
      cloud.rotation.y = performance.now() / 20000;
      cloud.position.x += 0.03;
    });
  }

  if (groundPlaneMesh) groundPlaneMesh.position.x += 0.03;

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
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.bias = -0.0009;
  light.shadow.camera.left = -30;
  light.shadow.camera.right = 30;
  light.shadow.camera.top = 30;
  light.shadow.camera.bottom = -30;
  scene.add(light);

  const opposingLight = light.clone();
  opposingLight.castShadow = false;
  opposingLight.intensity = light.intensity - 2;
  scene.add(opposingLight);

  /// GUI
  const effectController = {
    turbidity: 5.5,
    rayleigh: 1.1,
    mieCoefficient: 0.008,
    mieDirectionalG: 0.975,
    elevation: 160,
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
    .add(effectController, "elevation", 30, 160, 0.1)
    .onChange(guiChanged);
  sunControls.add(light, "castShadow");

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
      opacity: { value: 0.4 },
      range: { value: 0.1 },
      steps: { value: 35 },
      frame: { value: 0 },
    },
    vertexShader: document.getElementById("cloudVS").textContent,
    fragmentShader: document.getElementById("cloudFS").textContent,
    side: THREE.BackSide,
    transparent: true,
  });

  clouds = [];

  for (let i = 0; i < 15; i++) {
    let xPos = THREE.MathUtils.randFloat(-1000, 1000);
    let yPos = THREE.MathUtils.randFloat(10, 150);
    let zPos = THREE.MathUtils.randFloat(-1000, 1000);
    let xScale = THREE.MathUtils.randFloat(100, 300);
    let yscale = THREE.MathUtils.randFloat(40, 80);
    let zScale = THREE.MathUtils.randFloat(100, 300);
    cloudMesh = new THREE.Mesh(geometry, material);
    cloudMesh.translateOnAxis(new THREE.Vector3(xPos, yPos, zPos), 1);
    cloudMesh.scale.set(xScale, yscale, zScale);
    cloudMesh.renderOrder = i;
    clouds.push(cloudMesh);
    scene.add(cloudMesh);
  }
}

function initGroundPlane() {
  const groundPlaneTex1 = textureLoader.load("textures/mountains/mntn-tex.jpg");
  const groundPlaneDisp1 = textureLoader.load(
    "textures/mountains/DisplacementMap.png"
  );
  groundPlaneTex1.wrapS = THREE.RepeatWrapping;
  groundPlaneTex1.wrapT = THREE.RepeatWrapping;
  groundPlaneDisp1.wrapS = THREE.RepeatWrapping;
  groundPlaneDisp1.wrapT = THREE.RepeatWrapping;
  groundPlaneTex1.repeat.set(16, 16);
  groundPlaneDisp1.repeat.set(16, 8);
  const groundPlaneGeo = new THREE.PlaneGeometry(4096, 4096, 24, 24);
  const groundPlaneMat1 = new THREE.MeshStandardMaterial({
    map: groundPlaneTex1,
    displacementMap: groundPlaneDisp1,
    displacementScale: 1024,
  });
  groundPlaneMesh = new THREE.Mesh(groundPlaneGeo, groundPlaneMat1);
  groundPlaneMesh.rotateX(-Math.PI / 2);
  groundPlaneMesh.translateOnAxis(new THREE.Vector3(0, -0, -100), 1);
  scene.add(groundPlaneMesh);
}
