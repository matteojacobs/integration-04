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
  } | {
    type: "saveCapturedImage";
    contactMode: "email" | "phone";
    contactValue: string;
    featureMe: boolean;
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
const $povTextBefore = document.getElementById("povTextBefore") as HTMLElement | null;
const $povTextGreen = document.getElementById("povTextGreen") as HTMLElement | null;
const $povTextAfter = document.getElementById("povTextAfter") as HTMLElement | null;

let isCapturingImage = false;
let captureWasCancelled = false;
let captureTimeouts: number[] = [];
let lastCaptureImages: {
  decoratedImageDataUrl: string;
  cleanImageDataUrl: string | null;
} | null = null;

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

    if (message.type === "saveCapturedImage") {
      saveCapturedImageToDatabase(message);
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

async function finishCapture() {
  if (captureWasCancelled) return;

  hideCountdown();

  const imageDataUrl = await captureInstallationImage();
  // const cleanImageDataUrl = await captureCleanLensImage();

  isCapturingImage = false;

  if (!imageDataUrl) {
    console.error("Could not capture image");
    sendToRemote({ type: "captureCancelled" });
    return;
  }

  lastCaptureImages = {
    decoratedImageDataUrl: imageDataUrl,
    cleanImageDataUrl: null,
  };

  sendToRemote({
    type: "imageCaptured",
    imageDataUrl,
  });
}

async function captureInstallationImage(): Promise<string | null> {
  if (!$cameraCanvas) {
    console.error("Missing #canvas");
    return null;
  }

  await document.fonts.ready;

  // Same ratio as 295 x 450 (= what is shown), but higher quality
  const exportWidth = 590;
  const exportHeight = 900;

  const headerHeight = exportHeight * 0.18;
  const cameraY = headerHeight;
  const cameraHeight = exportHeight - headerHeight;

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = exportWidth;
  outputCanvas.height = exportHeight;

  const ctx = outputCanvas.getContext("2d");

  if (!ctx) {
    console.error("Could not create export canvas context");
    return null;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = "#1E1E1E";
  ctx.fillRect(0, 0, exportWidth, exportHeight);

  ctx.fillStyle = "#1E1E1E";
  ctx.fillRect(0, 0, exportWidth, headerHeight);

  drawHeaderText(ctx, exportWidth, headerHeight);
  drawMirroredCanvasCover(
    ctx,
    $cameraCanvas,
    0,
    cameraY,
    exportWidth,
    cameraHeight
  );

  drawPixelStrip(ctx, exportWidth, cameraY);

  drawWatermark(ctx, exportWidth, exportHeight);

  return outputCanvas.toDataURL("image/jpeg", 0.85);
}

function drawHeaderText(
  ctx: CanvasRenderingContext2D,
  width: number,
  headerHeight: number
) {
  const titleText = "POV:";
  const beforeText = $povTextBefore?.textContent ?? "";
  const greenText = $povTextGreen?.textContent ?? "";
  const afterText = $povTextAfter?.textContent ?? "";

  const centerX = width / 2;

  // title
  ctx.save();
  ctx.fillStyle = "#FCFCFC";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `400 ${width * 0.09}px bacalar, sans-serif`;

  const titleY = headerHeight * 0.18;
  ctx.fillText(titleText, centerX, titleY);
  ctx.restore();

  // pov text
  ctx.save();
  ctx.textBaseline = "top";
  ctx.font = `400 ${width * 0.07}px "sun antwerpen", sans-serif`;

  const sentenceY = headerHeight * 0.58;

  const beforeWidth = ctx.measureText(beforeText).width;
  const greenWidth = ctx.measureText(greenText).width;
  const afterWidth = ctx.measureText(afterText).width;

  const totalWidth = beforeWidth + greenWidth + afterWidth;
  let x = centerX - totalWidth / 2;

  ctx.fillStyle = "#FCFCFC";
  ctx.fillText(beforeText, x, sentenceY);
  x += beforeWidth;

  ctx.fillStyle = "#B7EA63";
  ctx.fillText(greenText, x, sentenceY);
  x += greenWidth;

  ctx.fillStyle = "#FCFCFC";
  ctx.fillText(afterText, x, sentenceY);

  ctx.restore();
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  ctx.save();

  ctx.fillStyle = "#161616";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.font = `400 ${width * 0.07}px bacalar, sans-serif`;

  ctx.fillText("AntwerPOV", width - 24, height - 20);

  ctx.restore();
}

function drawMirroredCanvasCover(
  ctx: CanvasRenderingContext2D,
  sourceCanvas: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const sourceWidth = sourceCanvas.width;
  const sourceHeight = sourceCanvas.height;

  const scale = Math.max(width / sourceWidth, height / sourceHeight);

  const croppedWidth = width / scale;
  const croppedHeight = height / scale;

  const sourceX = (sourceWidth - croppedWidth) / 2;
  const sourceY = (sourceHeight - croppedHeight) / 2;

  ctx.save();

  // Mirror camera
  ctx.translate(x + width, y);
  ctx.scale(-1, 1);

  ctx.drawImage(
    sourceCanvas,
    sourceX,
    sourceY,
    croppedWidth,
    croppedHeight,
    0,
    0,
    width,
    height
  );

  ctx.restore();
}

function drawPixelStrip(
  ctx: CanvasRenderingContext2D,
  width: number,
  y: number
) {
  const pixelStrip = document.querySelector(".webcam__pixels") as HTMLImageElement | null;

  if (!pixelStrip || !pixelStrip.complete) return;

  const stripRatio = pixelStrip.naturalHeight / pixelStrip.naturalWidth;
  const stripHeight = width * stripRatio;

  ctx.drawImage(pixelStrip, 0, y, width, stripHeight);
}

async function saveCapturedImageToDatabase(message: {
  type: "saveCapturedImage";
  contactMode: "email" | "phone";
  contactValue: string;
  featureMe: boolean;
}) {
  if (!lastCaptureImages) {
    console.error("No captured image to save.");
    return;
  }

  try {
    const response = await fetch("http://localhost:443/api/submissions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        povId: lensState.currentPovId,
        decoratedImageDataUrl: lastCaptureImages.decoratedImageDataUrl,
        cleanImageDataUrl: lastCaptureImages.cleanImageDataUrl,
        contactMode: message.contactMode,
        contactValue: message.contactValue,
        featureMe: message.featureMe,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      console.error("Server error response:", errorBody);
      throw new Error(errorBody?.message ?? "Could not save image.");
    }

    const result = await response.json();
    console.log("Saved submission:", result);
  } catch (error) {
    console.error("Save failed:", error);
  }
}

init();