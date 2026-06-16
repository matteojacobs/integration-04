const $url = document.getElementById('url');
const $ghost = document.getElementById('ghost');
const $game = document.getElementById('game');
const $firstScreen = document.getElementById('welcome');

let socket;
let peer;
let position = 0;
let ghostDuration = 0;

let isMessageAudio = false;

const servers = {
  iceServers: [{
    urls: 'stun:stun.l.google.com:19302'
  }]
};

const init = async () => {
  initSocket();
};

const initSocket = () => {
  socket = io.connect('/');
  socket.on('connect', () => {
    console.log(window.location)
    console.log(socket.id);

    const url = `${new URL(`/remote.html?id=${socket.id}`, window.location)}`;
    $url.textContent = url;
    $url.setAttribute('href', url);

    const typeNumber = 4;
    const errorCorrectionLevel = 'L';
    const qr = qrcode(typeNumber, errorCorrectionLevel);
    qr.addData(url);
    qr.make();
    document.getElementById('qr').innerHTML = qr.createImgTag(4);
  });

  socket.on('client-disconnect', (client) => {
    console.log('Client disconnected:', client);
    if (peer && peer.data.id === client.id) {
      peer.destroy();
    }
  });

  socket.on('signal', async (myId, signal, peerId) => {
    console.log(`Received signal from ${peerId}`);
    console.log(signal);
    if (signal.type === 'offer') {
      answerPeerOffer(myId, signal, peerId);
    }
    $game.classList.toggle('hidden');
    $firstScreen.classList.toggle('hidden');
  });
};

const answerPeerOffer = async (myId, offer, peerId) => {
  const options = {
    initiator: false,
    trickle: false,
    config: servers
  };
  peer = new SimplePeer(options);

  peer.data = {
    id: peerId
  };

  peer.on('signal', data => {
    socket.emit('signal', peerId, data);
  });

  peer.on('data', (data) => { //open data channel

    const message = JSON.parse(data);
    console.log("DESKTOP received:", message)
    if (message.type === "move") {
      moveGhost(message);
    } else if (message.type === "resetGhost") {
      resetGhost();
    }

  });

  peer.on('close', () => {
    console.log('close');
    if (peer) {
      peer.destroy();
      peer = null;
    }
    $game.classList.add('hidden');
    $firstScreen.classList.remove('hidden');
  });


  peer.signal(offer);
};


const moveGhost = (message) => {
  const distance = message.distance;
  const screenWidth = window.innerWidth;
  const ghostWidth = $ghost.getBoundingClientRect();

  const maxDistance = screenWidth + ghostWidth.width;
  const moveDistance = distance * maxDistance;

  position = moveDistance;

  if (position < maxDistance && position > ghostWidth.width) {
    ghostDuration += 1;
  }

  $ghost.style.transform = `translateX(${position}px)`;
}

const resetGhost = () => {
  $ghost.style.transform = `translateX(-100%)`;
  ghostDuration = 0;
};


init();