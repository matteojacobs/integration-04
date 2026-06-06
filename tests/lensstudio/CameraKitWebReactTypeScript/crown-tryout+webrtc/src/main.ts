import { bootstrapCameraKit } from '@snap/camera-kit';

// Declare globals imported via CDN scripts
declare const io: any;
declare const SimplePeer: any;
declare const qrcode: any;

(async function () {
    const $statusBar = document.getElementById('statusBar') as HTMLDivElement;
    const $qrOverlay = document.getElementById('qrOverlay') as HTMLDivElement;
    const $qrTitle = document.getElementById('qrTitle') as HTMLHeadingElement;
    const $overlayStatus = document.getElementById('overlayStatus') as HTMLDivElement;
    const liveRenderTarget = document.getElementById('canvas') as HTMLCanvasElement;
    const $emojiLayer = document.getElementById('emojiLayer') as HTMLDivElement;

    let socket: any = null;
    let peer: any = null;
    let myStream: MediaStream | null = null;

    const setStatus = (msg: string) => {
        if ($statusBar) $statusBar.textContent = `Status: ${msg}`;
    };

    const showOverlay = (title: string, message: string) => {
        if ($qrOverlay) {
            $qrOverlay.classList.remove('hidden');
            if ($qrTitle) $qrTitle.textContent = title;
            if ($overlayStatus) $overlayStatus.textContent = message;
        }
    };

    const hideOverlay = () => {
        if ($qrOverlay) $qrOverlay.classList.add('hidden');
    };

    // stickers storage
    const stickers: Record<string, HTMLDivElement> = {};

    const createStickerElement = ({ id, emoji, x = 50, y = 50, size = 10 }: { id: string; emoji: string; x?: number; y?: number; size?: number }) => {
        if (!id) id = `s${Date.now()}${Math.floor(Math.random() * 999)}`;
        if (stickers[id]) return stickers[id];

        const el = document.createElement('div');
        el.className = 'sticker';
        el.dataset.id = id;
        el.textContent = emoji;
        el.style.left = `${x}%`;
        el.style.top = `${y}%`;
        el.style.fontSize = `${size}vmin`;
        el.style.transform = 'translate(-50%, -50%)';
        el.style.position = 'absolute';
        el.style.touchAction = 'none';

        // pointer drag logic
        let dragging = false;
        const rect = () => $emojiLayer.getBoundingClientRect();

        const onPointerMove = (ev: PointerEvent) => {
            if (!dragging) return;
            const r = rect();
            const nx = ((ev.clientX - r.left) / r.width) * 100;
            const ny = ((ev.clientY - r.top) / r.height) * 100;
            el.style.left = `${Math.min(100, Math.max(0, nx))}%`;
            el.style.top = `${Math.min(100, Math.max(0, ny))}%`;
        };

        const onPointerUp = (ev: PointerEvent) => {
            if (!dragging) return;
            dragging = false;
            el.releasePointerCapture(ev.pointerId);
            // notify remote peer of move
            if (peer && peer.connected && !peer.destroyed) {
                const r = rect();
                const nx = ((ev.clientX - r.left) / r.width) * 100;
                const ny = ((ev.clientY - r.top) / r.height) * 100;
                peer.send(JSON.stringify({ type: 'move', id: id, x: Math.min(100, Math.max(0, nx)), y: Math.min(100, Math.max(0, ny)) }));
            }
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };

        el.addEventListener('pointerdown', (ev) => {
            ev.preventDefault();
            dragging = true;
            el.setPointerCapture(ev.pointerId);
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
        });

        $emojiLayer.appendChild(el);
        stickers[id] = el;
        return el;
    };

    const removeSticker = (id: string) => {
        const el = stickers[id];
        if (!el) return;
        el.remove();
        delete stickers[id];
    };

    const handleData = (raw: any) => {
        let msg: any;
        try {
            msg = JSON.parse(raw.toString());
        } catch (error) {
            return;
        }

        if (msg.type === 'emoji' && msg.emoji) {
            createStickerElement({ id: msg.id, emoji: msg.emoji, x: msg.x || 50, y: msg.y || 50, size: msg.size || 12 });
        }

        if (msg.type === 'place') {
            createStickerElement({ id: msg.id, emoji: msg.emoji, x: msg.x || 50, y: msg.y || 50, size: msg.size || 12 });
        }

        if (msg.type === 'move' && msg.id) {
            const el = stickers[msg.id];
            if (el) {
                el.style.left = `${msg.x}%`;
                el.style.top = `${msg.y}%`;
            }
        }

        if (msg.type === 'remove' && msg.id) {
            removeSticker(msg.id);
        }
    };

    let signalQueue: any[] = [];
    let hasRemoteDescription = false;

    const createPeer = (peerId: string) => {
        console.log('HOST: Creating peer for target:', peerId);
        if (peer) {
            console.log('HOST: Destroying existing peer');
            peer.destroy();
            peer = null;
        }
        signalQueue = [];
        hasRemoteDescription = false;

        // Capture the canvas stream (including Snap Camera Kit render) to stream to the peer
        const canvasStream = (liveRenderTarget as any).captureStream(30);

        peer = new SimplePeer({
            initiator: true,
            trickle: true,
            stream: canvasStream
        });

        peer.on('signal', (data: any) => {
            console.log('HOST PEER: Generated signal:', data.type || 'candidate');
            socket.emit('signal', peerId, data);
        });
        peer.on('connect', () => {
            console.log('HOST PEER: Connected!');
            setStatus('Connected.');
            hideOverlay();
        });
        peer.on('data', handleData);
        peer.on('error', (err: any) => {
            console.error('HOST PEER: Error:', err);
            setStatus('Connection error: ' + err.message);
        });
        peer.on('close', () => {
            console.log('HOST PEER: Closed');
            setStatus('Phone disconnected.');
            showOverlay('Scan to reconnect', 'The QR code is ready for another phone.');
        });
    };

    const generateQR = (url: string) => {
        const urlEl = document.getElementById('url') as HTMLAnchorElement;
        if (urlEl) {
            urlEl.href = url;
            urlEl.textContent = url;
        }
        const qr = qrcode(0, 'L');
        qr.addData(url);
        qr.make();
        const qrEl = document.getElementById('qr');
        if (qrEl) {
            qrEl.innerHTML = qr.createImgTag(5);
        }
    };

    const initSocket = () => {
        const signalingUrl = 'https://' + window.location.hostname + ':3000';

        // Show a provisional QR immediately — before the socket connects — using
        // a URL without a hostId. It will be replaced with the real one on connect.
        const provisionalUrl = `${window.location.origin}/sender.html`;
        generateQR(provisionalUrl);
        const overlayStatusEl = document.getElementById('overlayStatus');
        if (overlayStatusEl) overlayStatusEl.textContent = 'Connecting to signaling server…';

        socket = io.connect(signalingUrl);

        socket.on('connect_error', (err: any) => {
            console.error('SOCKET: Cannot reach signaling server at', signalingUrl, err.message);
            setStatus(`Cannot reach signaling server on port 3000 — make sure "node index.js" is running.`);
            if (overlayStatusEl) overlayStatusEl.textContent = 'Signaling server offline. Run: node index.js';
        });

        socket.on('connect', () => {
            const hostId = socket.id;
            // The phone page is served by the Vite server on port 5173 (window.location.origin)
            const phoneUrl = `${window.location.origin}/sender.html?hostId=${hostId}`;
            generateQR(phoneUrl);
            if (overlayStatusEl) overlayStatusEl.textContent = 'Waiting for someone to scan…';
            setStatus('Ready. Share the QR code to connect a phone.');
        });

        socket.on('peer-joined', (peerId: string) => {
            console.log('HOST SOCKET: Peer joined:', peerId);
            setStatus('Phone scanned. Starting the peer connection...');
            if ($overlayStatus) $overlayStatus.textContent = 'Connecting...';
            createPeer(peerId);
        });

        socket.on('signal', (myId: string, signal: any, senderId: string) => {
            const targetPeerId = senderId || myId;
            console.log('HOST SOCKET: Received signal from:', targetPeerId, 'Type:', signal.type || 'candidate');
            if (!peer) {
                console.log('HOST SOCKET: No peer exists, creating one');
                createPeer(targetPeerId);
            }

            if (peer) {
                try {
                    if (signal.type === 'offer' || signal.type === 'answer') {
                        console.log('HOST PEER: Signaling SDP', signal.type);
                        hasRemoteDescription = true;
                        peer.signal(signal);
                        console.log('HOST PEER: Processing queue of length:', signalQueue.length);
                        signalQueue.forEach(sig => {
                            try { peer.signal(sig); } catch (e) { console.error('HOST PEER: Error playing queued signal:', e); }
                        });
                        signalQueue = [];
                    } else {
                        if (hasRemoteDescription) {
                            console.log('HOST PEER: Signaling candidate');
                            peer.signal(signal);
                        } else {
                            console.log('HOST PEER: Queueing candidate');
                            signalQueue.push(signal);
                        }
                    }
                } catch (error) {
                    console.error('HOST PEER: Signal error:', error);
                }
            }
        });

        socket.on('disconnect', () => {
            setStatus('Disconnected from the signaling server.');
            showOverlay('Disconnected', 'Disconnected from signaling server. QR ready after reconnect.');
        });
    };

    // Initialize Snap Camera Kit
    try {
        setStatus('Initializing Snap Camera Kit...');
        const cameraKit = await bootstrapCameraKit({
            apiToken: 'eyJhbGciOiJIUzI1NiIsImtpZCI6IkNhbnZhc1MyU0hNQUNQcm9kIiwidHlwIjoiSldUIn0.eyJhdWQiOiJjYW52YXMtY2FudmFzYXBpIiwiaXNzIjoiY2FudmFzLXMyc3Rva2VuIiwibmJmIjoxNzgwNjcxNjY0LCJzdWIiOiI5ZWY0MGRhNC00MTE2LTRhYzQtYTA5ZC1hN2ZhM2YzMmY3ODl-U1RBR0lOR343MWMzYTBmNC02NTcxLTRlZmItOGM1OS02MmZiOGMwYzhhNWYifQ.Jk60HZ2FzcuF4OlxJwlPs7ptviVNHEQ2YBY1H-B3j7k',
        });

        const session = await cameraKit.createSession({ liveRenderTarget });
        
        // Capture webcam stream as input to Camera Kit
        myStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });

        await session.setSource(myStream);
        await session.play();

        // Load and apply the Crown Tryout Lens
        const lens = await cameraKit.lensRepository.loadLens(
            'ca448eb7-93b0-474a-a73f-133770fa064f',
            '381ce689-4be4-41ac-8b15-107b9d37999d'
        );
        await session.applyLens(lens);

        setStatus('Camera ready. Waiting for a phone scan.');
        
        // Setup Socket and WebRTC signaling once camera is ready
        initSocket();
    } catch (err: any) {
        console.error('Initialization failed:', err);
        setStatus('Failed: ' + err.message);
        showOverlay('Permissions needed', 'Camera access is required for the host installation.');
    }
})();