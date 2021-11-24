import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as dat from "dat.gui";

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
sidewalkTexture.repeat.set(1, 8);
sidewalkNormal.repeat.set(1, 8);
sidewalkRoughness.repeat.set(1, 8);
sidewalkAo.repeat.set(1, 8);
sidewalkHeight.repeat.set(1, 8);

roadNormalMap.wrapS = THREE.RepeatWrapping;
roadNormalMap.wrapT = THREE.RepeatWrapping;
roadTexture.wrapS = THREE.RepeatWrapping;
roadTexture.wrapT = THREE.RepeatWrapping;
roadTexture.repeat.set(2, 4);
roadNormalMap.repeat.set(2, 4);

function createCloudPathStrings(fileName) {
  const basePath = "../textures/clouds1/";
  const baseFilename = basePath + fileName;
  const fileType = ".bmp";
  const sides = ["Right", "Left", "Top", "Bottom", "Front", "Back"];
  const pathStings = sides.map((side) => {
    return baseFilename + "_" + side + fileType;
  });
  return pathStings;
}

const skyboxImage = "Daylight Box";

function createMaterialArray(fileName) {
  const skyboxImagePaths = createCloudPathStrings(fileName);
  // const materialArray = skyboxImagePaths.map((image) => {
  //   let texture = new THREE.TextureLoader().load(image);
  //   return new THREE.MeshBasicMaterial({
  //     map: texture,
  //     side: THREE.BackSide,
  //   });
  // });
  // return materialArray;
}

// Model loaders
const gltfLoader = new GLTFLoader();

gltfLoader.load(
  "/models/renault_logan/scene.gltf",
  function (gltf) {
    gltf.scene.scale.set(0.3, 0.3, 0.3);
    gltf.scene.rotateZ(0.18);
    gltf.scene.translateX(1);
    gltf.scene.translateY(-0.12);
    gltf.scene.traverse(function (node) {
      console.log("node: ", node);
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

let curbConfig = [
  new THREE.Vector3(1.4, 0, -1.23),
  new THREE.Vector3(-1.4, 0, -1.23),
];

for (let i = 0; i < 2; i++) {
  gltfLoader.load(
    "/models/rocky_curb/scene.gltf",
    function (gltf) {
      gltf.scene.rotateY(-1.57);
      gltf.scene.translateOnAxis(curbConfig[i], 1);
      gltf.scene.scale.set(1.05, 1, 1);
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
}

// Debug
const gui = new dat.GUI();

// Canvas
const canvas = document.querySelector("canvas.webgl");

// Scene
const scene = new THREE.Scene();

// Objects
const roadGeometry = new THREE.PlaneBufferGeometry(2.5, 5.68, 64, 64);
const sidewalkGeometry = new THREE.PlaneBufferGeometry(0.8, 5.68, 64, 64);
const skyBoxGeometry = new THREE.BoxGeometry(100, 100, 100, 24, 24, 24);

// Materials
const roadMaterial = new THREE.MeshStandardMaterial({
  color: "gray",
  map: roadTexture,
  normalMap: roadNormalMap,
});

const materialArray = createMaterialArray(skyboxImage);
const sidewalkMaterial = new THREE.MeshStandardMaterial({
  map: sidewalkTexture,
  normalMap: sidewalkNormal,
  roughnessMap: sidewalkRoughness,
  displacementMap: sidewalkHeight,
  displacementScale: 0.1,
  aoMap: sidewalkAo,
});

// Mesh
const road = new THREE.Mesh(roadGeometry, roadMaterial);
scene.add(road);
road.rotation.x = -(Math.PI / 2);
road.receiveShadow = true;

const skybox = new THREE.Mesh(skyBoxGeometry, materialArray);
scene.add(skybox);

const sidewalk = new THREE.Mesh(sidewalkGeometry, sidewalkMaterial);
scene.add(sidewalk);
sidewalk.translateY(0.081);
sidewalk.translateX(1.75);
sidewalk.rotateX(-(Math.PI / 2));

// Lights
const pointLight = new THREE.PointLight(0xffffff, 1.5);
pointLight.position.x = 1.7;
pointLight.position.y = 2;
pointLight.position.z = 1.5;
pointLight.castShadow = true;
pointLight.shadow.mapSize.width = 1024; // default
pointLight.shadow.mapSize.height = 1024; // default
pointLight.shadow.camera.near = 0.5; // default
pointLight.shadow.camera.far = 500; // default
scene.add(pointLight);

const pointLightHelper = new THREE.PointLightHelper(pointLight, 1);
scene.add(pointLightHelper);

gui.add(pointLight.position, "x", -100, 100, 0.1);
gui.add(pointLight.position, "y", -100, 100, 0.1);
gui.add(pointLight.position, "z", -100, 100, 0.1);

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
camera.position.y = 1;
camera.position.z = 2;
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

/**
 * Animate
 */

const clock = new THREE.Clock();

const tick = () => {
  const elapsedTime = clock.getElapsedTime();
  // Update objects
  // plane.rotation.z = 1 * elapsedTime;
  // skybox.rotation.y = 1 * elapsedTime;

  // Update Orbital Controls
  controls.update();

  // Render
  renderer.render(scene, camera);

  // Call tick again on the next frame
  window.requestAnimationFrame(tick);
};

tick();
