import { io, Socket } from "socket.io-client";

import type { Pov } from "../data/povs";
import type { LensState } from "../state/lensState";

import qrcode from "qrcode-generator";

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
  };

type DesktopToRemoteMessage =
  | {
    type: "povChanged";
    pov: Pov;
    lensState: LensState;
  }
  | {
    type: "lensStateChanged";
    lensState: LensState;
  };

type PeerMessage = RemoteToDesktopMessage | DesktopToRemoteMessage;

type SignalData = {
  type?: string;
  candidate?: unknown;
  [key: string]: unknown;
};

type RemoteScreen =
  | "connect"
  | "start"
  | "home"
  | "accessories"
  | "backgrounds"
  | "picture"
  | "pictureTaken"
  | "route";

let currentScreen: RemoteScreen = "connect";
let currentPov: Pov | null = null;
let currentLensState: LensState | null = null;
const $qr = document.getElementById("qr") as HTMLElement;

const $connectButton = document.getElementById("connectButton") as HTMLButtonElement | null;
const $explanation = document.getElementById("explanation") as HTMLElement | null;
const $startButton = document.getElementById("connectButton") as HTMLButtonElement | null;


let socket: Socket;
let peer: any = null;
const desktopId = getUrlParameter("id");

const servers: RTCConfiguration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

const init = (): void => {
  if (!desktopId) {
    alert("Missing desktop ID in URL!");
    return;
  }

  if (!$connectButton || !$explanation || !$startButton) {
    console.error("REMOTE missing HTML element");
    return;
  }

  initSocket();

  $connectButton.addEventListener("click", () => {
    console.log("START BUTTON CLICKED");
    callPeer();
  });

  checkButtons();
};

const initSocket = (): void => {
  socket = io(import.meta.env.VITE_SOCKET_URL);

  socket.on("connect", () => {
    console.log("REMOTE socket connected:", socket.id);
  });

  socket.on("connect_error", err => {
    console.error("REMOTE socket error:", err.message);
  });

  socket.on("signal", (_myId: string, signal: SignalData, _peerId: string) => {
    console.log("REMOTE received signal:", signal);

    if (!peer) {
      console.warn("REMOTE received signal but peer does not exist yet");
      return;
    }

    peer.signal(signal);
  });
};

const callPeer = (): void => {
  console.log("callPeer started");
  console.log("desktopId:", desktopId);
  console.log("socket connected:", socket.connected);
  console.log("SimplePeer:", window.SimplePeer);

  if (!window.SimplePeer) {
    console.error("SimplePeer is not loaded. Check the CDN script in remote.html.");
    return;
  }

  if (peer) {
    peer.destroy();
  }

  peer = new window.SimplePeer({
    initiator: true,
    trickle: true,
    config: servers,
  });

  peer.on("signal", (data: SignalData) => {
    console.log("REMOTE sending signal:", data);
    socket.emit("signal", desktopId, data);
  });

  peer.on("connect", () => {
    console.log("REMOTE data channel connected!");

    $explanation?.classList.add("hidden");
    showScreen("start");
  });

  peer.on("data", (data: Uint8Array) => {
    const message = parsePeerMessage(data);

    if (!message) return;
    if (message.type === "povChanged") {
      currentPov = message.pov;
      currentLensState = message.lensState;

      console.log("Current POV:", currentPov.name);
      renderCurrentPovControls();
    }

    if (message.type === "lensStateChanged") {
      currentLensState = message.lensState;
      renderCurrentPovControls();
    }

    console.log("REMOTE received:", message);
  });

  peer.on("error", (err: Error) => {
    console.error("REMOTE peer error:", err);
  });

  peer.on("close", () => {
    console.log("REMOTE peer closed");

    peer = null;

    $explanation?.classList.remove("hidden");
  });
};

