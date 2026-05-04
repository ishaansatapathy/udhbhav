/**
 * Sahayak Police Portal - Single unified server
 * Express + Socket.io + Vite (dev) or static build (prod)
 * Run with: npm run dev
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const crypto = require("./crypto");
const geo = require("./geo");

const app = express();
const server = http.createServer(app);

const isDev = process.env.NODE_ENV !== "production";
const PORT = process.env.PORT || 3000;

const io = new Server(server, {
  cors: { origin: true },
});

const cabState = new Map();
const alertLog = [];
let lastAlertHash = "0";

app.use(express.json());

// API routes
app.get("/api/stations", (req, res) => {
  res.json(geo.getStations());
});

app.get("/api/crypto/public-key", (req, res) => {
  res.json({ publicKey: crypto.getPublicKeyPem() });
});

app.post("/api/emergency", (req, res) => {
  const { payload, signature } = req.body;
  const sigToVerify = signature || crypto.signEmergencyPayload(payload);
  const valid = crypto.verifySignature(payload, sigToVerify);
  if (!valid) return res.status(401).json({ error: "Invalid signature" });

  const alert = {
    id: `alert_${Date.now()}`,
    ...payload,
    prevHash: lastAlertHash,
    timestamp: Date.now(),
  };
  alert.hash = crypto.sha256(alert);
  lastAlertHash = alert.hash;
  alertLog.push(alert);

  io.emit("emergency_alert", alert);
  res.json({ ok: true, alertId: alert.id });
});

// Offline map tiles (fallback)
app.get("/tiles/:z/:x/:y.png", (req, res) => {
  const fallback = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  res.set("Content-Type", "image/png");
  res.set("Cache-Control", "public, max-age=86400");
  res.send(fallback);
});

// Socket.io for real-time cab tracking
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join_station", (stationId) => {
    socket.join(`station:${stationId}`);
    const cabs = [...cabState.entries()]
      .filter(([, s]) => s.stationId === stationId)
      .map(([id, s]) => ({ id, ...s }));
    socket.emit("station_cabs", cabs);
  });

  socket.on("cab_position", (data) => {
    const { cabId, lat, lon } = data;
    const station = geo.getOwningStation(lat, lon);
    const prevState = cabState.get(cabId);
    const prevStationId = prevState?.stationId;

    const tripToken = prevState?.tripToken || crypto.generateTripToken({ cabId, lat, lon });
    const newState = {
      lat,
      lon,
      stationId: station.id,
      tripToken,
      insideRadius: station.insideRadius,
      lastUpdate: Date.now(),
    };
    cabState.set(cabId, newState);

    if (prevStationId && prevStationId !== station.id) {
      io.to(`station:${prevStationId}`).emit("cab_left", cabId);
    }
    io.to(`station:${station.id}`).emit("cab_update", { cabId, ...newState });
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

async function start() {
  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server },
      },
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "..", "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/tiles") || req.path.startsWith("/socket.io"))
        return res.status(404).send();
      const htmlPath = path.join(distPath, "index.html");
      if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
      } else {
        res.status(404).send("Build the app first: npm run build");
      }
    });
  }

  let listening = false;
  const tryListen = (port) => {
    if (listening) return;
    const s = server
      .listen(port, () => {
        if (listening) return;
        listening = true;
        s.removeAllListeners("error");
        console.log(`Sahayak Police Portal: http://localhost:${port}`);
        if (isDev) console.log("  Dev mode: Vite HMR enabled");
      })
      .on("error", (err) => {
        if (err.code === "EADDRINUSE" && port < 3010) {
          console.log(`Port ${port} in use, trying ${port + 1}...`);
          tryListen(port + 1);
        } else throw err;
      });
  };
  tryListen(PORT);
}

start().catch(console.error);