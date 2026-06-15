import { POVS } from "../data/povs";
import {
  lensState,
  resetLensStateForPov,
} from "../state/lensState";

import {
  bootstrapCameraKit,
  createExtension,
  Injectable,
  remoteApiServicesFactory,
  type CameraKit,
  type CameraKitSession,
  type RemoteApiRequest,
  type RemoteApiResponse,
  type RemoteApiService,
} from "@snap/camera-kit";

import { sendCurrentPovToRemote, setOnRemoteConnected } from "./script-webrtc";

let cameraKit: CameraKit;
let session: CameraKitSession;

let currentIndex = 0;
let isSwitching = false;

const API_TOKEN = import.meta.env.VITE_API_KEY;
const groupID = import.meta.env.VITE_GROUP_ID;
const OBJECT_API_SPEC_ID = import.meta.env.VITE_OBJECT_API_SPEC_ID;


const encoder = new TextEncoder();

const remoteApiService: RemoteApiService = {
  apiSpecId: OBJECT_API_SPEC_ID,

  getRequestHandler(request: RemoteApiRequest) {
    // console.log("Remote API request from lens:", {
    //   apiSpecId: request.apiSpecId,
    //   endpointId: request.endpointId,
    //   parameters: request.parameters,
    // });

    if (request.endpointId !== "getState") {
      console.warn("Unknown endpoint:", request.endpointId);
      return undefined;
    }

    return (reply: (response: RemoteApiResponse) => void) => {
      const body = JSON.stringify(lensState);


      reply({
        status: "success",
        metadata: {},
        body: encoder.encode(body).buffer,
      });
    };
  },
};


async function initCameraKit() {
  if (!OBJECT_API_SPEC_ID) {
    throw new Error("Missing VITE_OBJECT_API_SPEC_ID in .env");
  }

  console.log("Using Remote API Spec ID:", OBJECT_API_SPEC_ID);

  const remoteApiExtension = createExtension().provides(
    Injectable(
      remoteApiServicesFactory.token,
      [] as const,
      () => [remoteApiService]
    )
  );

  cameraKit = await bootstrapCameraKit(
    {
      apiToken: API_TOKEN,
      // logger: "console", //turn on if everything needs to be logged
    },
    (container: any) => container.provides(remoteApiExtension)
  );
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
      width: { ideal: 1080 },
      height: { ideal: 1490 },
      frameRate: { ideal: 30, max: 30 },
    },
    audio: false,
  });

  await session.setSource(mediaStream);
  await session.setFPSLimit(30);
}

function updatePovText() {
  const beforeElement = document.getElementById("povTextBefore");
  const greenElement = document.getElementById("povTextGreen");
  const afterElement = document.getElementById("povTextAfter");  

  const currentPov = POVS[currentIndex];

  if (!beforeElement || !greenElement || !afterElement) return;

  beforeElement.textContent = currentPov.povText.before;
  greenElement.textContent = currentPov.povText.green;
  afterElement.textContent = currentPov.povText.after ?? "";
}

async function applyCurrentLens() {
  if (isSwitching) return;

  isSwitching = true;

  const currentPov = POVS[currentIndex];

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
  currentIndex = (currentIndex + 1) % POVS.length;

  resetLensStateForPov(currentIndex);

  await applyCurrentLens();

  sendCurrentPovToRemote(POVS[currentIndex]);
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
  resetLensStateForPov(currentIndex);
  setOnRemoteConnected(() => {
    sendCurrentPovToRemote(POVS[currentIndex]);
  });

  await applyCurrentLens();

  await session.play();
  console.log('Session services:', (session as any).remoteApiServices);

  setupKeyboardControls();
}

startApp().catch((error) => {
  console.error('Something went wrong while starting the app:', error);
});