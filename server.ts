import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { createProxyMiddleware } from 'http-proxy-middleware';

const PORT = 3000;
const ROUTING_SERVICE_URL = process.env.ROUTING_SERVICE_URL || 'http://localhost:8000';

interface Vector2D {
  x: number;
  y: number;
}

interface Rover {
  id: string;
  mission: 'NASA' | 'ISRO' | 'CNSA' | 'ESA' | 'ROVER_INT';
  realPos: Vector2D;
  imuPos: Vector2D;
  aiPos: Vector2D;
  status: 'active' | 'calibrating' | 'stuck';
  battery: number;
}

// Simulated Digital Elevation Model (DEM) Engine
class MarsTerrainEngine {
  private size = 2000;
  public dem: Float32Array;

  constructor() {
    this.dem = new Float32Array(this.size * this.size);
    this.generateSyntheticDEM();
  }

  private generateSyntheticDEM() {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const idx = y * this.size + x;
        let alt = -2400; 
        const distCenter = Math.sqrt(Math.pow(x - 1000, 2) + Math.pow(y - 1000, 2));
        alt += Math.sin(distCenter / 100) * 50; 
        alt += Math.random() * 5; 
        this.dem[idx] = alt;
      }
    }
  }

  public getElevation(x: number, y: number): number {
    const ix = Math.floor(Math.max(0, Math.min(this.size - 1, x)));
    const iy = Math.floor(Math.max(0, Math.min(this.size - 1, y)));
    return this.dem[iy * this.size + ix];
  }

  public findScientificPath(start: Vector2D, goal: Vector2D) {
    const path: Vector2D[] = [];
    const steps = 15;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = start.x + (goal.x - start.x) * t;
        const y = start.y + (goal.y - start.y) * t;
        path.push({ x, y: y + Math.sin(t * Math.PI) * 50 });
    }
    return path;
  }
}

class MarsSimulation {
  public rovers: Rover[] = [];
  public terrain: MarsTerrainEngine;
  private io: Server;
  private tickRate = 2000; // ms

  constructor(io: Server) {
    this.io = io;
    this.terrain = new MarsTerrainEngine();
    this.initRovers();
    this.startLoop();
  }

  public reset() {
    this.initRovers();
  }

  private initRovers() {
    const fleet = [
      { id: 'Perseverance-X', mission: 'NASA' },
      { id: 'Mangalyaan-R1', mission: 'ISRO' },
      { id: 'Zhurong-Z2', mission: 'CNSA' },
      { id: 'Rosalind-E1', mission: 'ESA' },
      { id: 'Curiosity-MK2', mission: 'NASA' },
      { id: 'ExoMars-TGO', mission: 'ESA' }
    ];

    this.rovers = fleet.map((f, i) => ({
      id: f.id,
      mission: f.mission as any,
      realPos: { x: 400 + (i % 3) * 500, y: 400 + Math.floor(i / 3) * 500 },
      imuPos: { x: 400 + (i % 3) * 500, y: 400 + Math.floor(i / 3) * 500 },
      aiPos: { x: 400 + (i % 3) * 500, y: 400 + Math.floor(i / 3) * 500 },
      status: 'active',
      battery: 80 + Math.random() * 20
    }));
  }

  private startLoop() {
    setInterval(() => {
      this.updateRovers();
      this.io.emit('swarm_telemetry', this.rovers);
    }, this.tickRate);
  }

