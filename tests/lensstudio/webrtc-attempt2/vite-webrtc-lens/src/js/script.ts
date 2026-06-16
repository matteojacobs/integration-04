import { io, Socket } from "socket.io-client";
import qrcode from "qrcode-generator";

import {
  bootstrapCameraKit, type CameraKit, type CameraKitSession,
  // type RemoteApiRequest,
  //type RemoteApiResponse
} from '@snap/camera-kit';

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
// const OUTFIT_API_SPEC_ID = import.meta.env.VITE_OUTFIT_API_SPEC_ID;

type OnMessage = {
  type: "pantsYes";
};

type OffMessage = {
  type: "pantsNo";
};

type PeerMessage = OnMessage | OffMessage;

type SignalData = {
  type?: string;
  candidate?: unknown;
  [key: string]: unknown;
};

const $url = document.getElementById("url") as HTMLAnchorElement;
const $pants = document.getElementById("pants") as HTMLElement;
const $qr = document.getElementById("qr") as HTMLElement;
const $welcome = document.getElementById("welcome") as HTMLElement;


let socket: Socket;
let peer: any = null;

const servers: RTCConfiguration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

const init = (): void => {
  if (!$url || !$pants || !$qr) {
    console.error("DESKTOP missing HTML element");
    return;
  }

  initSocket();
};

const initSocket = (): void => {
  socket = io(import.meta.env.VITE_SOCKET_URL);

  socket.on("connect", () => {
    console.log("DESKTOP socket connected:", socket.id);

    if (!$url || !$qr) return;

    const clientUrl = import.meta.env.VITE_CLIENT_URL;
    const url = `${clientUrl}/remote.html?id=${socket.id}`;

    $url.textContent = 'link';
    $url.setAttribute("href", url);

    const qr = qrcode(4, "L");
    qr.addData(url);
    qr.make();

    $qr.innerHTML = qr.createImgTag(4);
  });

  socket.on("connect_error", err => {
    console.error("DESKTOP socket error:", err.message);
  });

  socket.on("client-disconnect", client => {
    console.log("Client disconnected:", client);

    if (peer && peer.data && peer.data.id === client?.id) {
      peer.destroy();
      peer = null;
    }
  });

  socket.on("signal", (_myId: string, signal: SignalData, peerId: string) => {
    console.log("DESKTOP received signal:", signal);

    if (signal.type === "offer") {
      answerPeerOffer(signal, peerId);
      return;
    }

    if (peer) {
      peer.signal(signal);
    } else {
      console.warn("DESKTOP received signal but peer does not exist yet");
    }
  });
};

const answerPeerOffer = (offer: SignalData, peerId: string): void => {
  if (peer) {
    peer.destroy();
  }

  peer = new window.SimplePeer({
    initiator: false,
    trickle: true,
    config: servers,
  });

  peer.data = {
    id: peerId,
  };

  peer.on("signal", (data: SignalData) => {
    console.log("DESKTOP sending signal:", data);
    socket.emit("signal", peerId, data);
  });

  peer.on("connect", () => {
    console.log("DESKTOP data channel connected!");
    $welcome?.classList.add("hidden");
  });

  peer.on("data", (data: Uint8Array) => {
    const message = parsePeerMessage(data);

    if (!message) return;

    console.log("DESKTOP received:", message);

    if (message.type === "pantsYes") {
      pantsON();
    }

    if (message.type === "pantsNo") {
      pantsOff();
    }
  });

  peer.on("error", (err: Error) => {
    console.error("DESKTOP peer error:", err);
  });

  peer.on("close", () => {
    console.log("DESKTOP peer closed");

    peer = null;
    $welcome?.classList.remove("hidden");
  });

  peer.signal(offer);
};

const parsePeerMessage = (data: Uint8Array): PeerMessage | null => {
  try {
    const text = new TextDecoder().decode(data);
    return JSON.parse(text) as PeerMessage;
  } catch (error) {
    console.error("Could not parse peer message:", error);
    return null;
  }
};

const pantsON = (): void => {
  if (!$pants) return;

  $pants?.classList.remove("hidden");
};

const pantsOff = (): void => {
  if (!$pants) return;

  $pants?.classList.add("hidden");
};

//from here all the lens logic
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
    // outfitApiService: createOutfitApiService(),
  } as any);
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
  console.log('Session services:', (session as any).remoteApiServices);

  setupKeyboardControls();
}

startApp().catch((error) => {
  console.error('Something went wrong while starting the app:', error);
});

init();