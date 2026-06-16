import { io, Socket } from "socket.io-client";

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

const $connectButton = document.getElementById("connectButton") as HTMLButtonElement | null;
const $pantsButton = document.getElementById("pantsButton") as HTMLElement | null;
const $explanation = document.getElementById("explanation") as HTMLElement | null;
const $startButton = document.getElementById("connectButton") as HTMLButtonElement | null;

let pantsVisible = false;

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

  if (!$connectButton || !$pantsButton || !$explanation || !$startButton) {
    console.error("REMOTE missing HTML element");
    return;
  }

  initSocket();

  $connectButton.addEventListener("click", () => {
    console.log("START BUTTON CLICKED");
    callPeer();
  });

  $pantsButton.addEventListener("click", handleClickPants);
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
  });

  peer.on("data", (data: Uint8Array) => {
    const message = parsePeerMessage(data);

    if (!message) return;

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


const handleClickPants = (): void => {
  pantsVisible = !pantsVisible;

  if (pantsVisible) {
    sendToPeer({ type: "pantsYes" });
  } else {
    sendToPeer({ type: "pantsNo" });
  }
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

init();