const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));

app.use(express.json({ limit: "25mb" }));

const { createClient } = require("@supabase/supabase-js");

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const clients = {};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

io.on('connection', socket => {
  clients[socket.id] = { id: socket.id };

  socket.on('disconnect', () => {
    console.log('disconnect');
    io.emit('client-disconnect', clients[socket.id]);
    delete clients[socket.id];
    io.emit('clients', clients);
  });

  socket.on('signal', (peerId, signal) => {
    console.log(`Received signal from ${socket.id} to ${peerId}`);
    io.to(peerId).emit('signal', peerId, signal, socket.id);
  });

  io.emit('clients', clients);
});

function dataUrlToBuffer(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*);base64/);
  const mime = mimeMatch?.[1] || "image/jpeg";

  return {
    buffer: Buffer.from(base64, "base64"),
    mime,
  };
}

app.post("/api/submissions", async (req, res) => {
  try {
    const {
      povId,
      decoratedImageDataUrl,
      cleanImageDataUrl,
      contactMode,
      contactValue,
      featureMe,
      captureLocation,
    } = req.body;

    if (!povId || !decoratedImageDataUrl) {
      return res.status(400).json({
        error: "Missing povId or image.",
      });
    }

    const submissionId = crypto.randomUUID();
    const bucket = process.env.SUPABASE_BUCKET || "submissions";

    const decoratedImage = dataUrlToBuffer(decoratedImageDataUrl);
    const decoratedPath = `${submissionId}/decorated.jpg`;

    const { error: decoratedUploadError } = await supabase.storage
      .from(bucket)
      .upload(decoratedPath, decoratedImage.buffer, {
        contentType: decoratedImage.mime,
        upsert: false,
      });

    if (decoratedUploadError) {
      throw decoratedUploadError;
    }

    let cleanPath = null;

    if (cleanImageDataUrl) {
      const cleanImage = dataUrlToBuffer(cleanImageDataUrl);
      cleanPath = `${submissionId}/clean.jpg`;

      const { error: cleanUploadError } = await supabase.storage
        .from(bucket)
        .upload(cleanPath, cleanImage.buffer, {
          contentType: cleanImage.mime,
          upsert: false,
        });

      if (cleanUploadError) {
        throw cleanUploadError;
      }
    }

    const { data, error: insertError } = await supabase
      .from("photo_submissions")
      .insert({
        pov_id: povId,
        decorated_image_path: decoratedPath,
        clean_image_path: cleanPath,
        contact_mode: contactMode,
        contact_value: contactValue,
        feature_me: featureMe,
        capture_location: captureLocation,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return res.json({
      success: true,
      submission: data,
    });
  } catch (error) {
    console.error("Could not save submission:", error);

    return res.status(500).json({
      error: "Could not save submission.",
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      status: error.status,
      statusCode: error.statusCode,
    });
  }
});

const port = 443;

server.listen(port, "0.0.0.0", () => {
  console.log(`Socket.IO server running on http://localhost:${port}`);
});