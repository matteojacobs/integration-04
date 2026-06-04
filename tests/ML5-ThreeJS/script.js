import * as THREE from 'three';

let video;
let bodyPose;
let poses = [];

let scene, camera, renderer;
let cube;
let purse;
let keypointMeshes = [];

let currentPosition = new THREE.Vector3();

const debug = document.getElementById("debug");

//const MODEL = "BlazePose";
const MODEL = "MoveNet";

const CONFIDENCE_THRESHOLD = 0.2;


const setupWebcam = async () => {
  video = document.getElementById("video");

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 }
    },
    audio: false
  });

  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;

  return new Promise((resolve) => {
    video.onloadedmetadata = async () => {
      await video.play();

      video.width = video.videoWidth;
      video.height = video.videoHeight;

      console.log("Video real size:", video.videoWidth, video.videoHeight);
      console.log("Video element size:", video.width, video.height);

      resolve();
    };
  });
}

const setupThree = () => {
  const container = document.getElementById("three-container");

  scene = new THREE.Scene();

  camera = new THREE.OrthographicCamera(
    -window.innerWidth / 2,
    window.innerWidth / 2,
    window.innerHeight / 2,
    -window.innerHeight / 2,
    0.1,
    1000
  );

  camera.position.z = 500;

  renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2);
  keyLight.position.set(200, 300, 400);  // upper-right-front
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xffa040, 0.6);
  fillLight.position.set(-300, -100, 200);  // lower-left, warm
  scene.add(fillLight);

  const cubeGeo = new THREE.BoxGeometry(60, 60, 60);
  const cubeMat = new THREE.MeshNormalMaterial();

  cube = new THREE.Mesh(cubeGeo, cubeMat);
  purse = createPurse();
  cube.visible = false;
  scene.add(cube);
  scene.add(purse);

  for (let i = 0; i < 40; i++) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(7, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xebc357 })
    );

    dot.visible = false;
    scene.add(dot);
    keypointMeshes.push(dot);
  }

  window.addEventListener("resize", onResize);
}

const createPurse = () => {
  const purse = new THREE.Group();

  const mat = new THREE.MeshPhongMaterial({ color: 0xebc357 });

  const boxGeo = new THREE.BoxGeometry(120, 100, 40);
  const purseBase = new THREE.Mesh(boxGeo, mat);
  purse.add(purseBase);

  const postGeo = new THREE.CylinderGeometry(6, 6, 60, 16);
  const archGeo = new THREE.CylinderGeometry(6, 6, 100, 16);

  const postL = new THREE.Mesh(postGeo, mat);
  postL.position.set(-40, 80, 0);
  purse.add(postL);

  const postR = new THREE.Mesh(postGeo, mat);
  postR.position.set(40, 80, 0);
  purse.add(postR);

  const arch = new THREE.Mesh(archGeo, mat);
  arch.rotation.z = Math.PI / 2;
  arch.position.set(0, 110, 0);
  purse.add(arch);

  purse.rotation.x = 0.4;
  purse.rotation.y = -0.9;
  purse.scale.set(1.2, 1.2, 1.2);
  return purse;
};

const onResize = () => {
  camera.left = -window.innerWidth / 2;
  camera.right = window.innerWidth / 2;
  camera.top = window.innerHeight / 2;
  camera.bottom = -window.innerHeight / 2;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

const setupMl5 = async () => {
  debug.innerText = `Loading ${MODEL}...`;

  bodyPose = await ml5.bodyPose(MODEL, {
    flipped: true
  });

  console.log("Loaded bodyPose:", bodyPose);

  debug.innerText = `${MODEL} loaded. Waiting for pose...`;

  bodyPose.detectStart(video, gotPoses);
}

const gotPoses = (results) => {
  poses = results;

  if (poses.length > 0 && Math.random() < 0.02) {
    console.log("Pose example:", poses[0]);
    console.table(poses[0].keypoints);
  }
}

const getConfidence = (kp) => {
  return kp.confidence ?? kp.score ?? 0;
}

const getKeypoint = (pose, wantedName) => {
  if (!pose || !pose.keypoints) return null;

  return pose.keypoints.find((kp) => {
    return kp.name === wantedName || kp.part === wantedName;
  });
}

const normalizeKeypoint = (kp) => {
  let x = kp.x;
  let y = kp.y;

  // Some models/wrappers can return normalized values from 0 to 1.
  // If so, convert them to video pixels.
  if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
    x *= video.videoWidth;
    y *= video.videoHeight;
  }

  return { x, y };
}

