import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const socket = io();

export default function Viewer() {
    const remoteVideo = useRef();

    useEffect(() => {
        const peer = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        // Display remote stream when tracks arrive
        peer.ontrack = (e) => remoteVideo.current.srcObject = e.streams[0];

        peer.onicecandidate = ({ candidate }) => {
            if (candidate) socket.emit('ice-candidate', candidate);
        };

        socket.on('offer', async (offer) => {
            await peer.setRemoteDescription(offer);
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            socket.emit('answer', answer);
        });

        socket.on('ice-candidate', c => peer.addIceCandidate(c));
    }, []);

    return <video ref={remoteVideo} autoPlay playsInline style={{ width: '100%' }} />;
}