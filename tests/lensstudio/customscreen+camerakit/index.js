require('dotenv').config();
const os = require('os');
const isDevelopment = (process.env.NODE_ENV === 'development');
const express = require('express');
const app = express();
const fs = require('fs');

let options = {};
if (isDevelopment) {
    options = {
        key: fs.readFileSync('./localhost.key'),
        cert: fs.readFileSync('./localhost.crt')
    };
}

const server = require(isDevelopment ? 'https' : 'http').Server(options, app);
const port = process.env.PORT || 3000;

app.use(express.static('public'));

// server.listen(port, '0.0.0.0', () => {
//     console.log(`App listening on port ${port}!`);
//     console.log(`Local: https://localhost:${port}`);
// });

server.listen(port, () => {
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
        for (const iface of networkInterfaces[interfaceName]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`https://${iface.address}:${port}/receiver.html`);
            }
        }
    }
    console.log(`App listening on port ${port}!`);
});

const { Server } = require("socket.io");
const io = new Server(server);



const clients = {};
io.on('connection', socket => {
    console.log('New socket connected:', socket.id);
    clients[socket.id] = { id: socket.id };

    console.log('Current clients:', Object.keys(clients));
    io.emit('clients', clients);

    socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id);
        delete clients[socket.id];
        io.emit('clients', clients);
    });

    socket.on('signal', (peerId, signal) => {
        console.log(`Received signal from ${socket.id} to ${peerId}`);
        io.to(peerId).emit('signal', peerId, signal, socket.id);
    });

    socket.on('join', (hostId) => {
        console.log(`Socket ${socket.id} wants to join host ${hostId}`);
        io.to(hostId).emit('peer-joined', socket.id);
    });

    io.emit('clients', clients);

});