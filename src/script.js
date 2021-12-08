import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import * as dat from "dat.gui";
import Stats from "three/examples/jsm/libs/stats.module.js";

// Global variables
const ENTIRE_SCENE = 0,
  BLOOM_SCENE = 1;

// Textures loaders
const textureLoader = new THREE.TextureLoader();
const roadTexture = textureLoader.load("/textures/road/road.jpg");
const roadNormalMap = textureLoader.load("/textures/road/road_normal.png");
const sidewalkTexture = textureLoader.load(
  "/textures/pavement/pavement_texture.png"
);
const sidewalkNormal = textureLoader.load(
  "/textures/pavement/pavement_normal.png"
);
const sidewalkHeight = textureLoader.load(
  "/textures/pavement/pavement_height.png"
);
const sidewalkRoughness = textureLoader.load(
  "/textures/pavement/pavement_roughness.png"
);
const sidewalkAo = textureLoader.load("/textures/pavement/pavement_ao.png");
sidewalkTexture.wrapS = THREE.RepeatWrapping;
sidewalkTexture.wrapT = THREE.RepeatWrapping;
sidewalkNormal.wrapS = THREE.RepeatWrapping;
sidewalkNormal.wrapT = THREE.RepeatWrapping;
sidewalkHeight.wrapS = THREE.RepeatWrapping;
sidewalkHeight.wrapT = THREE.RepeatWrapping;
sidewalkRoughness.wrapS = THREE.RepeatWrapping;
sidewalkRoughness.wrapT = THREE.RepeatWrapping;
sidewalkAo.wrapS = THREE.RepeatWrapping;
sidewalkAo.wrapT = THREE.RepeatWrapping;
sidewalkTexture.repeat.set(1, 16);
sidewalkNormal.repeat.set(1, 16);
sidewalkRoughness.repeat.set(1, 16);
sidewalkAo.repeat.set(1, 16);
sidewalkHeight.repeat.set(1, 16);

roadNormalMap.wrapS = THREE.RepeatWrapping;
roadNormalMap.wrapT = THREE.RepeatWrapping;
roadTexture.wrapS = THREE.RepeatWrapping;
roadTexture.wrapT = THREE.RepeatWrapping;
roadTexture.repeat.set(2, 12);
roadNormalMap.repeat.set(2, 12);

function createCloudPathStrings(fileName) {
  const basePath = "../textures/cloudy_afternoon/";
  const baseFilename = basePath + fileName;
  const fileType = ".bmp";
  const sides = ["ft", "bk", "up", "dn", "rt", "lf"];
  const pathStings = sides.map((side) => {
    return baseFilename + "_" + side + fileType;
  });
  return pathStings;
}

const skyboxImage = "sky";

function createMaterialArray(fileName) {
  const skyboxImagePaths = createCloudPathStrings(fileName);
  const materialArray = skyboxImagePaths.map((image) => {
    let texture = new THREE.TextureLoader().load(image);
    return new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
    });
  });
  return materialArray;
}

// Model loaders
const gltfLoader = new GLTFLoader();

gltfLoader.load(
  "/models/renault_logan/scene.gltf",
  function (gltf) {
    gltf.scene.scale.set(0.3, 0.3, 0.3);
    gltf.scene.rotateZ(0.18);
    gltf.scene.translateOnAxis(new THREE.Vector3(1, -0.12, 0), 1);
    gltf.scene.traverse(function (node) {
      if (node.isMesh) {
        node.castShadow = true;
      }
    });
    scene.add(gltf.scene);
  },
  undefined,
  function (error) {
    console.error(error);
  }
);

let curbPlacementConfig = [
  [1.35, 0.13, 7.1],
  [1.35, 0.13, 3],
  [1.35, 0.13, -2],
  [1.35, 0.13, -7.1],
  [-1.35, 0.14, -7.1],
  [-1.35, 0.14, -2],
  [-1.35, 0.14, 3],
  [-1.35, 0.14, 7.1],
];

