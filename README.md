# Saarthi — Privacy-First Digital Safety Infrastructure

> **Live Demo:** [saarthi-app-eta.vercel.app](https://saarthi-app-eta.vercel.app)  
> **GitHub:** [ishaansatapathy/Sahayak](https://github.com/ishaansatapathy/Sahayak)

---

## What is Saarthi?

Saarthi is a real-time personal safety platform built for India's urban mobility and identity crisis.  
It protects individuals using **cryptographic proof** instead of storing sensitive data — combining intelligent route monitoring, secure emergency escalation, and offline-resilient communication.

The name *Saarthi* (सारथि) means **guardian** or **charioteer** — someone who guides and protects.

---

## The Problem

| Problem | Reality |
|---------|---------|
| Raw identity storage | Platforms store unencrypted personal data in centralized servers. One breach = everyone exposed. |
| Ride-sharing safety gaps | Vulnerable users have no real-time route monitoring or tamper-proof emergency alerts. |
| Emergency connectivity loss | Internet outages during crises cut off the very systems meant to save lives. |
| No verifiable emergency proof | Alerts can be faked — police have no way to verify if an SOS is authentic. |

---

## The Solution — Three Pillars

### 🔐 Cryptographic Identity Vault
Generate **SHA-256 hashes** of documents (Aadhaar, PAN, ID cards) client-side.  
Only the hash is stored — never the raw document. Zero server storage.  
Prove your identity **without exposing your data**.

### 🚕 Smart Cab Safety Monitor
Real-time GPS tracking with **OSRM road routing**, 300m geo-fence corridor, and dynamic **Risk Score Engine** (0–100).  
Deviation triggers a **cryptographically signed emergency packet** (RSA-PSS via Web Crypto API).  
Offline mode switches to a relay simulation layer automatically.

### 🚔 Police Intelligence Dashboard
Live emergency feed from the cab module via **Socket.io**.  
Every incoming alert is **RSA signature-verified** in the browser.  
Green tactical UI shows nearest police station jurisdiction, animated connection lines, and sector monitoring.

---

## USPs (Unique Selling Points)

- **Zero raw data storage** — All hashing is client-side using the browser's native Web Crypto API. The server never sees your documents.
- **Tamper-proof emergency alerts** — RSA-PSS signed packets mean police can verify that an SOS was not forged.
- **Offline-first design** — Relay mode activates automatically on network loss, queues alerts, and re-syncs on reconnect.
- **Real road routing** — Cab simulation follows actual road geometry via OSRM (Open Source Routing Machine), not straight lines.
- **Dynamic fare + risk engine** — Fares calculated from real route distance/duration. Risk score escalates based on corridor deviation time.
- **Route-progress police jurisdiction** — Police nodes are assigned based on the car's actual progress along the route, not static radius circles.
- **No third-party APIs with cost** — Leaflet + OpenStreetMap + OSRM + Nominatim. Entirely free and open.

---

## MVP Features

### Identity Vault (`/wallet`)
- [x] Drag & drop document upload
- [x] Client-side SHA-256 hashing (Web Crypto API)
- [x] Animated "Generating Cryptographic Proof" experience
- [x] Typing animation hash reveal
- [x] Glassmorphism proof cards (preview, copy, remove)
- [x] Identity Strength panel with animated progress ring
- [x] Zero raw data badge indicators

### Smart Cab (`/cab`)
**Booking Flow**
- [x] Pin destination on map (Leaflet click)
- [x] OSRM real road route fetch + polyline
- [x] Dynamic fare calculation (base + per-km × 4 vehicle types)
- [x] Driver assignment + ETA countdown

**Trip Monitoring**
- [x] GPS geolocation with `watchPosition`
- [x] Real road simulation (marker moves along OSRM waypoints)
- [x] Turf.js 300m corridor buffer around route
- [x] Deviation detection → Risk Score escalation (SAFE → WARNING → CRITICAL)
- [x] RSA-PSS key generation on trip start
- [x] Signed emergency packet emission on CRITICAL
- [x] Offline map fallback (tile layer removed, dark static mode)
- [x] Relay mode simulation with queued packets

**Police Jurisdiction**
- [x] 5 nodes placed along route with perpendicular offsets
- [x] Route-progress engagement (0–20%, 20–40%, …)
- [x] Animated dotted SVG polyline from active node to car
- [x] Active node glowing pulse indicator

**Demo Control Panel**
- [x] Simulate Safe / Mild / Critical Deviation
- [x] Trigger Emergency Instantly
- [x] Toggle Offline Mode

### Police Dashboard (`/police`)
- [x] Real-time Socket.io alert feed
- [x] RSA-PSS signature verification in browser
- [x] Green/red verified badge per alert
- [x] Leaflet map with police stations + 2km range circles
- [x] Tactical scanning pulse animation
- [x] Nearest station jurisdiction logic

---

## Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| React 19 + Vite | UI framework, fast HMR dev server |
| TypeScript | Type safety across all modules |
| Tailwind CSS | Utility-first styling |
| Framer Motion | Animations (fade-in, parallax, progress bars) |
| React Router v7 | Client-side routing |
| Leaflet.js | Interactive maps (OpenStreetMap tiles) |
| Turf.js | Geospatial buffer, point-in-polygon, distance |
| Three.js | Particle background in hero section |
| Web Crypto API | SHA-256 hashing, RSA-PSS sign/verify (native browser) |
| Socket.io Client | Real-time emergency events |
| Lucide React | Icon library |

### Backend
| Technology | Purpose |
|-----------|---------|
| Node.js + Express | REST API server |
| Socket.io | Real-time bidirectional events |
| CORS | Cross-origin frontend–backend communication |

### External APIs (all free/open)
| API | Purpose |
|-----|---------|
| OpenStreetMap / Leaflet | Map tiles |
| OSRM (router.project-osrm.org) | Real road routing, distance, duration |
| Nominatim | Location search geocoding |

### Deployment
| Service | What |
|---------|------|
| Vercel | Frontend (auto-deploys on `git push`) |
| Render | Backend Socket.io server |

---

## Project Structure

```
saarthi/
├── public/
│   ├── chakra.mp4          # Hero background video
│   ├── mini.png            # Vehicle icons
│   ├── sedan.png
│   ├── suv.png
│   └── premium.png
├── src/
│   ├── pages/
│   │   ├── HomePage.tsx        # Landing page (cinematic hero)
│   │   ├── WalletPage.tsx      # Identity vault page
│   │   ├── CabPage.tsx         # Cab booking + trip monitoring
│   │   └── PoliceDashboard.tsx # Police tactical dashboard
│   ├── components/
│   │   └── WalletSection.tsx   # Cryptographic identity vault UI
│   ├── lib/
│   │   ├── socket.ts           # Socket.io singleton client
│   │   ├── crypto.ts           # RSA-PSS sign/verify utilities
│   │   ├── geo.ts              # Geospatial types and helpers
│   │   └── utils.ts            # General utilities
│   ├── App.tsx                 # Router setup
│   └── index.css               # Global styles + keyframe animations
├── server/
│   ├── server.js               # Express + Socket.io main server
│   ├── crypto.js               # Server-side crypto helpers
│   ├── geo.js                  # Station data + geo logic
│   ├── intelligence.js         # Cab intelligence engine
│   └── package.json            # Backend dependencies
├── vercel.json                 # Vercel SPA routing config
└── package.json
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
# Clone the repo
git clone https://github.com/ishaansatapathy/Sahayak.git
cd Sahayak

# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install && cd ..
```

### Running Locally

```bash
# Terminal 1 – Frontend
npm run dev

# Terminal 2 – Backend (Socket.io)
npm run server
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:4000`

### Environment Variables

Create a `.env` file in the root:

```env
VITE_SERVER_URL=http://localhost:4000
```

For production, set `VITE_SERVER_URL` to your Render backend URL in Vercel's environment variables.

---

## Deployment

### Frontend → Vercel
```bash
npm install -g vercel
vercel login
vercel deploy --prod --yes --name saarthi-app
```

### Backend → Render
1. Go to [render.com](https://render.com) → New → Web Service
2. Connect `ishaansatapathy/Sahayak`
3. Settings:
   - **Root Directory:** `server`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
4. Copy the Render URL → add as `VITE_SERVER_URL` in Vercel env vars

---

## Security Architecture

```
User Document
     │
     ▼
SHA-256 Hash (browser, Web Crypto API)
     │
     ▼
Hash stored in React state / localStorage
     │  (raw file NEVER leaves the browser)
     ▼
Proof Card displayed to user

─────────────────────────────────────────

Trip Start
     │
     ▼
RSA-PSS Key Pair generated (Web Crypto API)
Private key → memory only (React ref)
Public key  → exported as base64

     │  (on CRITICAL deviation)
     ▼
Emergency payload JSON → SHA-256 digest
     │
     ▼
Sign digest with private key
     │
     ▼
{ payload, signature, publicKey } → Socket.io

─────────────────────────────────────────

Police Dashboard receives packet
     │
     ▼
Import publicKey → verify signature
     │
     ▼
✅ "Verified Emergency" or ❌ "Signature Invalid"
```

---

## Team

Built for **Hack-A-League** hackathon.

---

## License

MIT
