# Smart Flood AI: Real-Time Monitoring & Command Center

An intelligent flood surveillance and analysis system powered by Zero-Shot AI (Grounding DINO), featuring a professional Command Center for disaster management, flood-aware routing, and real-time alerts via LINE OA.

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

---

## Key Features

### 1. AI-Powered Depth Estimation
- **Zero-Shot Detection**: Leverages **Grounding DINO** to detect "Cars" and "Wheels" instantly without any custom training or labeled datasets.
- **Submerged Analysis**: Automatically calculates water depth in centimeters (cm) by analyzing the submersion ratio of vehicle wheels relative to their expected full size.
- **Real-time Visualization**: Dynamic bounding boxes and depth metadata are overlaid on video captures for administrative verification.

### 2. Intelligent Command Dashboard
- **Interactive Geospatial Map**: Full Google Maps integration showing CCTV locations with live status indicators (Green: Normal, Yellow: Warning, Red: Critical).
- **Flood-Aware Routing**: A smart navigation engine that automatically **calculates detour routes** to bypass flooded zones (within a 5km radius of critical alerts).
- **High-Performance Streaming**: Resource-optimized MJPEG live streams ensuring smooth 30FPS monitoring across multiple concurrent camera feeds.

### 3. Human-in-the-Loop Alert System
- **Verification Workflow**: Officers can review AI detections and "Confirm" flood events before broadcasting, reducing false alarms.
- **Rich Media Alerts**: Disseminates professional **LINE Flex Message Carousels** containing live site captures, precise water level data, and direct map links.
- **Emergency Broadcast**: One-click rapid dissemination to all subscribers during emergency events.

### 4. Secure Authentication & RBAC
- **Firebase Integration**: Secure login system via Firebase Authentication (Email/Password & Google Login).
- **Role-Based Access Control**: 
  - **Admin**: Full control to Confirm/Reject alerts, Resolve flood zones, and Broadcast to LINE.
  - **Public/Guest**: Read-only access to view live feeds, confirmed flood zones, and use smart routing.
- **Real-time State Sync**: Flood confirmations are synced globally via Firestore, ensuring all users see the same map status regardless of page refreshes.

---

## How It Works (AI Logic)

1.  **Inference**: The system uses `Grounding DINO` with the prompt `"wheel. car."` to identify objects in each frame.
2.  **Association**: Detected wheels are matched to their respective car bounding boxes based on spatial proximity.
3.  **Depth Calculation**:
    - The system identifies "valid" wheels (those at the bottom of the car).
    - It calculates the ratio between the visible wheel height and its estimated full diameter.
    - Water depth is derived using a standardized wheel height reference (approx. 60cm for standard vehicles).
4.  **State Management**: Real-time updates are pushed to the frontend, which triggers UI changes (map pin colors, sidebar warnings).

---

## Tech Stack

### Backend (AI Engine & API)
*   **Python (FastAPI)**: High-performance core for AI inference and MJPEG streaming.
*   **PyTorch & Transformers**: Powering the Grounding DINO model (supports CUDA/MPS/CPU).
*   **OpenCV**: Advanced video handling, image processing, and MJPEG generation.
*   **Uvicorn**: Lightning-fast ASGI server implementation.

### Frontend (Command Center)
*   **Next.js 15 (App Router)**: Modern React framework for seamless, server-side rendered performance.
*   **Tailwind CSS**: Premium design system with dark-mode optimization and fluid transitions.
*   **Google Maps API**: Advanced Geospatial services, Geocoding, and Directions API for smart routing.
*   **Lucide React**: Vector-based iconography for a clean, modern aesthetic.

---

## Getting Started

### 1. Prerequisites
- Python 3.10+
- Node.js 18+
- A Google Maps API Key
- A LINE Messaging API Channel Access Token

### 2. Environment Configuration
Create a `.env` file in the **root directory**:
```env
LINE_OA_TOKEN=your_channel_access_token
LINE_OA_USER_ID=your_target_user_id (optional, defaults to broadcast)
PUBLIC_BASE_URL=your_public_url (e.g., via Cloudflare Tunnel)
```

Create a `smart-flood-dashboard/.env.local` file:
```env
# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Firebase Client (Frontend)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Firebase Admin (Backend/API) - Service Account
FIREBASE_ADMIN_PROJECT_ID=...
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Backend URL
BACKEND_API_URL=http://localhost:8000
```

### 3. Backend Installation
```bash
# Install Python dependencies
pip install -r requirements.txt

# Start the AI Server (Runs on port 8000)
python server.py
```

### 4. Frontend Installation
```bash
cd smart-flood-dashboard
npm install
npm run dev
```
The dashboard will be available at [http://localhost:3000](http://localhost:3000).

### 5. Setting up Admin Status
To grant a user **Admin** privileges:
1. Register a user via the application UI.
2. Open **Firebase Console** -> **Firestore Database**.
3. Create a collection named `admins`.
4. Create a document with the **User's UID** as the Document ID.
5. (Optional) Add fields like `email` or `name` for reference.

---

## Alert State Machine

| Status | Trigger | Action |
| :--- | :--- | :--- |
| **Normal** | Water < 30cm | Continuous AI monitoring. |
| **Pending Alert** | Water ≥ 30cm | **(Admin Only)** Alert popup appears with live capture. |
| **Confirmed Danger** | Admin clicks **Confirm** | Red 5km circle appears on map for **ALL** users. Image is saved to disk. |
| **Resolved** | Admin clicks **Resolve** | Red circle vanishes. Alert is re-armed for next flood event. |

---

## Project Structure

```text
├── server.py                # AI Heartbeat: Inference, Streaming, & Alerts
├── requirements.txt         # Python dependencies
├── captures/                # Storage for AI-annotated alert evidence
├── smart-flood-dashboard/   # Next.js Frontend Application
│   ├── src/components/
│   │   ├── Map.tsx          # Geospatial logic & Smart Routing
│   │   ├── Sidebar.tsx      # Camera fleet management & controls
│   │   └── CCTVPopup.tsx    # Live AI Vision interface
│   └── .env.local           # Frontend environment config
└── Dataset/                 # Local video samples for simulation
```

---

## Development Team
*   **Panupong-xD**
*   **Kulachart**

---
*Developed for the DOH Hackathon - Bridging AI and Disaster Management.*