import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';

const socket = io(); // same origin → proxied by Vite to port 3001

export default function Host() {
    const localVideo = useRef();

    useEffect(() => {
        const run = async () => {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            localVideo.current.srcObject = stream;

            const peer = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });

            stream.getTracks().forEach(track => peer.addTrack(track, stream));

            peer.onicecandidate = ({ candidate }) => {
                if (candidate) socket.emit('ice-candidate', candidate);
            };

            // Receive ICE candidates and answer from viewer
            socket.on('ice-candidate', c => peer.addIceCandidate(c));
            socket.on('answer', answer => peer.setRemoteDescription(answer));

            // Kick off: create and send the offer
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            socket.emit('offer', offer);
        };
        run();
    }, []);

    const viewerUrl = `https://${window.location.hostname}:5173/viewer`;

    return (
        <div>
            <video ref={localVideo} autoPlay muted playsInline />
            <QRCodeSVG value={viewerUrl} size={200} />
            <p>Scan with your phone</p>
        </div>
    );
}