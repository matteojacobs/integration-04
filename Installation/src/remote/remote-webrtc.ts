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
  }
  | {
    type: "cancelImage";
  } | {
    type: "saveCapturedImage";
    contactMode:"email" | "phone";
    contactValue: string;
    featureMe: boolean;
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

type ContactMode = "email" | "phone";
let contactMode: ContactMode = "email";

const INACTIVITY_TIME = 30000; // 30 seconds
let inactivityTimeoutId: number | null = null;


const $contactLabel = document.getElementById("contactLabel") as HTMLLabelElement | null;
const $contactField = document.getElementById("contactField") as HTMLElement | null;
const $contactInput = document.getElementById("contactInput") as HTMLInputElement | null;
const $contactError = document.getElementById("contactError") as HTMLElement | null;
const $switchContactMode = document.getElementById("switchContactMode") as HTMLButtonElement | null;
const $sendImgButton = document.getElementById("sendImg") as HTMLButtonElement | null;
const $redoButton = document.getElementById("redoImage") as HTMLButtonElement | null;
const $featureInput = document.getElementById("feature") as HTMLInputElement | null;

const $connectButton = document.getElementById("connectButton") as HTMLButtonElement | null;
const $explanation = document.getElementById("explanation") as HTMLElement | null;
const $startButton = document.getElementById("connectButton") as HTMLButtonElement | null;
const $captureButton = document.getElementById("captureButton") as HTMLButtonElement | null;
const $cancelButton = document.getElementById("cancelImage") as HTMLButtonElement | null;
const $cancelSection = document.getElementById("cancelDiv") as HTMLButtonElement | null;
const $takenImage = document.getElementById("takenImage") as HTMLImageElement | null;

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

    if (message.type === "captureStarted") {
      switchCameraScreen();
    }

    if (message.type === "captureCancelled") {
      switchCameraBack();
    }

    if (message.type === "imageCaptured") {
      if ($takenImage) {
        $takenImage.src = message.imageDataUrl;
      }

      switchCameraBack();
      showScreen("pictureTaken");
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

  if (screen === "connect" || screen === "start") {
    clearInactivityTimer();
  } else {
    startInactivityTimer();
  }
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
      img.src = `./src/assets/remote/${accessory.id}.png`;
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
      img.src = background.preview ?? "./src/assets/remote/meir.png";
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

  if (!routeQr || !currentPov) return;

  const url = new URL("https://antwerpov.com/routes");
  url.searchParams.set("pov", currentPov.id);

  const qr = qrcode(4, "L");
  qr.addData(url.toString());
  qr.make();

  let svg = qr.createSvgTag(5, 2);

  svg = svg
    .replaceAll('fill="#000000"', 'fill="#829FF4"')
    .replaceAll('fill="black"', 'fill="#829FF4"')
    .replaceAll('fill="#ffffff"', 'fill="#1E1E1E"')
    .replaceAll('fill="white"', 'fill="#1E1E1E"');

  routeQr.innerHTML = svg;
}

const switchCameraScreen = () => {
  $captureButton?.classList.add("hidden");
  $cancelSection?.classList.remove("hidden");
}

const switchCameraBack = () => {
  $captureButton?.classList.remove("hidden");
  $cancelSection?.classList.add("hidden");
}

function updateContactMode() {
  if (
    !$contactLabel ||
    !$contactInput ||
    !$switchContactMode
  ) {
    return;
  }

  $contactInput.value = "";

  if (contactMode === "email") {
    $contactLabel.classList.add("imgInfo__label--email");
    $contactLabel.classList.remove("imgInfo__label--phone");

    $contactLabel.textContent = "E-mail address";

    $contactInput.type = "email";
    $contactInput.name = "email";
    $contactInput.placeholder = "you@example.com";
    $contactInput.inputMode = "email";
    $contactInput.removeAttribute("minlength");
    $contactInput.maxLength = 80;

    $switchContactMode.textContent = "send it to my number instead!";
  }

  if (contactMode === "phone") {
    $contactLabel.classList.remove("imgInfo__label--email");
    $contactLabel.classList.add("imgInfo__label--phone");

    $contactLabel.textContent = "Phone number";

    $contactInput.type = "tel";
    $contactInput.name = "phone";
    $contactInput.placeholder = "+32 4 12 34 56 78";
    $contactInput.inputMode = "tel";
    $contactInput.minLength = 8;
    $contactInput.maxLength = 20;

    $switchContactMode.textContent = "send it by e-mail instead!";
  }

  validateContactInput();
}

function isValidPhoneNumber(value: string) {
  // Allows +, spaces, brackets and dashes.
  // Then checks if there are enough digits.
  const cleanedValue = value.replace(/[^\d]/g, "");

  return cleanedValue.length >= 8 && cleanedValue.length <= 15;
}

function validateContactInput() {
  if (!$contactInput || !$sendImgButton || !$contactField || !$contactError) {
    return;
  }

  const value = $contactInput.value.trim();
  let isValid = false;
  let errorText = "";

  if (contactMode === "email") {
    isValid = value.length > 0 && $contactInput.checkValidity();

    if (!value) {
      errorText = "Please fill in your e-mail address.";
    } else {
      errorText = "Please fill in a valid e-mail address.";
    }
  }

  if (contactMode === "phone") {
    isValid = isValidPhoneNumber(value);

    if (!value) {
      errorText = "Please fill in your phone number.";
    } else {
      errorText = "Please fill in a valid phone number.";
    }
  }

  $sendImgButton.disabled = !isValid;

  const shouldShowError = value.length > 0 && !isValid;

  $contactField.classList.toggle("is-invalid", shouldShowError);
  $contactError.classList.toggle("hidden", !shouldShowError);
  $contactError.textContent = errorText;
}

function startNewCapture() {
  if (!peer || !peer.connected) {
    console.warn("Cannot start capture, peer is not connected.");
    return;
  }

  // Clear old preview image
  if ($takenImage) {
    $takenImage.removeAttribute("src");
  }

  // Reset form
  resetContactForm();

  // Go back to the picture screen
  showScreen("picture");

  // Show cancel state on the iPad
  switchCameraScreen();

  // Tell desktop to start countdown and capture
  sendToPeer({
    type: "captureMoment",
  });
}

function resetContactForm() {
  contactMode = "email";

  if ($featureInput) {
    $featureInput.checked = false;
  }

  updateContactMode();
}

const checkButtons = () => {
  document.addEventListener("pointerdown", () => {
    resetInactivityTimer();
  });

  document.addEventListener("keydown", () => {
    resetInactivityTimer();
  });

  document.addEventListener("input", () => {
    resetInactivityTimer();
  });

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

  $captureButton?.addEventListener("click", () => {
    sendToPeer({ type: "captureMoment" });
    switchCameraScreen();
  });

  $redoButton?.addEventListener("click", () => {
    startNewCapture();
  });

  $cancelButton?.addEventListener("click", () => {
    sendToPeer({ type: "cancelImage" });
    switchCameraBack();
  });

  document.querySelectorAll(".backButton").forEach((button) => {
    button.addEventListener("click", () => {
      showScreen("home");
    });
  });

  $switchContactMode?.addEventListener("click", () => {
    contactMode = contactMode === "email" ? "phone" : "email";
    updateContactMode();
  });

  $contactInput?.addEventListener("input", () => {
    validateContactInput();
  });

  $sendImgButton?.addEventListener("click", () => {
    if (!$contactInput || $sendImgButton.disabled) return;

    document.getElementById("afterSend")?.classList.remove("hidden");
    $sendImgButton.classList.add("hidden");
    document.getElementById("taken")?.classList.add("hidden");

    const value = $contactInput.value.trim();

    sendToPeer({
      type: "saveCapturedImage",
      contactMode,
      contactValue: value,
      featureMe: $featureInput?.checked === true,
    });

    window.setTimeout(() => {
      showScreen("home");

      // reset the send screen for next time
      document.getElementById("afterSend")?.classList.add("hidden");
      document.getElementById("taken")?.classList.remove("hidden");
      $sendImgButton.classList.remove("hidden");

      resetContactForm();
    }, 4000);
  });

  $contactInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      closeKeyboard();
    }
  });

  document.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target as HTMLElement;

      const tappedInput = target.closest("#contactInput");
      const tappedContactField = target.closest("#contactField");
      const tappedSwitchButton = target.closest("#switchContactMode");

      if (!tappedInput && !tappedContactField && !tappedSwitchButton) {
        closeKeyboard();
      }
    },
    true
  );
}