gltfLoader.load(
  "/models/rocky_curb/scene.gltf",
  function (gltf) {
    gltf.scene.traverse(function (node) {
      if (node.isMesh) {
        var instancedCurb = new THREE.InstancedMesh(
          node.geometry,
          node.material,
          8
        );

        for (let i = 0; i < curbPlacementConfig.length; i++) {
          var dummy = new THREE.Object3D();
          dummy.scale.set(2, 1, 1);
          dummy.position.set(
            curbPlacementConfig[i][0],
            curbPlacementConfig[i][1],
            curbPlacementConfig[i][2]
          );
          if (i < 4) {
            dummy.rotation.set(0, -1.57, Math.PI);
          } else {
            dummy.rotation.set(0, 1.57, Math.PI);
          }
          dummy.updateMatrix();
          instancedCurb.setMatrixAt(i, dummy.matrix);
        }
        instancedCurb.receiveShadow = true;
        instancedCurb.frustumCulled = true;
        scene.add(instancedCurb);
      }
    });
  },
  undefined,
  function (error) {
    console.error(error);
  }
);

gltfLoader.load(
  "/models/street_lamp/scene.gltf",
  function (gltf) {
    gltf.scene.translateOnAxis(new THREE.Vector3(1.5, 0.1, 2), 1);
    gltf.scene.scale.set(0.05, 0.05, 0.05);
    gltf.scene.traverse(function (node) {
      if (node.isMesh) {
        node.castShadow = true;
      }
    });
    scene.add(gltf.scene);
  },
  undefined,
  function (error) {
    console.error(error);
  }
);

// Debug
const gui = new dat.GUI();

// Canvas
const canvas = document.querySelector("canvas.webgl");

// Scene
const scene = new THREE.Scene();

// Objects
const skyBoxGeometry = new THREE.BoxGeometry(100, 100, 100, 24, 24, 24);
const roadGeometry = new THREE.PlaneBufferGeometry(2.5, 19.8, 64, 64);
const sidewalkGeometry = new THREE.PlaneBufferGeometry(1.2, 19.8, 64, 64);
const lightSphereGeo = new THREE.SphereGeometry(0.06, 32, 16);

// Materials
const materials = {};
const materialArray = createMaterialArray(skyboxImage);
const darkMaterial = new THREE.MeshBasicMaterial({ color: "black" });
const roadMaterial = new THREE.MeshStandardMaterial({
  color: "gray",
  map: roadTexture,
  normalMap: roadNormalMap,
});

const sidewalkMaterial = new THREE.MeshStandardMaterial({
  map: sidewalkTexture,
  normalMap: sidewalkNormal,
  roughnessMap: sidewalkRoughness,
  displacementMap: sidewalkHeight,
  displacementScale: 0.1,
  aoMap: sidewalkAo,
});

const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffbb });

// Mesh
const skybox = new THREE.Mesh(skyBoxGeometry, materialArray);
scene.add(skybox);

const road = new THREE.Mesh(roadGeometry, roadMaterial);
scene.add(road);
road.rotation.x = -(Math.PI / 2);
road.receiveShadow = true;

const sidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial);
const sidewalk2 = sidewalk.clone();

scene.add(sidewalk);
sidewalk.translateOnAxis(new THREE.Vector3(1.95, 0.081, 0), 1);
sidewalk.rotateX(-(Math.PI / 2));
sidewalk.receiveShadow = true;

scene.add(sidewalk2);
sidewalk2.translateOnAxis(new THREE.Vector3(-1.95, 0.081, 0), 1);
sidewalk2.rotateX(-(Math.PI / 2));
sidewalk2.receiveShadow = true;

const lightSphere = new THREE.Mesh(lightSphereGeo, lightMaterial);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.x = 1.285;
pointLight.position.y = 2.05;
pointLight.position.z = 2;
pointLight.castShadow = true;
pointLight.shadow.mapSize.width = 2048;
pointLight.shadow.mapSize.height = 2048;
pointLight.shadow.camera.near = 0.5;
pointLight.shadow.camera.far = 500;
pointLight.shadow.bias = -0.0001;
pointLight.add(lightSphere);
lightSphere.layers.enable(BLOOM_SCENE);
scene.add(pointLight);

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
const camera = new THREE.PerspectiveCamera(
  75,
  sizes.width / sizes.height,
  0.1,
  100
);
camera.position.x = 0;
camera.position.y = 2;
camera.position.z = 5;
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enablePan = true;
controls.enableKeys = true;

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  alpha: true,
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.info.autoReset = false;

// Post-processing

const bloomLayer = new THREE.Layers();
bloomLayer.set(BLOOM_SCENE);

