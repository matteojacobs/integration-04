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
  };

type PeerMessage = RemoteToDesktopMessage | DesktopToRemoteMessage;

type SignalData = {
  type?: string;
  candidate?: unknown;
  [key: string]: unknown;
};

const $url = document.getElementById("url") as HTMLAnchorElement;
const $lights = document.getElementById("lights") as HTMLElement;
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
  if (!$url || !$lights || !$qr) {
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

    if (message.type === "toggleExtraAccessory") {
      toggleExtraAccessory(message.accessoryId);
      sendLensStateToRemote();
    }

    if (message.type === "selectBackground") {
      selectBackground(message.backgroundId);
      sendLensStateToRemote();
    }

    if (message.type === "captureMoment") {
      console.log("Capture moment");
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

init();