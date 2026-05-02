# Smart Flood Dashboard

This is the frontend part of the Smart Flood AI Monitoring system, built with Next.js.

## Overview
The dashboard provides a real-time command center for monitoring flood situations across multiple CCTV nodes. It features:
- **Interactive Map**: View all camera locations and statuses.
- **AI View**: Watch live streams with Grounding DINO object detection overlays.
- **Smart Routing**: Calculate paths that avoid flooded areas.
- **Command Center**: Broadcast alerts to LINE OA.

## Setup
1. Configure your Google Maps API key in `.env.local`:
   ```env
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

Refer to the root [README.md](../README.md) for full project documentation.
