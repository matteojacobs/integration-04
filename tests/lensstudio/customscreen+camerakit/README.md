# Custom Screen

This project is a simple peer-to-peer installation screen.

The desktop host page generates a QR code that opens the phone join page with the host socket id. When the phone scans it, the browsers connect through `socket.io` signaling and `simple-peer`, then stream the host webcam to the phone. The phone does not need camera access; it only watches the installation feed and sends emoji overlays back to the host screen.

### What it does

- Generates a QR code from the host page.
- Auto-joins the phone as soon as the QR link opens.
- Streams the camera feed peer-to-peer with no game logic.
- Uses a tall portrait layout on both screens.
- Lets the phone place emoji overlays onto the host screen.
- Does not ask the phone for camera permissions.

### Main files

- [public/receiver.html](public/receiver.html) is the desktop host page.
- [public/sender.html](public/sender.html) is the phone join page.
- [index.js](index.js) is the HTTPS and socket relay server.

### Run

From `tests/customscreen`, install dependencies and start the server with `npm start`.