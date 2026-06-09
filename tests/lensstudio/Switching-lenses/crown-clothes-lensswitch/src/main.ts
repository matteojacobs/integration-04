import { bootstrapCameraKit, type CameraKit, type CameraKitSession } from '@snap/camera-kit';

type PovLens = {
  name: string;
  lensId: string;
  povText: string;
};


const POV_LENSES: PovLens[] = [
  {
    name: 'Main Character',
    lensId: import.meta.env.VITE_LENS_ID_1,
    povText: 'your outfit already decided this is your city',
  },
  {
    name: 'Raver-test',
    lensId: import.meta.env.VITE_LENS_ID_2,
    povText: 'You came for a citytrip and accidentally saw the sunrise twice.',
  },
];

let cameraKit: CameraKit;
let session: CameraKitSession;

let currentIndex = 0;
let isSwitching = false;

const API_TOKEN = import.meta.env.VITE_API_KEY;
const groupID = import.meta.env.VITE_GROUP_ID;


async function initCameraKit() {
  cameraKit = await bootstrapCameraKit({
    apiToken: API_TOKEN,
  });
}

function getCanvas(): HTMLCanvasElement {
  const canvas = document.getElementById('canvas');

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Canvas element not found');
  }

  return canvas;
}

async function createCameraSession() {
  const canvas = getCanvas();

  session = await cameraKit.createSession({
    liveRenderTarget: canvas,
  });
}

async function setupCameraSource() {
  const mediaStream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 1000 },
      height: { ideal: 600 },
      frameRate: { ideal: 30, max: 30 },
    },
    audio: false,
  });

  await session.setSource(mediaStream);
  await session.setFPSLimit(30);
}

function updatePovText() {
  const povTextElement = document.getElementById('povText');
  const currentPov = POV_LENSES[currentIndex];

  if (povTextElement) {
    povTextElement.textContent = currentPov.povText;
  }
}

async function applyCurrentLens() {
  if (isSwitching) return;

  isSwitching = true;

  const currentPov = POV_LENSES[currentIndex];

  console.log(`Applying POV: ${currentPov.name}`);

  updatePovText();

  try {
    const lens = await cameraKit.lensRepository.loadLens(
      currentPov.lensId,
      groupID
    );

    await session.applyLens(lens);
  } catch (error) {
    console.error(`Could not apply lens: ${currentPov.name}`, error);
  } finally {
    isSwitching = false;
  }
}

async function nextPov() {
  currentIndex = (currentIndex + 1) % POV_LENSES.length;
  await applyCurrentLens();
}

function setupKeyboardControls() {
  window.addEventListener('keydown', async (event) => {
    if (event.key.toLowerCase() === 'n') {
      await nextPov();
    }
  });
}

async function startApp() {
  await initCameraKit();
  await createCameraSession();
  await setupCameraSource();

  await applyCurrentLens();

  await session.play();

  setupKeyboardControls();
}

startApp().catch((error) => {
  console.error('Something went wrong while starting the app:', error);
});