const videoToWorld = (rawX, rawY) => {
  const videoAspect = video.videoWidth / video.videoHeight;
  const screenAspect = window.innerWidth / window.innerHeight;

  let drawnWidth;
  let drawnHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (screenAspect > videoAspect) {
    drawnWidth = window.innerWidth;
    drawnHeight = window.innerWidth / videoAspect;
    offsetY = (window.innerHeight - drawnHeight) / 2;
  } else {
    drawnHeight = window.innerHeight;
    drawnWidth = window.innerHeight * videoAspect;
    offsetX = (window.innerWidth - drawnWidth) / 2;
  }

  const screenX = (rawX / video.videoWidth) * drawnWidth + offsetX;
  const screenY = (rawY / video.videoHeight) * drawnHeight + offsetY;

  return new THREE.Vector3(
    screenX - window.innerWidth / 2,
    -(screenY - window.innerHeight / 2),
    0
  );
}

const hideTrackingObjects = () => {
  cube.visible = false;
  keypointMeshes.forEach((mesh) => {
    mesh.visible = false;
  });
}

const updateTracking = () => {
  if (!poses.length) {
    hideTrackingObjects();
    debug.innerText = `${MODEL}: no pose detected`;
    return;
  }

  const pose = poses[0];

  if (!pose.keypoints || pose.keypoints.length === 0) {
    hideTrackingObjects();
    debug.innerText = `${MODEL}: pose found, but no keypoints`;
    return;
  }

  debug.innerText = `${MODEL}: ${pose.keypoints.length} keypoints`;

  pose.keypoints.forEach((kp, i) => {
    const dot = keypointMeshes[i];
    if (!dot) return;

    const confidence = getConfidence(kp);

    if (confidence < CONFIDENCE_THRESHOLD) {
      dot.visible = false;
      return;
    }

    const { x, y } = normalizeKeypoint(kp);
    const pos = videoToWorld(x, y);

    dot.position.copy(pos);
    dot.visible = true;
  });


  // const nose = getKeypoint(pose, "nose");

  // if (!nose) {
  //   cube.visible = false;
  //   debug.innerText += "\nNo nose keypoint";
  //   return;
  // }

  // const noseConfidence = getConfidence(nose);

  // if (noseConfidence < CONFIDENCE_THRESHOLD) {
  //   cube.visible = false;
  //   debug.innerText += `\nNose confidence too low: ${noseConfidence.toFixed(2)}`;
  //   return;
  // }

  // const { x, y } = normalizeKeypoint(nose);
  // const target = videoToWorld(x, y);

  // cube.visible = true;

  // if (currentPosition.length() === 0) {
  //   currentPosition.copy(target);
  // }

  // currentPosition.lerp(target, 0.35);
  // cube.position.copy(currentPosition);

  // cube.rotation.x += 0.02;
  // cube.rotation.y += 0.03;

  // debug.innerText += `\nNose: x=${x.toFixed(1)}, y=${y.toFixed(1)}, conf=${noseConfidence.toFixed(2)}`;
}

const updateTrackingPurse = () => {

  const pose = poses[0];

  if (!pose.keypoints || pose.keypoints.length === 0) {
    hideTrackingObjects();
    debug.innerText = `${MODEL}: pose found, but no keypoints`;
    return;
  }


  const shoulder = getKeypoint(pose, "left_shoulder");
  const confidence = getConfidence(shoulder);

  if (confidence < CONFIDENCE_THRESHOLD) {
    purse.visible = false;
    return;
  }

  const { x, y } = normalizeKeypoint(shoulder);
  const target = videoToWorld(x, y);

  target.y -= 200;
  target.z = 0;

  purse.visible = true;

  if (currentPosition.length() === 0) {
    currentPosition.copy(target);
  }

  currentPosition.lerp(target, 0.35);
  purse.position.copy(currentPosition);

}

const animate = () => {
  requestAnimationFrame(animate);

  updateTracking();
  updateTrackingPurse();

  renderer.render(scene, camera);
}

const main = async () => {
  await setupWebcam();
  setupThree();
  await setupMl5();
  animate();
}

main();