const $connectButton = document.getElementById('connectButton');
const $game = document.getElementById('game');
const $firstScreen = document.getElementById('explanation');


const $ghostSwipe = document.getElementById('ghost-swipe');
let startX = 0;
let distX = 0;
const minimumSwipe = 50;
const maxSwipeDistance = 270;

let socket;
let peer;
let desktopId = getUrlParameter('id');

const servers = {
  iceServers: [{ urls: `stun:stun.l.google.com:19302` }]
};

let data = [];

const init = async () => {
  if (!desktopId) {
    alert("Missing desktop ID in URL!");
    return;
  }

  initSocket();
  $connectButton.addEventListener('click', callPeer);
  $ghostSwipe.addEventListener('touchstart', handleSwipeStart);
  $ghostSwipe.addEventListener('touchmove', handleSwipeMove);
  $ghostSwipe.addEventListener('touchend', handleSwipeEnd);
};

const initSocket = () => {
  socket = io.connect(`/`);
  socket.on(`connect`, () => {
    console.log("Connected as:", socket.id);
  });

  socket.on('signal', async (myId, signal, peerId) => {
    console.log(`Received signal from ${peerId}`, signal);
    peer.signal(signal);
  });

  socket.on('disconnect', (client) => {
    console.log('Client disconnected:', client);
  });

  window.addEventListener('beforeunload', () => {
    socket.emit('forceDisconnect');
  });
};

const callPeer = async () => {
  console.log('Calling desktop:', desktopId);

  if (peer) {
    peer.destroy(); // delete previous connnections 
  }

  const options = {
    initiator: true,
    trickle: false,
    config: servers,
  };

  peer = new SimplePeer(options);

  peer.on('signal', data => {
    socket.emit('signal', desktopId, data);
    $game.classList.toggle('hidden');
    $firstScreen.classList.toggle('hidden');
  });

  peer.on('connect', () => {
    console.log("Data channel connected!");
  });

  peer.on('data', (data) => { //open data channel
    const message = JSON.parse(data);
    if (message.type === "move") {
    }
  });

  peer.on('close', () => {
    console.log('closed');
    if (peer) {
      peer.destroy();
      peer = null;
    }
  });
};


const handleSwipeStart = (e) => {
  const touch = e.touches[0];
  startX = touch.clientX;
};

const handleSwipeMove = (e) => {
  const touch = e.touches[0];
  distX = touch.clientX - startX;

  distX = Math.min(Math.max(distX, -maxSwipeDistance), maxSwipeDistance);
  $ghostSwipe.style.transform = `translateX(${distX}px)`;

  if (Math.abs(distX) > minimumSwipe) {
    const normalizedDistance = distX / maxSwipeDistance;
    peer.send(JSON.stringify({ type: "move", distance: normalizedDistance }));
  }
};

const handleSwipeEnd = () => {
  distX = 0;
  $ghostSwipe.style.transform = 'translateX(0)';
  peer.send(JSON.stringify({ type: "resetGhost" }));
};

function getUrlParameter(name) {
  name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
  const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
  const results = regex.exec(location.search);
  return results === null ? false : decodeURIComponent(results[1].replace(/\+/g, ' '));
}


const restartGame = () => {
  console.log('restart')
}

init();
