# 🛡️ Mars Maps Platform : Mars Planetary Swarm Intelligence

[![Mission Status](https://img.shields.io/badge/Mission-Active-blue.svg)](https://mars.nasa.gov/)
[![Engine](https://img.shields.io/badge/Engine-Python%203.10-green.svg)](/routing)
[![Dashboard](https://img.shields.io/badge/Dashboard-React%2018-orange.svg)](/src)
[![Security](https://img.shields.io/badge/Security-Firebase-yellow.svg)](/firestore.rules)

**OSS-2026** is an Open Science Swarm (OSS) framework designed for autonomous rover fleet coordination in GPS-denied planetary environments. It combines high-fidelity terrain analysis, CUDA-accelerated pathfinding, and Particle Swarm Optimization (PSO) to maintain localization accuracy during extended scientific sorties.

## 🚀 System Architecture

The project utilizes a bifurcated architecture to balance real-time visualization with heavy scientific computation:

1.  **Mission Control Dashboard (Node.js/React)**:
    -   Real-time telemetry streaming via WebSockets.
    -   AI-driven localization analysis using Gemini 3.
    -   Cloud-synced mission logs and fleet state via Firebase Firestore.
    -   Secure Google Authentication for orbital oversight.

2.  **Planetary Routing Engine (Python/FastAPI)**:
    -   **Mars Routes API**: A* pathfinding constrained by slope and surface roughness.
    -   **Mars Terrain Analysis API**: Local hazard detection and safety rating.
    -   **Swarm Optimization**: Global tuning of rover heuristics using Particle Swarm Intelligence.
    -   **Hardware Acceleration**: Native NVIDIA CUDA support for large-scale raster processing.

## 🛠️ Tech Stack

-   **Frontend**: React, Tailwind CSS, Motion (Framer), Lucide Icons.
-   **Backend**: Express, Socket.io, Firebase SDK.
-   **Scientific Engine**: FastAPI, NumPy, SciPy, GDAL/Rasterio (planned).
-   **Intelligence**: Google Gemini (AI Localization), PSO (Swarm Tuning).
-   **Infrastructure**: Docker Compose, Cloud-Init, GCP/AWS deployment templates.

## 📦 Getting Started

### Prerequisites

-   Docker & Docker Compose (Recommended)
-   Node.js 20+
-   Python 3.10+ (for local scientific development)

### Quick Start (Docker)

```bash
# Clone the repository
git clone https://github.com/user/mars-oss-2026.git
cd mars-oss-2026

# Launch the full stack (Dashboard + Prediction Engine)
docker-compose up --build
```

Access the dashboard at `http://localhost:3000`.

### Local Development

1.  **Dashboard**:
    ```bash
    npm install
    npm run dev
    ```

2.  **Routing Engine**:
    ```bash
    pip install -r requirements.txt
    python routing/main.py
    ```

## 📡 Firebase Configuration

The mission logs and fleet status are persisted via Firebase. Populate your `.env` file with credentials from the Firebase Console (Web App setup):

```env
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_PROJECT_ID=your_id
...
```

See `.env.example` for the full list of required variables.

## 🛡️ Security

Security is critical for planetary infrastructure. We use:
-   **Firestore Security Rules**: Strict path-based validation and relational identity checks.
-   **Google OAuth 2.0**: Restricted access to mission-critical commands.
-   **NVIDIA Container Toolkit**: Isolated GPU execution for the routing engine.

Refer to [SECURITY.md](./SECURITY.md) for vulnerability reporting.

## 🗺️ Data Sources

-   **HiRISE (DTM/RDR)**: High-resolution Jezero Crater datasets.
-   **MOLA (MEGDR)**: Global Mars altimetry for macro-routing.
-   **USGS Astrogeology**: Planetary coordinate transformations.

---

*This software is released under the Open Science License. For use in orbital or landed missions, contact the OSS-2026 steering committee.*
