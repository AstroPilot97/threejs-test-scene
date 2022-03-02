import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import GUI from "lil-gui";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { ImprovedNoise } from "three/examples/jsm/math/ImprovedNoise.js";
import {
  BlendFunction,
  KernelSize,
  EffectComposer,
  EffectPass,
  BloomEffect,
  RenderPass,
  DepthOfFieldEffect,
} from "postprocessing";
import WebGL from "three/examples/jsm/capabilities/WebGL.js";
import Stats from "three/examples/jsm/libs/stats.module.js";

if (WebGL.isWebGL2Available() === false) {
  document.body.appendChild(WebGL.getWebGL2ErrorMessage());
}

// Global variables
let clock, controls, renderer, scene, camera, gui;
let sky, sun, cloudMesh, clouds, groundPlaneMesh;
let stats, textureLoader, gltfLoader;
let mixers = [];
let renderScene, composer;

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
  gltfLoader = new GLTFLoader();
  loadBalloonModels();

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
    3000
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
  controls.enablePan = true;
  controls.enableKeys = true;
  controls.maxDistance = 25;

  /**
   * Renderer
   */
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: false,
    stencil: false,
    depth: false,
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

  // Init post-processing
  initPostProcessing();
}

// Animate
function animate() {
  // Call tick again on the next frame
  requestAnimationFrame(animate);

  // Update objects
  const delta = clock.getDelta();
  if (mixers) {
    mixers.forEach((mixer) => {
      mixer.update(delta);
    });
  }
  if (clouds) {
    clouds.forEach((cloud) => {
      cloud.material.uniforms.cameraPos.value.copy(camera.position);
      cloud.material.uniforms.frame.value++;
      cloud.position.x += 0.03;
    });
  }

  if (groundPlaneMesh) groundPlaneMesh.position.x += 0.03;

  // Update Orbital Controls
  controls.update();

  // Render
  composer.render(delta);

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

// Balloons
function loadBalloonModels() {
  let balloonPlacements = [
    new THREE.Vector3(0, 5, 0),
    new THREE.Vector3(25, 15, -25),
    new THREE.Vector3(14, -5, 28),
    new THREE.Vector3(-20, 7, -19),
    new THREE.Vector3(-30, 10, 35),
    new THREE.Vector3(-60, -10, 35),
    new THREE.Vector3(-80, -8, -15),
  ];

  for (let i = 0; i < balloonPlacements.length; i++) {
    gltfLoader.load("models/peachy_balloon/scene.glb", (gltf) => {
      const model = gltf.scene;
      model.scale.set(0.005, 0.005, 0.005);
      model.rotateY(Math.PI);
      model.translateOnAxis(balloonPlacements[i], 1);
      const mixer = new THREE.AnimationMixer(gltf.scene);
      gltf.animations.forEach((clip) => {
        mixer.clipAction(clip).play();
      });
      mixers.push(mixer);

      model.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      scene.add(model);
      if (i == balloonPlacements.length - 1) {
        document.getElementById("loader").style.display = "none";
      }
    });
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
      opacity: { value: 0.3 },
      range: { value: 0.05 },
      steps: { value: 30 },
      frame: { value: 0 },
    },
    vertexShader: document.getElementById("cloudVS").textContent,
    fragmentShader: document.getElementById("cloudFS").textContent,
    side: THREE.BackSide,
    transparent: true,
  });

  clouds = [];

  const cloudPlacement = [
    new THREE.Vector3(-1156, 69, -270),
    new THREE.Vector3(547, 55, 957),
    new THREE.Vector3(-239, 103, 521),
    new THREE.Vector3(398, 52, -197),
    new THREE.Vector3(-169, 46, -74),
    new THREE.Vector3(-150, 1, 63),
  ];

  const cloudScaling = [
    [913, 194, 1061],
    [1526, 306, 1152],
    [470, 220, 442],
    [914, 82, 643],
    [281, 73, 297],
    [97, 40, 113],
  ];

  for (let i = 0; i < cloudPlacement.length; i++) {
    cloudMesh = new THREE.Mesh(geometry, material);
    cloudMesh.translateOnAxis(cloudPlacement[i], 1);
    cloudMesh.scale.set(
      cloudScaling[i][0],
      cloudScaling[i][1],
      cloudScaling[i][2]
    );
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
  groundPlaneTex1.anisotropy = 16;
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
  groundPlaneMesh.translateOnAxis(new THREE.Vector3(-300, -0, -100), 1);
  scene.add(groundPlaneMesh);
}

function initPostProcessing() {
  renderScene = new RenderPass(scene, camera);
  composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  initBloom();
  initDepthOfField();
}

function initBloom() {
  const bloomOptions = {
    blendFunction: BlendFunction.SCREEN,
    kernelSize: KernelSize.MEDIUM,
    luminanceThreshold: 0.65,
    luminanceSmoothing: 0.2,
    height: 480,
  };
  const bloomPass = new EffectPass(camera, new BloomEffect(bloomOptions));
  composer.addPass(bloomPass);
}

function initDepthOfField() {
  const depthOfFieldEffect = new DepthOfFieldEffect(camera, {
    focusDistance: 0.0,
    focalLength: 0.038,
    bokehScale: 2.0,
    height: 480,
  });
  const dofPass = new EffectPass(camera, depthOfFieldEffect);
  dofPass.renderToScreen = true;
  composer.addPass(dofPass);
}