const sendToPeer = (message: PeerMessage): void => {
  if (!peer || !peer.connected) {
    console.warn("REMOTE cannot send, peer is not connected:", message);
    return;
  }

  peer.send(JSON.stringify(message));
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

function getUrlParameter(name: string): string | false {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  const regex = new RegExp("[\\?&]" + name + "=([^&#]*)");
  const results = regex.exec(location.search);

  return results === null
    ? false
    : decodeURIComponent(results[1].replace(/\+/g, " "));
}

// -------------- screen info -=----------

const screens: Record<RemoteScreen, HTMLElement | null> = {
  connect: document.getElementById("screenConnect"),
  start: document.getElementById("screenStart"),
  home: document.getElementById("screenHome"),
  accessories: document.getElementById("screenAccessories"),
  backgrounds: document.getElementById("screenBackgrounds"),
  picture: document.getElementById("screenPicture"),
  pictureTaken: document.getElementById("screenPictureTaken"),
  route: document.getElementById("screenRoute"),
};

function showScreen(screen: RemoteScreen) {
  currentScreen = screen;

  Object.values(screens).forEach((screenElement) => {
    screenElement?.classList.add("hidden");
  });

  screens[screen]?.classList.remove("hidden");
}

function renderCurrentPovControls() {
  renderAccessories();
  renderBackgrounds();
  renderRoute();
}

function renderAccessories() {

  if (!currentPov) return;

  const cards = document.querySelectorAll<HTMLButtonElement>(".accessory-card");

  cards.forEach((card, index) => {
    const accessory = currentPov?.extraAccessories[index];

    if (!accessory) {
      card.classList.add("hidden");
      return;
    }

    card.classList.remove("hidden");

    const label = card.querySelector<HTMLElement>(".accessory-card__label");
    const img = card.querySelector<HTMLImageElement>(".accessory-card__img");

    if (label) {
      label.textContent = accessory.label;
    }

    if (img) {
      img.src = accessory.icon ?? "./src/assets/remote/placeholder.webp";
      img.alt = accessory.label;
    }

    const isActive =
      currentLensState?.extraAccessories[accessory.id] === true;

    card.classList.toggle("is-active", isActive);

    card.onclick = () => {
      sendToPeer({
        type: "toggleExtraAccessory",
        accessoryId: accessory.id,
      });
    };
  });
}


function renderBackgrounds() {

  if (!currentPov) return;

  const cards = document.querySelectorAll<HTMLButtonElement>(".background-card");

  cards.forEach((card, index) => {
    const background = currentPov?.backgrounds[index];

    if (!background) {
      card.classList.add("hidden");
      return;
    }

    card.classList.remove("hidden");

    const label = card.querySelector<HTMLElement>(".background-card__label");
    const img = card.querySelector<HTMLImageElement>(".background-card__img");

    if (label) {
      label.textContent = background.label;
    }

    if (img) {
      img.src = background.preview ?? "./src/assets/remote/placeholder.webp";
      img.alt = background.label;
    }

    const isActive =
    currentLensState?.activeBackgroundId === background.id;;

    card.classList.toggle("is-active", isActive);

    card.onclick = () => {
      sendToPeer({
        type: "selectBackground",
        backgroundId: background.id,
      });
    };
  });
}


function renderRoute() {
  const routeQr = document.getElementById("routeQr");

  if ( !routeQr || !currentPov) return;

  const url = new URL("https://antwerpov.com/routes");
  url.searchParams.set("pov", currentPov.id);

  const qr = qrcode(4, "L");
  qr.addData(url.toString());
  qr.make();

  // routeQr.innerHTML = qr.createImgTag(4);
  let svg = qr.createSvgTag(5, 2);

  svg = svg
    .replaceAll('fill="#000000"', 'fill="#4B6DD2"')
    .replaceAll('fill="black"', 'fill="#4B6DD2"')
    .replaceAll('fill="#ffffff"', 'fill="#1E1E1E"')
    .replaceAll('fill="white"', 'fill="#1E1E1E"');

  routeQr.innerHTML = svg;
}

const checkButtons = () => {
  document.getElementById("screenStart")?.addEventListener("click", () => {
    showScreen("home");
  });

  document.getElementById("goAccessoriesButton")?.addEventListener("click", () => {
    renderAccessories();
    showScreen("accessories");
  });

  document.getElementById("goBackgroundsButton")?.addEventListener("click", () => {
    renderBackgrounds();
    showScreen("backgrounds");
  });

  document.getElementById("goRouteButton")?.addEventListener("click", () => {
    sendToPeer({ type: "getRoute" });
    renderRoute();
    showScreen("route");
  });

  document.getElementById("goPictureButton")?.addEventListener("click", () => {
    showScreen("picture");
  });

  document.getElementById("captureButton")?.addEventListener("click", () => {
    sendToPeer({ type: "captureMoment" });
    showScreen("pictureTaken");
  });

  document.querySelectorAll(".backButton").forEach((button) => {
    button.addEventListener("click", () => {
      showScreen("home");
    });
  });
}



init();