const params = {
  exposure: 1,
  bloomStrength: 5,
  bloomThreshold: 0,
  bloomRadius: 0,
};

const renderScene = new RenderPass(scene, camera);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.5,
  0.4,
  0.85
);
bloomPass.threshold = params.bloomThreshold;
bloomPass.strength = params.bloomStrength;
bloomPass.radius = params.bloomRadius;

const bloomComposer = new EffectComposer(renderer);
bloomComposer.renderToScreen = false;
bloomComposer.addPass(renderScene);
bloomComposer.addPass(bloomPass);

const finalPass = new ShaderPass(
  new THREE.ShaderMaterial({
    uniforms: {
      baseTexture: { value: null },
      bloomTexture: { value: bloomComposer.renderTarget2.texture },
    },
    vertexShader: document.getElementById("vertexshader").textContent,
    fragmentShader: document.getElementById("fragmentshader").textContent,
    defines: {},
  }),
  "baseTexture"
);
finalPass.needsSwap = true;

const finalComposer = new EffectComposer(renderer);
finalComposer.addPass(renderScene);
finalComposer.addPass(finalPass);

// Stats

const stats = new Stats();
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

const rendererStats = RendererStats();
rendererStats.domElement.style.position = "absolute";
rendererStats.domElement.style.left = "0px";
rendererStats.domElement.style.bottom = "0px";
document.body.appendChild(rendererStats.domElement);
/**
 * Animate
 */

const clock = new THREE.Clock();

const tick = () => {
  const elapsedTime = clock.getElapsedTime();
  // Update objects

  // Update Orbital Controls
  controls.update();

  // Render
  renderBloom(true);
  finalComposer.render();

  // Performance analysis
  stats.update();
  rendererStats.update(renderer);
  renderer.info.reset();

  // Call tick again on the next frame
  requestAnimationFrame(tick);
};

tick();

function renderBloom(mask) {
  if (mask === true) {
    scene.traverse(darkenNonBloomed);
    bloomComposer.render();
    scene.traverse(restoreMaterial);
  } else {
    camera.layers.set(BLOOM_SCENE);
    bloomComposer.render();
    camera.layers.set(ENTIRE_SCENE);
  }
}

function darkenNonBloomed(obj) {
  if (obj.isMesh && bloomLayer.test(obj.layers) === false) {
    materials[obj.uuid] = obj.material;
    obj.material = darkMaterial;
  }
}

function restoreMaterial(obj) {
  if (materials[obj.uuid]) {
    obj.material = materials[obj.uuid];
    delete materials[obj.uuid];
  }
}

function RendererStats() {
  var msMin = 100;
  var msMax = 0;

  var container = document.createElement("div");
  container.style.cssText = "width:150px;opacity:0.9;cursor:pointer";

  var msDiv = document.createElement("div");
  msDiv.style.cssText =
    "padding:0 0 3px 3px;text-align:left;background-color:#200;";
  container.appendChild(msDiv);

  var msText = document.createElement("div");
  msText.style.cssText =
    "color:#f00;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:bold;line-height:15px";
  msText.innerHTML = "WebGLRenderer";
  msDiv.appendChild(msText);

  var msTexts = [];
  var nLines = 6;
  for (var i = 0; i < nLines; i++) {
    msTexts[i] = document.createElement("div");
    msTexts[i].style.cssText =
      "color:#f00;background-color:#311;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:bold;line-height:15px";
    msDiv.appendChild(msTexts[i]);
    msTexts[i].innerHTML = "-";
  }

  var lastTime = Date.now();
  return {
    domElement: container,

    update: function (webGLRenderer) {
      // sanity check
      console.assert(webGLRenderer instanceof THREE.WebGLRenderer);

      // refresh only 30time per second
      if (Date.now() - lastTime < 1000 / 30) return;
      lastTime = Date.now();

      var i = 0;
      msTexts[i++].textContent = "== Memory =====";
      msTexts[i++].textContent =
        "Geometries: " + webGLRenderer.info.memory.geometries;
      msTexts[i++].textContent =
        "Textures: " + webGLRenderer.info.memory.textures;
      msTexts[i++].textContent = "== Render =====";
      msTexts[i++].textContent = "Calls: " + webGLRenderer.info.render.calls;
      msTexts[i++].textContent = "Points: " + webGLRenderer.info.render.points;
    },
  };
}
