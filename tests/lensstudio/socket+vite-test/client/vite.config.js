// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
    plugins: [react(), basicSsl()],  // basicSsl generates a self-signed cert
    server: {
        host: true,    // exposes to LAN — Vite will print the 192.168.x.x URL
        https: true,   // required for getUserMedia on mobile over LAN
        port: 5173,
        proxy: {
            '/socket.io': {
                target: 'http://localhost:3001',
                ws: true,  // proxy WebSocket upgrades to your signaling server
            }
        }
    }
});