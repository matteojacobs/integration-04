import { type Pov } from "../data/povs";

import { io, Socket } from "socket.io-client";
import qrcode from "qrcode-generator";

import {
  lensState,
  toggleExtraAccessory,
  selectBackground,
} from "../state/lensState";


type RemoteToDesktopMessage =
  | {
    type: "toggleExtraAccessory";
    accessoryId: string;
  }
  | {
    type: "selectBackground";
    backgroundId: string;
  }
  | {
    type: "captureMoment";
  }
  | {
    type: "getRoute";
  } |
  {
    type: "cancelImage";
  };


type DesktopToRemoteMessage =
  | {
    type: "povChanged";
    pov: Pov;
    lensState: typeof lensState;
  }
  | {
    type: "lensStateChanged";
    lensState: typeof lensState;
  }
  | {
    type: "captureStarted";
  }
  | {
    type: "captureCancelled";
  }
  | {
    type: "imageCaptured";
    imageDataUrl: string;
  };

type PeerMessage = RemoteToDesktopMessage | DesktopToRemoteMessage;

type SignalData = {
  type?: string;
  candidate?: unknown;
  [key: string]: unknown;
};

const $url = document.getElementById("url") as HTMLAnchorElement;
const $qr = document.getElementById("qr") as HTMLElement;
const $welcome = document.getElementById("welcome") as HTMLElement;
const $imageCountdown = document.getElementById("imageCountdown") as HTMLElement | null;
const $cameraCanvas = document.getElementById("canvas") as HTMLCanvasElement | null;

let isCapturingImage = false;
let captureWasCancelled = false;
let captureTimeouts: number[] = [];

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
  if (!$url || !$qr) {
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
    onRemoteConnected?.();
  });

  peer.on("data", (data: Uint8Array) => {
    const message = parsePeerMessage(data);

    if (!message) return;

    console.log("DESKTOP received:", message);

    if (message.type === "toggleExtraAccessory") {
      toggleExtraAccessory(message.accessoryId);
      sendLensStateToRemote();
    }

    if (message.type === "selectBackground") {
      selectBackground(message.backgroundId);
      sendLensStateToRemote();
    }

    if (message.type === "captureMoment") {
      startCaptureFlow();
    }

    if (message.type === "cancelImage") {
      cancelCaptureFlow();
    }

    if (message.type === "getRoute") {
      console.log("Get route");
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

export function sendToRemote(message: DesktopToRemoteMessage) {
  if (!peer || !peer.connected) return;

  peer.send(JSON.stringify(message));
}

export function sendLensStateToRemote() {
  if (!peer || !peer.connected) return;

  peer.send(
    JSON.stringify({
      type: "lensStateChanged",
      lensState,
    })
  );
}

export function sendCurrentPovToRemote(pov: Pov) {
  if (!peer || !peer.connected) return;

  peer.send(
    JSON.stringify({
      type: "povChanged",
      pov,
      lensState,
    })
  );
}

let onRemoteConnected: (() => void) | null = null;

export function setOnRemoteConnected(callback: () => void) {
  onRemoteConnected = callback;
}

// ---- img flow ------------------

function startCaptureFlow() {
  if (isCapturingImage) return;

  isCapturingImage = true;
  captureWasCancelled = false;
  clearCaptureTimeouts();

  sendToRemote({ type: "captureStarted" });

  const countdownValues = ["3", "2", "1"];
  let index = 0;

  const tick = () => {
    if (captureWasCancelled) return;

    if (!$imageCountdown) {
      console.error("Missing #imageCountdown");
      finishCapture();
      return;
    }

    if (index < countdownValues.length) {
      $imageCountdown.textContent = countdownValues[index];
      $imageCountdown.classList.remove("hidden");

      index++;

      const timeoutId = window.setTimeout(tick, 1000);
      captureTimeouts.push(timeoutId);

      return;
    }

    finishCapture();
  };

  tick();
}

function cancelCaptureFlow() {
  if (!isCapturingImage) return;

  captureWasCancelled = true;
  isCapturingImage = false;

  clearCaptureTimeouts();
  hideCountdown();

  sendToRemote({ type: "captureCancelled" });
}

function clearCaptureTimeouts() {
  captureTimeouts.forEach((timeoutId) => {
    window.clearTimeout(timeoutId);
  });

  captureTimeouts = [];
}

function hideCountdown() {
  $imageCountdown?.classList.add("hidden");
}

function finishCapture() {
  if (captureWasCancelled) return;

  hideCountdown();

  const imageDataUrl = captureCanvasWithLogo();

  isCapturingImage = false;

  if (!imageDataUrl) {
    console.error("Could not capture image");
    sendToRemote({ type: "captureCancelled" });
    return;
  }

  sendToRemote({
    type: "imageCaptured",
    imageDataUrl,
  });
}

function captureCanvasWithLogo(): string | null {
  if (!$cameraCanvas) {
    console.error("Missing #canvas");
    return null;
  }

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = $cameraCanvas.width;
  outputCanvas.height = $cameraCanvas.height;

  const ctx = outputCanvas.getContext("2d");

  if (!ctx) {
    console.error("Could not create canvas context");
    return null;
  }

  ctx.drawImage($cameraCanvas, 0, 0, outputCanvas.width, outputCanvas.height);

  drawLogoOnImage(ctx, outputCanvas.width, outputCanvas.height);

  return outputCanvas.toDataURL("image/jpeg", 0.9);
}

function drawLogoOnImage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  ctx.save();

  ctx.font = `bold ${Math.round(width * 0.075)}px bacalar`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  ctx.lineWidth = Math.round(width * 0.008);
  ctx.fillStyle = "#B7F35C";

  const text = "AntwerPOV";
  const x = width / 2;
  const y = height * 0.04;

  ctx.fillText(text, x, y);

  ctx.restore();
}



init();