const STATE_LOADING = "loading";
const STATE_RUNNING = "running";
const ALL_STATES = [STATE_LOADING, STATE_RUNNING];
let state = STATE_LOADING;
let $state;
let $canvas;
let video, ctx;
let poses = [];
let bodyPose;
let bagImage;

const KEYPOINT_CONFIDENCE = 0.2;
const BAG_SIZE = 80;


//Performance Monitoring
let frameCount = 0;
let lastFPSTime = performance.now();

const setState = (value) => {
  console.log('setState', value);
  state = value;
  $state.textContent = state;
  document.documentElement.classList.remove(...ALL_STATES);
  document.documentElement.classList.add(state);
};

const preload = async () => {
  setState(STATE_LOADING);
  requestAnimationFrame(draw);
  bagImage = new Image();
  bagImage.src = 'bag.png';
  //bodyPose = await ml5.bodyPose();
  bodyPose = await ml5.bodyPose("BlazePose");
  console.log('model ready');
  setup();
}

const setup = async () => {
  console.log('setup');
  ctx = $canvas.getContext('2d');
  // create a video stream - specify a fixed size
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: 640,
      height: 480
    }
  });
  video = document.createElement('video');
  video.srcObject = stream;
  video.play();
  // set canvas & video size
  $canvas.width = video.width = 640;
  $canvas.height = video.height = 480;
  // start detecting poses

  bodyPose.detectStart(video, (results) => {
    // store the result in a global
    poses = results;
  });
  // start the app
  setState(STATE_RUNNING);
}

const draw = () => {

  frameCount++;
  const currentTime = performance.now();

  // Log FPS every second
  if (currentTime - lastFPSTime >= 1000) {
    console.log(`FPS: ${frameCount}`);
    frameCount = 0;
    lastFPSTime = currentTime;
  }


  if (state === STATE_RUNNING) {
    ctx.save();
    ctx.translate($canvas.width, 0);
    ctx.scale(-1, 1);

    ctx.drawImage(video, 0, 0, $canvas.width, $canvas.height);
    ctx.fillStyle = 'red';
    poses.forEach(pose => {
      pose.keypoints.forEach(keypoint => {
        if (keypoint.confidence > KEYPOINT_CONFIDENCE) {
          ctx.beginPath();
          ctx.arc(keypoint.x, keypoint.y, 8, 0, 2 * Math.PI);
          ctx.fill();
        }
      });

      const leftWrist = pose.keypoints.find(
        (keypoint) => keypoint.name === 'left_wrist' && keypoint.confidence > KEYPOINT_CONFIDENCE
      );
      const rightWrist = pose.keypoints.find(
        (keypoint) => keypoint.name === 'right_wrist' && keypoint.confidence > KEYPOINT_CONFIDENCE
      );

      if (bagImage && bagImage.complete) {
        if (leftWrist) {
          ctx.drawImage(
            bagImage,
            leftWrist.x - BAG_SIZE / 2,
            leftWrist.y - BAG_SIZE / 2,
            BAG_SIZE,
            BAG_SIZE
          );
        }

        if (rightWrist) {
          ctx.drawImage(
            bagImage,
            rightWrist.x - BAG_SIZE / 2,
            rightWrist.y - BAG_SIZE / 2,
            BAG_SIZE,
            BAG_SIZE
          );
        }
      }
    });

    ctx.restore();
  }
  requestAnimationFrame(draw);
}


const init = () => {
  $canvas = document.querySelector('#canvas');
  $state = document.querySelector('#state');
  preload();
}
init();