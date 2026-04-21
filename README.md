# 🤖 RoverMania — AI-Powered Remote Rover Dashboard

A real-time Neubrutalist-styled rover command center built with **Next.js 16**, featuring live WebRTC video streaming, keyboard/touch D-pad controls, and a **Gemini 2.5 Flash** AI vision assistant that can analyze what the rover sees.

> **Made by Prerith.M**

---

## 📋 Table of Contents

1. [System Architecture](#system-architecture)
2. [Prerequisites](#prerequisites)
3. [Part 1 — Raspberry Pi Setup](#part-1--raspberry-pi-setup)
4. [Part 2 — Web App Setup](#part-2--web-app-setup)
5. [Using the Dashboard](#using-the-dashboard)
6. [Environment Variables Reference](#environment-variables-reference)
7. [Upgrade Notes & Future Ideas](#upgrade-notes--future-ideas)

---

## System Architecture

```
┌─────────────────────────────────────┐
│         Your Browser / PC           │
│    Next.js Dashboard (port 3000)    │
│  WebRTC Video ──►  Live Feed        │
│  WebSocket  ──►    Drive Commands   │
│  Gemini AI  ──►    Frame Analysis   │
└──────────────┬──────────────────────┘
               │ Same Wi-Fi Network
               ▼
┌─────────────────────────────────────┐
│         Raspberry Pi (rover)        │
│  IP: 10.248.130.62                  │
│  ┌─────────────┐  ┌───────────────┐ │
│  │  MediaMTX   │  │  WS Server    │ │
│  │  port 8889  │  │  port 8765    │ │
│  │ (WebRTC/    │  │ (Motor L/R    │ │
│  │  WHEP)      │  │  commands)    │ │
│  └─────────────┘  └───────────────┘ │
└─────────────────────────────────────┘
```

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 18.x |
| npm | ≥ 9.x |
| Raspberry Pi OS | Bullseye or Bookworm (64-bit recommended) |
| Raspberry Pi Camera | v2 or HQ Camera Module |
| Google Gemini API Key | [Get one free here](https://aistudio.google.com/app/apikey) |

---

## Part 1 — Raspberry Pi Setup

### Step 1: Connect the rover to Wi-Fi

Boot your Pi and connect it to the **same Wi-Fi network** as your computer. Find its local IP address:

```bash
hostname -I
```

> 📌 Note the IP (e.g., `10.248.130.62`). You will need it in Step 4.

---

### Step 2: Enable the Camera

```bash
sudo raspi-config
```

Go to **Interface Options → Camera** and enable it. Reboot.

Verify the camera is detected:

```bash
libcamera-hello --list-cameras
```

---

### Step 3: Install MediaMTX (WebRTC Video Streamer)

MediaMTX handles streaming your camera feed over WebRTC using the WHEP protocol.

```bash
# Download the latest release for ARM64 (Pi 4/5) or ARM (Pi 3)
wget https://github.com/bluenviron/mediamtx/releases/latest/download/mediamtx_linux_arm64v8.tar.gz

# Extract
tar -xzf mediamtx_linux_arm64v8.tar.gz

# Move to a permanent location
sudo mv mediamtx /usr/local/bin/
sudo mv mediamtx.yml /usr/local/etc/
```

Edit `mediamtx.yml` to add your camera source:

```yaml
paths:
  cam:
    source: rpiCamera
    rpiCameraWidth: 1280
    rpiCameraHeight: 720
    rpiCameraFPS: 30
```

Start MediaMTX:

```bash
mediamtx /usr/local/etc/mediamtx.yml
```

Verify video is streaming by opening in a browser on your PC:
`http://<PI_IP>:8889/cam/` — you should see a WebRTC player.

**To run MediaMTX automatically on boot:**

```bash
sudo nano /etc/systemd/system/mediamtx.service
```

Paste:

```ini
[Unit]
Description=MediaMTX Rover Stream
After=network.target

[Service]
ExecStart=/usr/local/bin/mediamtx /usr/local/etc/mediamtx.yml
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable mediamtx
sudo systemctl start mediamtx
```

---

### Step 4: Set Up the WebSocket Motor Control Server

Create a Python WebSocket server on the Pi that listens for `{ L: float, R: float }` JSON commands and drives your motors accordingly.

Install dependencies:

```bash
pip install websockets RPi.GPIO
```

Create `/home/pi/rover_ws.py`:

```python
import asyncio
import websockets
import json
import RPi.GPIO as GPIO

# --- Configure your GPIO motor pins below ---
LEFT_FORWARD  = 17
LEFT_BACKWARD = 18
RIGHT_FORWARD = 22
RIGHT_BACKWARD = 23

GPIO.setmode(GPIO.BCM)
for pin in [LEFT_FORWARD, LEFT_BACKWARD, RIGHT_FORWARD, RIGHT_BACKWARD]:
    GPIO.setup(pin, GPIO.OUT)

def drive(left, right):
    GPIO.output(LEFT_FORWARD,   GPIO.HIGH if left  > 0 else GPIO.LOW)
    GPIO.output(LEFT_BACKWARD,  GPIO.HIGH if left  < 0 else GPIO.LOW)
    GPIO.output(RIGHT_FORWARD,  GPIO.HIGH if right > 0 else GPIO.LOW)
    GPIO.output(RIGHT_BACKWARD, GPIO.HIGH if right < 0 else GPIO.LOW)

async def handler(websocket):
    print("Controller connected")
    try:
        async for message in websocket:
            data = json.loads(message)
            drive(data.get("L", 0), data.get("R", 0))
    finally:
        drive(0, 0)  # Stop motors on disconnect
        print("Controller disconnected")

async def main():
    async with websockets.serve(handler, "0.0.0.0", 8765):
        print("WebSocket motor server running on port 8765")
        await asyncio.Future()  # Run forever

asyncio.run(main())
```

**Run the motor server:**

```bash
python3 /home/pi/rover_ws.py
```

**Auto-start on boot:**

```bash
sudo nano /etc/systemd/system/rover-ws.service
```

```ini
[Unit]
Description=Rover WebSocket Motor Server
After=network.target

[Service]
ExecStart=/usr/bin/python3 /home/pi/rover_ws.py
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable rover-ws
sudo systemctl start rover-ws
```

---

### Step 5: Update the Pi IP in the Web App

Open `rovermania/src/app/page.tsx` and update line 21 with your Pi's actual IP:

```ts
const PI_IP = "10.248.130.62"; // ← Change this to your Pi's IP
```

---

## Part 2 — Web App Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/PrerithM/AdvancedRover.git
cd AdvancedRover/rovermania
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment Variables

Create `.env.local` in the `rovermania/` directory:

```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

> Get a free API key at [Google AI Studio](https://aistudio.google.com/app/apikey)

### Step 4: Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Step 5: Build for Production (Optional)

```bash
npm run build
npm run start
```

---

## Using the Dashboard

### 🔐 Login

The dashboard is password-protected. When you first open the app you'll be redirected to the login page.

**Default password:** `PrerithRover`

> To change the password, edit `src/app/api/auth/route.ts` line 9.

---

### 🎮 Driving the Rover

| Control | Action |
|---|---|
| `W` / `↑` | Move Forward |
| `S` / `↓` | Move Backward |
| `A` / `←` | Turn Left |
| `D` / `→` | Turn Right |
| Release key | Stop |
| On-screen D-Pad | Touch / click to drive |

The **connection status** badge at the top shows whether the dashboard is connected to the rover's WebSocket server. If it shows **Disconnected**, ensure the Pi's motor server is running.

---

### 📹 Live Video Feed

The video feed uses **WebRTC (WHEP protocol)** directly from MediaMTX — no middleman, ultra-low latency. Make sure MediaMTX is running on the Pi and you are on the **same network**.

---

### 🤖 AI Vision (Gemini)

Click the **🤖 button** (in fullscreen mode) or use the **Rover Vision** panel (in normal mode) to activate the AI assistant.

- Type any question in the chat box and press **Enter** or **Send**
- The AI will capture the **current video frame** and analyze it using **Gemini 2.5 Flash**
- Example prompts:
  - *"Is there an obstacle ahead?"*
  - *"What color is the object in front of the rover?"*
  - *"Describe the terrain."*

---

### ⛶ Fullscreen Mode

Click the **⛶ Fullscreen** button on the video panel to enter immersive mode:
- D-Pad overlaid bottom-left
- AI chat accessible via the 🤖 FAB button bottom-right
- Click **Exit Fullscreen** to return

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ Yes | Your Google Gemini API key for AI vision |

---

## Upgrade Notes & Future Ideas

### 🔋 Planned / Suggested Upgrades

#### Hardware
- **Motor Driver with PWM** — Replace simple GPIO on/off with PWM speed control (e.g., L298N or TB6612FNG) for variable speed and smoother driving
- **Battery Voltage Monitor** — Add an INA219 sensor and display rover battery level on the dashboard
- **Ultrasonic / LIDAR Sensor** — Mount a distance sensor and display a proximity warning in the UI
- **Servo Camera Mount** — Add a pan/tilt servo for the camera and expose controls in the dashboard
- **GPS Module** — Add a GPS module (e.g., Neo-6M) and display rover coordinates/path on a map widget

#### Software
- **HTTPS / Secure Deployment** — Deploy on Cloudflare Pages or Vercel so the dashboard is accessible remotely without needing to be on the same LAN. Use Cloudflare Tunnel to expose the Pi's WebSocket and video server securely to the internet
- **Password Hashing** — Replace the plaintext password comparison in `auth/route.ts` with a hashed secret stored in an environment variable (`ROVER_PASSWORD_HASH`)
- **Gamepad API** — Add support for physical USB/Bluetooth gamepads using the browser `Gamepad API`
- **AI Autonomous Mode** — Use Gemini's vision in a loop to give the rover basic obstacle-avoidance logic from AI descriptions
- **Recording / Clip Saving** — Add a "Record" button that saves video clips from the WebRTC stream using the `MediaRecorder API`
- **Multi-User / Room System** — Add session rooms so multiple users can watch the stream but only one can control at a time (using a "Claim Control" button)
- **Telemetry Panel** — Add a telemetry sidebar with a command history log, ping latency, and FPS counter for the video stream

#### Cloudflare Deployment Checklist
- [ ] Set `GEMINI_API_KEY` in Cloudflare Pages → Settings → Environment Variables
- [ ] Use **Cloudflare Tunnel** (`cloudflared`) to expose `ws://<PI_IP>:8765` and `http://<PI_IP>:8889` to public HTTPS endpoints
- [ ] Update `PI_IP` in `page.tsx` to use the tunnel URLs
- [ ] Set `secure: true` on the auth cookie (already conditional on `NODE_ENV === production`)

---

## 🗂️ Project Structure

```
AdvancedRover/
└── rovermania/                 # Next.js Web App
    ├── src/
    │   ├── proxy.ts            # Auth middleware (cookie guard)
    │   └── app/
    │       ├── page.tsx        # Main rover dashboard UI
    │       ├── layout.tsx      # Root layout
    │       ├── globals.css     # Global styles
    │       ├── login/
    │       │   └── page.tsx    # Password login page
    │       └── api/
    │           ├── auth/
    │           │   └── route.ts  # Login endpoint (sets cookie)
    │           └── vision/
    │               └── route.ts  # Gemini AI vision endpoint
    ├── .env.local              # Your secret API key (never commit this)
    ├── next.config.ts
    └── package.json
```

---

## ⚠️ Security Notes

- **Never commit `.env.local`** — it contains your Gemini API key. It is already in `.gitignore`.
- The default password `PrerithRover` is hardcoded — change it before any public deployment and move it to an environment variable.
- The dashboard is local-network-only by default. Do not expose it to the internet without setting up HTTPS and a proper tunnel.

---

*Built with Next.js 16 · Gemini 2.5 Flash · MediaMTX · WebRTC · Neubrutalism UI*