/* check activity */ 

function clearInactivityTimer() {
  if (inactivityTimeoutId !== null) {
    window.clearTimeout(inactivityTimeoutId);
    inactivityTimeoutId = null;
  }
}

function startInactivityTimer() {
  clearInactivityTimer();

  // Do not count inactivity on connect/start screen
  if (currentScreen === "connect" || currentScreen === "start") {
    return;
  }

  inactivityTimeoutId = window.setTimeout(() => {
    goBackToStartBecauseInactive();
  }, INACTIVITY_TIME);
}

function resetInactivityTimer() {
  startInactivityTimer();
}

function goBackToStartBecauseInactive() {
  console.log("No interaction, going back to start screen");

  // If a capture was waiting/cancelling, cancel it on the desktop too
  if (currentScreen === "picture") {
    sendToPeer({
      type: "cancelImage",
    });

    switchCameraBack();
  }

  // Reset picture taken/send UI
  document.getElementById("afterSend")?.classList.add("hidden");
  document.getElementById("taken")?.classList.remove("hidden");
  $sendImgButton?.classList.remove("hidden");

  if ($takenImage) {
    $takenImage.removeAttribute("src");
  }

  resetContactForm();

  // Go back to "tap to start"
  showScreen("start");
}

function closeKeyboard() {
  if ($contactInput) {
    $contactInput.blur();
  }

  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}



init();