  private updateRovers() {
    this.rovers = this.rovers.map(rover => {
      if (rover.battery <= 0) return { ...rover, status: 'stuck' };

      const time = Date.now() / 5000 + (this.rovers.indexOf(rover) * 10);
      const dx = Math.cos(time) * 15 + (Math.random() - 0.5) * 5;
      const dy = Math.sin(time) * 15 + (Math.random() - 0.5) * 5;

      const newReal = {
        x: Math.max(100, Math.min(1900, rover.realPos.x + dx)),
        y: Math.max(100, Math.min(1900, rover.realPos.y + dy))
      };

      const terrainRoughness = 1 + Math.abs(this.terrain.getElevation(newReal.x, newReal.y)) / 5000;
      const driftX = (Math.random() - 0.45) * 8 * terrainRoughness; 
      const driftY = (Math.random() - 0.45) * 8 * terrainRoughness;
      
      const newImu = {
        x: rover.imuPos.x + dx + driftX,
        y: rover.imuPos.y + dy + driftY
      };

      let newAi = {
        x: rover.aiPos.x + dx,
        y: rover.aiPos.y + dy
      };

      let currentStatus = rover.status;
      const currentDrift = Math.sqrt(Math.pow(newAi.x - newReal.x, 2) + Math.pow(newAi.y - newReal.y, 2));
      
      if (currentDrift > 150 || (Math.random() > 0.95)) {
        currentStatus = 'calibrating';
        newAi.x = newAi.x + (newReal.x - newAi.x) * 0.85;
        newAi.y = newAi.y + (newReal.y - newAi.y) * 0.85;
      } else {
        currentStatus = 'active';
      }

      return {
        ...rover,
        realPos: newReal,
        imuPos: newImu,
        aiPos: newAi,
        status: currentStatus,
        battery: Math.max(0, rover.battery - 0.05)
      };
    });
  }
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  const sim = new MarsSimulation(io);

  // API Routes
  app.get("/api/swarm", (req, res) => {
    res.json(sim.rovers);
  });

  app.post("/api/swarm/reset", (req, res) => {
    sim.reset();
    res.json({ status: "reset_complete" });
  });

  // Scientific Proxy Routes
  app.use('/api/v1/routes', createProxyMiddleware({
    target: ROUTING_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/v1/routes': '/api/v1/routes' }
  }));

  app.use('/api/v1/terrain', createProxyMiddleware({
    target: ROUTING_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/v1/terrain': '/api/v1/terrain' }
  }));

  app.use('/api/v1/swarm', createProxyMiddleware({
    target: ROUTING_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/v1/swarm': '/api/v1/swarm' }
  }));

  app.get("/api/scientific/datasets", (req, res) => {
    res.json({
      satellite_sources: [
        { id: "MRO_HiRISE", agency: "NASA", resolution: "0.25m/px", description: "High Resolution Imaging Science Experiment" },
        { id: "MOM_MCC", agency: "ISRO", resolution: "25m/px", description: "Mars Color Camera - Global Context" },
        { id: "TGO_CASSIS", agency: "ESA/Roscosmos", resolution: "4.5m/px", description: "Colour and Stereo Surface Imaging System" },
        { id: "TIANWEN_HiRIC", agency: "CNSA", resolution: "0.5m/px", description: "High-Resolution Imaging Camera" },
        { id: "EUSPA_EU_SPACE", agency: "EUSPA", resolution: "N/A", description: "The European Union Space Programme is an EU funding programme established in 2021 along with its managing agency, the European Union Agency for the Space Programme, in order to implement the pre-existing European Space Policy established on 22 May 2007. This was the first common political framework for space activities." }
      ],
      coordinate_system: "MOLA Planetocentric",
      datum: "Mars2000"
    });
  });

  app.get("/api/scientific/route", (req, res) => {
    const { startX, startY, endX, endY } = req.query;
    const start = { x: Number(startX), y: Number(startY) };
    const end = { x: Number(endX), y: Number(endY) };
    const path = sim.terrain.findScientificPath(start, end);
    res.json({
        algorithm: "A* (Slope-Constrained)",
        path,
        computation_time: "42ms",
        hazard_risk: 0.15
    });
  });

  app.get("/api/terrain/anomalies", (req, res) => {
    res.json([
      { lat: "18.4N", lon: "77.5E", type: "Deltaic Fan", risk_level: "Medium", name: "Jezero Crater Delta" },
      { lat: "1.2S", lon: "175.4E", type: "Aeolian Bedform", risk_level: "High", name: "Gale Crater Dunes" }
    ]);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Mars Mission Server running on http://localhost:${PORT}`);
  });
}

startServer();
