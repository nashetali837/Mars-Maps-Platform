import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "motion/react";
import { 
  Rocket, 
  Map as MapIcon, 
  Radio, 
  Battery, 
  Crosshair, 
  AlertTriangle, 
  Cpu,
  Navigation,
  Activity,
  Layers,
  Settings,
  ChevronRight,
  Code,
  LogIn,
  LogOut,
  User 
} from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import { auth, db, login, logout, logMissionEvent, syncRoverState, handleFirestoreError, OperationType } from "./lib/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";

// Types
interface Vector2D {
  x: number;
  y: number;
}

interface Rover {
  id: string;
  realPos: Vector2D;
  imuPos: Vector2D;
  aiPos: Vector2D;
  status: 'active' | 'calibrating' | 'stuck';
  battery: number;
  mission: string;
}

export default function App() {
  const [rovers, setRovers] = useState<Rover[]>([]);
  const [selectedRover, setSelectedRover] = useState<string | null>(null);
  const [showRealTruth, setShowRealTruth] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [satData, setSatData] = useState<any>(null);
  const [plannedPath, setPlannedPath] = useState<Vector2D[]>([]);
  const [activeTab, setActiveTab] = useState<'mission' | 'platform'>('mission');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [missionLogs, setMissionLogs] = useState<any[]>([]);
  const [swarmWeights, setSwarmWeights] = useState({ slope: 5.0, rough: 2.0 });

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    const socket = io();
    socket.on('swarm_telemetry', (data: Rover[]) => {
      setRovers(data);
    });

    fetch('/api/scientific/datasets')
      .then(res => res.json())
      .then(data => setSatData(data));

    return () => { 
      unsubAuth();
      socket.disconnect(); 
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setMissionLogs([]);
      return;
    }

    const path = "logs";
    const logsQuery = query(collection(db, path), orderBy("timestamp", "desc"), limit(10));
    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMissionLogs(logs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubLogs();
  }, [user]);

  const currentRover = rovers.find(r => r.id === selectedRover) || (rovers.length > 0 ? rovers[0] : null);

  const calculateScientificPath = async (target: Vector2D) => {
    if (!currentRover) return;
    setIsAnalyzing(true);
    try {
      const resp = await fetch('/api/v1/routes/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: [Math.floor(currentRover.aiPos.x), Math.floor(currentRover.aiPos.y)],
          goal: [Math.floor(target.x), Math.floor(target.y)],
          weights: swarmWeights
        })
      });
      const data = await resp.json();
      if (data.path) {
        setPlannedPath(data.path);
        setAiAnalysis(`Path calculated: ${data.algorithm} optimized ${data.nodes} scientific waypoints. Surface hazard: ${data.hazard_assessment?.max_slope.toFixed(1)}%`);
        
        if (user) {
          await logMissionEvent({
            type: 'SYSTEM',
            message: `Swarm navigation plan generated. Algorithm: ${data.algorithm}. Safety: ${data.hazard_assessment?.safe_protocol}`,
            roverId: currentRover.id,
            severity: 'LOW'
          });
        }
      }
    } catch (e) {
      console.error("Routing error:", e);
      setAiAnalysis("Routing engine unreachable. Using local heuristic approximation.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const performTerrainAnalysis = async (center: Vector2D) => {
    setIsAnalyzing(true);
    try {
      const resp = await fetch('/api/v1/terrain/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ center: [Math.floor(center.x), Math.floor(center.y)], radius: 100 })
      });
      const data = await resp.json();
      setAiAnalysis(`Terrain Analysis: ${data.status}. Safety Rating: ${data.safety_rating}. Hazards: ${data.hazards.join(', ') || 'NONE'}`);
      
      if (user) {
        await logMissionEvent({
          type: 'ANALYSIS',
          message: `Raster terrain analysis performed at sector ${center.x}, ${center.y}. Status: ${data.safety_rating}`,
          roverId: currentRover?.id || 'GLOBAL',
          severity: data.safety_rating === 'CRITICAL' ? 'HIGH' : 'LOW'
        });
      }
    } catch (e) {
      console.error("Terrain Analysis error:", e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const optimizeSwarmGlobally = async () => {
    setIsAnalyzing(true);
    setAiAnalysis("Deploying Particle Swarm agents across the global grid...");
    try {
      const resp = await fetch('/api/v1/swarm/optimize', { method: 'POST' });
      const data = await resp.json();
      setSwarmWeights(data.optimized_weights);
      setAiAnalysis(`Global Optimization Complete! Swarm Intelligence (PSO) settled at Merit: ${data.global_merit.toFixed(4)}. Weights synchronized: Slope=${data.optimized_weights.slope.toFixed(1)}, Rough=${data.optimized_weights.rough.toFixed(1)}`);
      
      if (user) {
        await logMissionEvent({
          type: 'SYSTEM',
          message: `GLOBAL_SWARM_TUNING: PSO Merit Settled at ${data.global_merit.toFixed(4)}`,
          roverId: 'FLEET_WIDE',
          severity: 'LOW'
        });
      }
    } catch (e) {
      console.error("Swarm Optimization error:", e);
      setAiAnalysis("Optimization swarm scattered. Reverting to factory weights.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = async () => {
    try {
      await fetch('/api/swarm/reset', { method: 'POST' });
      setPlannedPath([]);
      setAiAnalysis("Global system reset initiated. All swarm trajectories re-initialized.");
    } catch (e) {
      console.error("Reset error:", e);
    }
  };

  const handleAIAnalysis = async () => {
    if (!selectedRover && !rovers[0]) return;
    const targetId = selectedRover || rovers[0]?.id;
    const rover = rovers.find(r => r.id === targetId);
    if (!rover) return;

    setIsAnalyzing(true);
    setAiAnalysis(null);

    try {
      const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY });
      
      const prompt = `You are a Mars Rover AI Specialist. 
Analyze the current telemetry for ${rover.id} (${rover.mission} Fleet):
- Estimated Position (IMU): X=${rover.imuPos?.x?.toFixed(2) || 0}, Y=${rover.imuPos?.y?.toFixed(2) || 0}
- AI Computed Reference: X=${rover.aiPos?.x?.toFixed(2) || 0}, Y=${rover.aiPos?.y?.toFixed(2) || 0}
Drift: ${Math.sqrt(Math.pow(rover.imuPos.x - rover.aiPos.x, 2) + Math.pow(rover.imuPos.y - rover.aiPos.y, 2)).toFixed(2)} units.
Generate a 2-sentence mission status.`;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });

      const text = result.text || "Neural matching nominal.";
      setAiAnalysis(text);

      if (user) {
        await logMissionEvent({
          type: 'ANALYSIS',
          message: text.substring(0, 500),
          roverId: rover.id,
          severity: 'LOW'
        });
        await syncRoverState(rover);
      }
    } catch (e) {
      setAiAnalysis("Communication interference. Local neural networks operating in offline mode.");
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#0A0C10] text-slate-200 overflow-hidden font-sans">
      {/* Top Navigation Bar - Platform Style */}
      <header className="flex items-center justify-between px-6 py-2 border-b border-slate-800 bg-[#11141A] shadow-lg z-50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-sm flex items-center justify-center font-bold text-white">
              <MapIcon className="w-5 h-5" />
            </div>
            <h1 className="text-sm font-bold tracking-tight text-white uppercase italic">Mars Maps Platform</h1>
          </div>
          
          <nav className="flex gap-1 bg-black/40 p-1 rounded-md border border-slate-800/50">
            <button 
              onClick={() => setActiveTab('mission')}
              className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${
                activeTab === 'mission' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Mission Control
            </button>
            <button 
              onClick={() => setActiveTab('platform')}
              className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${
                activeTab === 'platform' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              APIs & Platforms
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase">A* Routing Status</p>
            <p className="text-xs font-mono text-cyan-400">DEM-Sync: 99.4%</p>
          </div>
          <div className="h-8 w-px bg-slate-800"></div>
          <button 
            onClick={() => setShowRealTruth(!showRealTruth)}
            className={`px-3 py-1 rounded text-[10px] font-bold uppercase border transition-all ${
              showRealTruth ? 'bg-blue-600/20 text-blue-400 border-blue-500' : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            DEBUG: {showRealTruth ? 'ON' : 'OFF'}
          </button>
          
          <div className="h-4 w-px bg-slate-800"></div>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[9px] text-white font-bold">{user.displayName}</p>
                <button onClick={logout} className="text-[8px] text-slate-500 hover:text-red-400 uppercase tracking-widest flex items-center gap-1">
                  <LogOut className="w-2 h-2" /> Sign Out
                </button>
              </div>
              {user.photoURL ? (
                <img src={user.photoURL} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full border border-blue-500/50" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                  <User className="w-4 h-4 text-slate-500" />
                </div>
              )}
            </div>
          ) : (
            <button 
              onClick={login}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold uppercase tracking-widest transition-all"
            >
              <LogIn className="w-3 h-3" /> Mission Login
            </button>
          )}

          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
            <Settings className="w-4 h-4 text-slate-500 hover:text-slate-300 cursor-pointer transition-colors" />
          </div>
        </div>
      </header>

      {activeTab === 'mission' ? (
        <div className="flex flex-1 overflow-hidden bg-slate-800 gap-px">
          {/* Left Sidebar: Mission Fleet */}
          <aside className="w-72 bg-[#0A0C10] flex flex-col p-4 gap-4 overflow-y-auto">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Navigation className="w-3 h-3" /> Active Fleet
            </h2>
            
            <div className="space-y-3">
              {rovers.map(rover => (
                <div 
                  key={rover.id}
                  onClick={() => setSelectedRover(rover.id)}
                  className={`p-3 rounded border transition-all cursor-pointer hover:bg-[#11141A] ${
                    (selectedRover === rover.id || (!selectedRover && rover.id === rovers[0]?.id))
                      ? 'border-blue-500/50 bg-[#11141A] shadow-[0_0_15px_rgba(59,130,246,0.1)]'
                      : 'border-slate-800 bg-[#11141A]/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                      rover.mission === 'NASA' ? 'bg-blue-500/10 text-blue-400' :
                      rover.mission === 'ISRO' ? 'bg-orange-500/10 text-orange-400' :
                      rover.mission === 'CNSA' ? 'bg-red-500/10 text-red-400' : 'bg-slate-500/10 text-slate-400'
                    }`}>{rover.mission}</span>
                    <span className={`text-[10px] uppercase font-mono ${rover.status === 'calibrating' ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}`}>{rover.status}</span>
                  </div>
                  <div className="text-xs font-bold mb-1">{rover.id}</div>
                  <div className="flex items-center gap-3 text-[10px] font-mono">
                    <div className="flex items-center gap-1"><Battery className="w-3 h-3 text-slate-500"/> {rover.battery.toFixed(0)}%</div>
                    <div className="text-red-400">Drift: {(Math.sqrt(Math.pow(rover.imuPos.x - rover.realPos.x, 2) + Math.pow(rover.imuPos.y - rover.realPos.y, 2))).toFixed(1)}u</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto p-4 rounded bg-blue-600/5 border border-blue-900/30">
              <p className="text-[10px] text-blue-200 font-bold mb-1 uppercase tracking-tighter flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-blue-500" /> Platform Insights
              </p>
              <p className="text-[10px] text-slate-500 leading-relaxed italic">
                A* pathfinding utilized 1.2M nodes from HiRISE dataset for selected trajectory.
              </p>
            </div>
          </aside>

          {/* Center: Mission Map */}
          <main 
            className="flex-1 bg-black relative flex flex-col overflow-hidden"
            onContextMenu={(e) => {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const x = (e.clientX - rect.left) * (2000 / rect.width);
              const y = (e.clientY - rect.top) * (2000 / rect.height);
              calculateScientificPath({ x, y });
            }}
          >
            <div className="absolute inset-0 opacity-10 pointer-events-none mission-grid"></div>
            <div className="absolute top-4 right-4 text-[9px] font-mono text-slate-500 uppercase flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-cyan-500/50" /> Right-Click: Map Analysis Request
            </div>
            
            <div className="absolute top-6 left-6 z-10 pointer-events-none">
              <div className="bg-black/80 backdrop-blur-md border border-slate-700 p-2 px-3 text-[10px] font-mono rounded-sm shadow-2xl flex items-center gap-2">
                <span className="text-slate-500">MOLA_DATUM:</span> <span className="text-blue-400">MARS2000_SPHERE</span>
              </div>
            </div>

            <div className="flex-1 relative z-0">
              <svg className="w-full h-full" viewBox="0 0 2000 2000">
                {[400, 800, 1200, 1600].map(r => (
                  <circle key={r} cx="1000" cy="1000" r={r} className="fill-none stroke-slate-800/10 stroke-[1]" />
                ))}

                {plannedPath.length > 1 && (
                  <polyline 
                    points={plannedPath.map(p => `${p.x},${p.y}`).join(' ')}
                    className="fill-none stroke-blue-500/60 stroke-[12] stroke-round"
                    strokeOpacity="0.4"
                  />
                )}

                {rovers.map(rover => {
                  const isSelected = rover.id === selectedRover || (!selectedRover && rover.id === rovers[0]?.id);
                  return (
                    <g key={rover.id} className={isSelected ? 'z-20' : 'opacity-30'}>
                      {showRealTruth && (
                        <circle cx={rover.realPos.x} cy={rover.realPos.y} r="12" className="fill-green-500/10 stroke-green-500 stroke-2" />
                      )}
                      
                      <circle cx={rover.imuPos.x} cy={rover.imuPos.y} r="15" className="fill-none stroke-red-500/30 stroke-dashed stroke-2" />
                      
                      <motion.g animate={isSelected ? { opacity: [0.8, 1, 0.8] } : {}} transition={{ repeat: Infinity, duration: 3 }}>
                         <circle cx={rover.aiPos.x} cy={rover.aiPos.y} r="35" className={`fill-none stroke-[2px] ${isSelected ? 'stroke-blue-500' : 'stroke-slate-700'}`} />
                         <circle cx={rover.aiPos.x} cy={rover.aiPos.y} r="6" className={`${isSelected ? 'fill-blue-500 shadow-[0_0_15px_#3b82f6]' : 'fill-slate-700'}`} />
                      </motion.g>

                      <text x={rover.aiPos.x + 45} y={rover.aiPos.y + 10} className="fill-white font-mono text-[22px] font-bold pointer-events-none">
                        {rover.id.split('-')[0]}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="h-40 bg-[#0A0C10] border-t border-slate-800 p-5 mt-auto relative z-10 flex gap-8">
              <div className="w-64 border-r border-slate-800/50 pr-8">
                 <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Scientific Datasets</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                       <div className="text-xl font-bold text-white">4.2M</div>
                       <div className="text-[8px] text-slate-500 uppercase">Features</div>
                    </div>
                    <div className="text-center">
                       <div className="text-xl font-bold text-cyan-400">0.25m</div>
                       <div className="text-[8px] text-slate-500 uppercase">Res</div>
                    </div>
                 </div>
              </div>
              <div className="flex-1 flex flex-col gap-4">
                 <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Platform Telemetry (MRO / ISRO / EUSPA)</div>
                 <div className="grid grid-cols-4 gap-4 flex-1">
                    <MetricItem label="NASA HiRISE" value={98} color="blue" />
                    <MetricItem label="ISRO MCC" value={85} color="blue" />
                    <MetricItem label="ESA CASSIS" value={76} color="blue" />
                    <MetricItem label="EUSPA SPACE" value={92} color="blue" />
                 </div>
              </div>
            </div>
          </main>

          {/* Right Sidebar: Platform Tools */}
          <aside className="w-80 bg-[#0A0C10] flex flex-col p-6 border-l border-slate-800">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-500" /> Neural Control Hub
            </h2>
            
            <div className="bg-[#11141A] border border-slate-800 rounded-lg p-4 mb-4 shadow-xl">
              <p className="text-slate-500 font-bold uppercase text-[9px] mb-3 tracking-widest">Inference Module</p>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between uppercase text-[10px]"><span>Selected Unit</span> <span className="text-white font-bold">{currentRover?.id || '---'}</span></div>
                <div className="flex justify-between uppercase text-[10px]"><span>Status</span> <span className="text-blue-400">OSS_READY</span></div>
              </div>
              <button 
                onClick={handleAIAnalysis}
                disabled={isAnalyzing || !currentRover}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-800 text-white rounded text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 mb-2"
              >
                {isAnalyzing ? <Activity className="w-3 h-3 animate-spin"/> : <Cpu className="w-3 h-3"/>}
                Initialize AI Localization
              </button>
              <button 
                onClick={() => currentRover && performTerrainAnalysis(currentRover.aiPos)}
                disabled={isAnalyzing || !currentRover}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 border border-slate-700 text-white rounded text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 mb-2"
              >
                <Layers className="w-3 h-3"/> Run Terrain Analysis
              </button>
              <button 
                onClick={optimizeSwarmGlobally}
                disabled={isAnalyzing}
                className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-800 text-white rounded text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 mb-2"
              >
                <Activity className="w-3 h-3"/> Global Swarm Tuning (PSO)
              </button>
              <button 
                onClick={handleReset}
                className="w-full py-2 border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-slate-200 text-[10px] rounded uppercase transition-all"
              >
                Force Fleet Reset
              </button>
            </div>

            <AnimatePresence mode="wait">
              {aiAnalysis && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-blue-900/10 border border-blue-800/30 rounded text-[10px] font-mono italic text-blue-100 flex gap-3 shadow-lg"
                >
                  <div className="text-blue-500 font-bold">REPORT:</div>
                  <div>{aiAnalysis}</div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-8 pt-6 border-t border-slate-800/50">
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-4 tracking-widest">Scientific Logs (Cloud Sync)</p>
              <div className="space-y-3">
                {missionLogs.length > 0 ? missionLogs.map((log) => (
                  <div key={log.id} className="text-[9px] border-l-2 border-blue-500/30 pl-3 py-1">
                    <div className="flex justify-between items-center text-slate-500 mb-1">
                      <span className="font-bold text-blue-400">{log.type}</span>
                      <span>{log.timestamp?.toDate().toLocaleTimeString() || 'SYNCING...'}</span>
                    </div>
                    <p className="text-slate-400 leading-tight">{log.message}</p>
                    <p className="text-[8px] text-slate-600 mt-1 uppercase font-mono">Unit: {log.roverId}</p>
                  </div>
                )) : (
                  <p className="text-[9px] text-slate-600 italic">Standby for planetary data downlink...</p>
                )}
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-800/50">
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-4 tracking-widest">Active Datasets</p>
              <div className="space-y-1">
                {satData?.satellite_sources?.map((s: any) => (
                  <div key={s.id} className="flex justify-between items-center py-2 border-b border-slate-900/40 text-[9px]">
                    <span className="text-white hover:text-blue-400 transition-colors cursor-default tracking-wide">{s.id}</span>
                    <span className="text-slate-600 font-mono">{s.agency}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-auto pt-6 flex flex-col gap-2">
               <div className="flex justify-between items-center text-[9px] uppercase">
                  <span className="text-slate-500">System Pulse</span>
                  <span className="text-green-500">Active</span>
               </div>
               <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div animate={{ x: [-100, 200] }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="w-1/4 h-full bg-blue-500" />
               </div>
            </div>
          </aside>
        </div>
      ) : (
        /* Platform / API Docs Hub (G-Maps style) */
        <div className="flex-1 bg-[#0A0C10] overflow-y-auto p-12 max-w-6xl mx-auto w-full">
           <div className="mb-12">
              <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">Mars Maps Platform</h2>
              <p className="text-slate-400 max-w-2xl leading-relaxed">
                 Build the future of Mars exploration with high-fidelity elevation data, AI-driven routing, and real-time swarm telemetry. Our cross-agency OSS platform integrates NASA, ISRO, CNSA, and ESA datasets into unified, developer-ready APIs.
              </p>
           </div>

           <div className="grid grid-cols-3 gap-8 mb-16">
              {[
                { title: 'Mars Maps API', desc: 'Serve tiled Mars elevation and imagery datasets (HiRISE, MOLA, MCC).', icon: <MapIcon className="w-6 h-6"/> },
                { title: 'Mars Routes API', desc: 'A* pathfinding services on DEM cost grids with hazard avoidance.', icon: <Navigation className="w-6 h-6"/> },
                { title: 'Mars Terrain Analysis', desc: 'Neural hazard detection for rocks, cliffs, and sand traps.', icon: <Layers className="w-6 h-6"/> },
                { title: 'Fleet SDK', desc: 'Real-time rover telemetry and IMU drift compensation protocols.', icon: <Radio className="w-6 h-6"/> },
                { title: 'HiRISE Integration', desc: 'Direct matching against high-resolution orbital maps.', icon: <Rocket className="w-6 h-6"/> },
                { title: 'Swarm Consensus', desc: 'Multi-agent localization consensus for zero-GPS environments.', icon: <Activity className="w-6 h-6"/> },
              ].map(card => (
                <div key={card.title} className="p-6 rounded-xl border border-slate-800 bg-[#11141A] hover:bg-[#151921] transition-all hover:-translate-y-1 cursor-pointer group">
                   <div className={`w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center mb-6 group-hover:border-blue-500/50 transition-colors`}>
                      {card.icon}
                   </div>
                   <h3 className="text-lg font-bold text-white mb-2">{card.title}</h3>
                   <p className="text-sm text-slate-500 leading-relaxed">{card.desc}</p>
                </div>
              ))}
           </div>

           <div className="border-t border-slate-800 pt-12">
              <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-2"><Code className="w-5 h-5 text-blue-500" /> Platform Specification</h3>
              <div className="bg-[#11141A] rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
                 <div className="bg-slate-900 px-6 py-3 border-b border-slate-800 flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                    <span className="text-[10px] font-mono text-slate-500 ml-4">Scientific API Explorer</span>
                 </div>
                 <div className="p-8 font-mono text-xs">
                    <div className="flex gap-4 mb-4">
                       <span className="text-green-400 uppercase font-bold">GET</span>
                       <span className="text-slate-300">/api/scientific/route?startX=-1.2&startY=42.4&endX=5.6&endY=12.2</span>
                    </div>
                    <pre className="text-blue-200 opacity-80 leading-loose">
{`{
  "algorithm": "A* (Slope-Constrained)",
  "path": [{ "x": -1.2, "y": 42.4 }, ...],
  "computation_time": "42ms",
  "hazard_risk": 0.15,
  "sources": ["NASA_MRO", "ISRO_MOM", "EUSPA_EU_SPACE"]
}`}
                    </pre>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Global Status Footer */}
      <footer className="h-8 bg-black border-t border-slate-800 px-6 flex items-center justify-between text-[9px] font-mono uppercase tracking-widest text-slate-500">
        <div className="flex gap-8">
          <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /> DSN_CONNECTED: MARS_RELAY_ORBITER</span>
          <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse outline outline-blue-500/30" /> UPLINK_STABLE: 8.2MB/S</span>
        </div>
        <div className="flex gap-4">
          <span className="text-slate-400">© 2026 MARS OSS FOUNDATION</span>
        </div>
      </footer>
    </div>
  );
}

function MetricItem({ label, value, color }: { label: string, value: number, color: string }) {
  const colorMap: Record<string, string> = {
    cyan: 'bg-cyan-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500'
  };
  return (
    <div className="bg-[#11141A] rounded-md p-3 border border-slate-800">
      <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden mb-3">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }} 
          className={`h-full ${colorMap[color]}`} 
        />
      </div>
      <div className="text-[8px] text-slate-500 font-bold tracking-wider">{label}</div>
    </div>
  );
}

function LogEntry({ time, type, content, color = 'text-slate-300' }: { time: string, type: string, content: string, color?: string }) {
  return (
    <p className="leading-tight">
      <span className="text-cyan-500">[{time}]</span> <span className={`${color} font-bold italic mr-1`}>{type}:</span> {content}
    </p>
  );
}

function HealthRow({ label, status, alert }: { label: string, status: string, alert?: boolean }) {
  return (
    <div className="flex justify-between items-center group">
      <span className="text-slate-400 group-hover:text-slate-200 transition-colors">{label}</span> 
      <span className={alert ? 'text-orange-500' : 'text-green-500'}>{status}</span>
    </div>
  );
}

