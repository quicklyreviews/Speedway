"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, RotateCcw, AlertCircle, HelpCircle, Trophy, Activity, Key, Info, Coins, ChevronDown, ChevronUp, Shield, Compass, Zap, Volume2 } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { CopyButton } from "@/components/copy-button";
import { RawJsonViewer } from "@/components/raw-json-viewer";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";

// ─── Constants & Paths ────────────────────────────────────────────────────────

const CAR_NAMES = ["Space Hero", "Astro Purple", "Solar Flare", "Nebula Cyan"];
const CAR_COLORS = ["#00d4ff", "#a78bfa", "#ffb800", "#00e5a0"];

const BUFF_POOL = [
  {
    type: "hyperdrive",
    name: "Hyperdrive (HYP)",
    desc: "Increases engine power by +150 kN",
    color: "#ffb800", // Gold
  },
  {
    type: "shield",
    name: "Quantum Shield (QSD)",
    desc: "Boosts shield defense capacity by +15%",
    color: "#a78bfa", // Purple
  },
  {
    type: "drift",
    name: "Slipstream Drift (SLD)",
    desc: "Increases drift factor by +0.5x",
    color: "#00d4ff", // Cyan
  },
  {
    type: "slingshot",
    name: "Gravitational Slingshot (SLI)",
    desc: "Boosts warp speed factor during the race",
    color: "#ff5500", // Orange
  },
  {
    type: "sails",
    name: "Solar Wind Sails (SWS)",
    desc: "Allows booster ignition 20% earlier in the race",
    color: "#00e5a0", // Green
  },
  {
    type: "antigravity",
    name: "Antigravity Thrusters (AGT)",
    desc: "Enables aggressive overtaking maneuvers",
    color: "#ffffff", // Silver
  }
];

// Static stars for the cosmic background (avoid hydration mismatches)
const STARS = Array.from({ length: 120 }, () => ({
  x: Math.random() * 1200,
  y: Math.random() * 600,
  size: 0.5 + Math.random() * 1.5,
  alpha: 0.1 + Math.random() * 0.8
}));

interface CarStats {
  shield: number;       // e.g. 75 - 98 %
  engine: number;       // e.g. 350 - 600 kN
  drift: number;        // e.g. 1.0 - 2.5 x
  power: number;        // power score
  weight: number;       // weight for provably fair selection
  multiplier: number;   // payout multiplier
  buffType?: string;
  buffName?: string;
  buffDesc?: string;
  buffColor?: string;
}

interface RaceResult {
  success: boolean;
  mode?: "api-or-ipfs" | "ipfs-only";
  parsed?: {
    randomHex: string;
    source?: string;
    service?: string;
    timestamp?: string;
    requestId?: string;
    provider?: string;
    signature?: {
      value?: string;
      pk?: string;
      algo?: string;
    };
    ctrngVerified?: boolean;
    ctrngVerificationError?: string;
    isMixed?: boolean;
  };
  kmsProof?: {
    message: string;
    signature: string;
    publicKey?: string;
    keyId: string;
    algorithm: string;
    verified: boolean;
    timestamp: string;
  } | null;
  raw?: any;
  error?: {
    code: string;
    message: string;
    hint?: string;
  };
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  decay: number;
  type: "smoke" | "spark" | "confetti";
}

// Generate smooth racetrack points for 1200x600 canvas
function generateTrackPathPoints() {
  const points: { x: number; y: number }[] = [];
  const x = 64;
  const y = 64;
  const w = 1072;
  const h = 472;
  const r = 100;

  const startX = 400;
  const leftStraightEndX = x + r; // 164
  const steps1 = 15;
  for (let i = 0; i <= steps1; i++) {
    points.push({ x: startX - ((startX - leftStraightEndX) * i) / steps1, y: y + h });
  }

  const steps2 = 15;
  for (let i = 1; i <= steps2; i++) {
    const angle = Math.PI / 2 + (Math.PI / 2 * i) / steps2;
    points.push({ x: x + r + r * Math.cos(angle), y: y + h - r + r * Math.sin(angle) });
  }

  const steps3 = 20;
  for (let i = 1; i <= steps3; i++) {
    points.push({ x: x, y: y + h - r - ((h - 2 * r) * i) / steps3 });
  }

  const steps4 = 15;
  for (let i = 1; i <= steps4; i++) {
    const angle = Math.PI + (Math.PI / 2 * i) / steps4;
    points.push({ x: x + r + r * Math.cos(angle), y: y + r + r * Math.sin(angle) });
  }

  const steps5 = 40;
  for (let i = 1; i <= steps5; i++) {
    points.push({ x: x + r + ((w - 2 * r) * i) / steps5, y: y });
  }

  const steps6 = 15;
  for (let i = 1; i <= steps6; i++) {
    const angle = -Math.PI / 2 + (Math.PI / 2 * i) / steps6;
    points.push({ x: x + w - r + r * Math.cos(angle), y: y + r + r * Math.sin(angle) });
  }

  const steps7 = 20;
  for (let i = 1; i <= steps7; i++) {
    points.push({ x: x + w, y: y + r + ((h - 2 * r) * i) / steps7 });
  }

  const steps8 = 15;
  for (let i = 1; i <= steps8; i++) {
    const angle = (Math.PI / 2 * i) / steps8;
    points.push({ x: x + w - r + r * Math.cos(angle), y: y + h - r + r * Math.sin(angle) });
  }

  const steps9 = 25;
  const rightStraightStartX = x + w - r; // 1036
  for (let i = 1; i <= steps9; i++) {
    points.push({ x: rightStraightStartX - ((rightStraightStartX - startX) * i) / steps9, y: y + h });
  }

  return points;
}

const SINGLE_LAP = generateTrackPathPoints();
const RACE_PATH = [...SINGLE_LAP, ...SINGLE_LAP.slice(1)]; // 2 Laps

export default function OrbitRushHome() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // System Telemetry Logs state
  const [logs, setLogs] = useState<string[]>([]);
  const consoleRef = useRef<HTMLDivElement | null>(null);
  const [showWinPopup, setShowWinPopup] = useState<boolean>(false);

  // Game & Betting state
  const [gameState, setGameState] = useState<"idle" | "loading" | "countdown" | "racing" | "finished" | "error">("idle");
  const [countdownVal, setCountdownVal] = useState<3 | 2 | 1 | "GO" | null>(null);
  const [raceResult, setRaceResult] = useState<RaceResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [winner, setWinner] = useState<number | null>(null);
  const [roundId, setRoundId] = useState<string>("");
  const [raceTime, setRaceTime] = useState<number>(0);

  // Betting variables (default bet size = 100)
  const [balance, setBalance] = useState<number>(1000);
  const [selectedCar, setSelectedCar] = useState<number | null>(0);
  const [betAmount, setBetAmount] = useState<number>(100);
  const [betWon, setBetWon] = useState<boolean | null>(null);
  const [carStats, setCarStats] = useState<CarStats[]>([]);

  // Credits visual change animations helper
  const [balanceChange, setBalanceChange] = useState<number | null>(null);
  const [balanceChangeId, setBalanceChangeId] = useState<number>(0);

  // UI state
  const [hasRaced, setHasRaced] = useState<boolean>(false);
  const [proofTab, setProofTab] = useState<"ctrng" | "kms" | "math">("ctrng");
  
  // TTS Voice Announcer states (Opt-in, Browser Native only)
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(false);
  
  // Assets & loop parameters
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const carImages = useRef<HTMLImageElement[]>([]);
  const animationFrameId = useRef<number | null>(null);
  const raceStartTime = useRef<number>(0);
  const seedVars = useRef<{ val: bigint; boostTime: number; boostAmount: number; finalProgress: number; overtakeStrength: number; buffType?: string; speedModifier: number }[]>([]);
  const trackItems = useRef<{ id: string; type: "obstacle" | "buff"; name: string; progress: number; lane: number; color: string; active: boolean }[]>([]);
  const particlesRef = useRef<Particle[]>([]);

  // ─── Animation Loop Refs for React Closure Fix ──────────────────────────────
  const gameStateRef = useRef(gameState);
  const countdownValRef = useRef(countdownVal);
  const hasRacedRef = useRef(hasRaced);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { countdownValRef.current = countdownVal; }, [countdownVal]);
  useEffect(() => { hasRacedRef.current = hasRaced; }, [hasRaced]);

  // Telemetry logger helper
  const addLog = useCallback((msg: string) => {
    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0]; // "HH:MM:SS"
    setLogs(prev => [...prev, `[${timeStr}] ${msg}`]);
  }, []);

  // Auto-scroll telemetry log container internally
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  // TTS refs for stable closures (avoids stale state in callbacks)
  const ttsEnabledRef = useRef(false);
  useEffect(() => { ttsEnabledRef.current = ttsEnabled; }, [ttsEnabled]);

  // speakText function using Browser Native SpeechSynthesis (Local and private)
  const speakText = useCallback((text: string) => {
    if (!ttsEnabledRef.current) return;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.05;
      utter.pitch = 1.0;
      window.speechSynthesis.speak(utter);
    }
  }, []);

  // Initial console print
  useEffect(() => {
    addLog("System telemetry initialized. Space Derby console active.");
    addLog("cTRNG satellite enclaves online. Awaiting bets...");
  }, [addLog]);

  // Track selecting a car
  const lastSelectedCar = useRef<number | null>(null);
  useEffect(() => {
    if (selectedCar !== null && selectedCar !== lastSelectedCar.current && gameState === "idle") {
      addLog(`Telemetry linked to Car #${selectedCar + 1} (${CAR_NAMES[selectedCar]})`);
      lastSelectedCar.current = selectedCar;
    }
  }, [selectedCar, gameState, addLog]);

  // Track wager adjustment
  const lastBetAmount = useRef<number>(betAmount);
  useEffect(() => {
    if (gameState === "idle" && betAmount !== lastBetAmount.current) {
      addLog(`Wager size set to ${betAmount} Credits.`);
      lastBetAmount.current = betAmount;
    }
  }, [betAmount, gameState, addLog]);

  // Track countdown updates in console
  const lastCountdownVal = useRef<any>(null);
  useEffect(() => {
    if (countdownVal !== null && countdownVal !== lastCountdownVal.current) {
      if (countdownVal === "GO") {
        addLog("🟢 GO! Rockets ignited. Racetrack telemetry live.");
      } else {
        addLog(`Sequence count: ${countdownVal}...`);
      }
      lastCountdownVal.current = countdownVal;
    }
  }, [countdownVal, addLog]);

  // Track race completed outcome
  useEffect(() => {
    if (gameState === "finished" && winner !== null) {
      addLog(`🏁 Race complete! Car #${winner + 1} (${CAR_NAMES[winner]}) took 1st place.`);
      
      const winText = `Car number ${winner + 1}, ${CAR_NAMES[winner]}, wins the race!`;
      
      if (betWon !== null) {
        if (betWon) {
          const mult = carStats[selectedCar ?? 0]?.multiplier ?? 3.0;
          addLog(`🏆 Betting Success! Credited +${Math.round(betAmount * mult).toLocaleString()} Credits.`);
          speakText(`${winText} Congratulations, you won your bet!`);
        } else {
          addLog(`❌ Betting Loss. Wager of ${betAmount} Credits lost.`);
          speakText(`${winText} Better luck next time.`);
        }
      } else {
        speakText(winText);
      }
    }
  }, [gameState, winner, betWon, betAmount, selectedCar, carStats, addLog, speakText]);

  // Clear balance change popup after timeout
  useEffect(() => {
    if (balanceChange !== null) {
      const timer = setTimeout(() => {
        setBalanceChange(null);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [balanceChangeId, balanceChange]);

  // Randomize stats for each car
  const generateStats = useCallback(() => {
    const statsList: CarStats[] = [];
    const logsToAdd: string[] = [];
    for (let i = 0; i < 4; i++) {
      const buff = BUFF_POOL[Math.floor(Math.random() * BUFF_POOL.length)];
      
      let shield = Math.floor(75 + Math.random() * 24); // 75-98%
      let engine = Math.floor(350 + Math.random() * 250); // 350-599 kN
      let drift = parseFloat((1.0 + Math.random() * 1.5).toFixed(1)); // 1.0-2.4x
      
      if (buff.type === "shield") shield = Math.min(100, shield + 15);
      if (buff.type === "hyperdrive") engine += 150;
      if (buff.type === "drift") drift = parseFloat((drift + 0.5).toFixed(1));

      // Power rating formula: Shield weight = 0.35, Engine weight = 0.1, Drift weight = 12
      const power = Math.round((shield * 0.35) + (engine * 0.1) + (drift * 12));
      const weight = power; // Higher power rating = higher weight in weighted selection
      
      // Dynamic multiplier: Average power is around 110. Multiplier scales inversely.
      const rawMult = (110 / power) * 3.3;
      const multiplier = parseFloat(Math.max(1.8, Math.min(5.5, rawMult)).toFixed(1));
      
      statsList.push({
        shield,
        engine,
        drift,
        power,
        weight,
        multiplier,
        buffType: buff.type,
        buffName: buff.name,
        buffDesc: buff.desc,
        buffColor: buff.color
      });
      logsToAdd.push(`Car #${i + 1} (${CAR_NAMES[i]}): Rolled ${buff.name}`);
    }
    setCarStats(statsList);
    logsToAdd.forEach(l => addLog(`🔮 ${l}`));
  }, [addLog]);

  // Load balance & TTS settings from localStorage & generate initial stats
  useEffect(() => {
    const savedBalance = localStorage.getItem("orbit_rush_balance");
    if (savedBalance) {
      setBalance(Number(savedBalance));
    }
    generateStats();

    // TTS load
    const savedTtsEnabled = localStorage.getItem("orbit_rush_tts_enabled");
    if (savedTtsEnabled) setTtsEnabled(savedTtsEnabled === "true");
  }, [generateStats]);

  // Save TTS settings to localStorage on change
  useEffect(() => {
    localStorage.setItem("orbit_rush_tts_enabled", String(ttsEnabled));
  }, [ttsEnabled]);

  // Load car asset sprites
  useEffect(() => {
    let loadedCount = 0;
    const totalAssets = 8;
    
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount === totalAssets) {
        setAssetsLoaded(true);
      }
    };

    for (let i = 0; i < 8; i++) {
      const img = new Image();
      img.src = `/game-assets/cars/car_${i}.png`;
      img.onload = checkLoaded;
      img.onerror = (e) => {
        console.error(`Failed to load car_${i}`, e);
        checkLoaded();
      };
      carImages.current[i] = img;
    }
  }, []);

  const spawnParticle = useCallback((x: number, y: number, vx: number, vy: number, color: string, size: number, decay: number, type: "smoke" | "spark" | "confetti") => {
    particlesRef.current.push({ x, y, vx, vy, color, size, life: 1.0, decay, type });
  }, []);

  const getPathPoint = useCallback((path: { x: number; y: number }[], t: number) => {
    const n = path.length - 1;
    const rawIndex = t * n;
    const index = Math.min(Math.floor(rawIndex), n - 1);
    const frac = rawIndex - index;

    const p1 = path[index];
    const p2 = path[index + 1];

    const x = p1.x + (p2.x - p1.x) * frac;
    const y = p1.y + (p2.y - p1.y) * frac;
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    return { x, y, angle };
  }, []);

  // Starting Lights Tree drawing logic on canvas
  const drawCountdownLights = useCallback((ctx: CanvasRenderingContext2D, val: 3 | 2 | 1 | "GO" | null) => {
    if (val === null) return;

    ctx.save();
    const cx = ctx.canvas.width / 2;
    const cy = ctx.canvas.height / 2 - 20;

    // Outer glass panel
    ctx.fillStyle = "rgba(10, 10, 28, 0.9)";
    ctx.strokeStyle = "rgba(0, 212, 255, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 12;
    ctx.shadowColor = "rgba(0, 212, 255, 0.25)";
    
    const w = 150;
    const h = 120;
    ctx.beginPath();
    ctx.roundRect(cx - w/2, cy - h/2, w, h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Header label
    ctx.fillStyle = "rgba(0, 212, 255, 0.55)";
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.fillText("LAUNCH SYSTEM", cx, cy - h/2 + 20);

    // Rows layout
    const rowY = [cy - 20, cy + 10, cy + 40];
    const rowColors = [
      { active: "#ff4d6a", inactive: "rgba(255, 77, 106, 0.12)" }, // Red
      { active: "#ffb800", inactive: "rgba(255, 184, 0, 0.12)" }, // Orange/Yellow
      { active: "#00e5a0", inactive: "rgba(0, 229, 160, 0.12)" }, // Green
    ];

    rowY.forEach((yVal, rowIdx) => {
      let active = false;
      if (rowIdx === 0 && val === 3) active = true;
      if (rowIdx === 1 && (val === 2 || val === 1)) active = true;
      if (rowIdx === 2 && val === "GO") active = true;

      const actColor = rowColors[rowIdx].active;
      const inactColor = rowColors[rowIdx].inactive;

      [-20, 20].forEach(dx => {
        ctx.beginPath();
        ctx.arc(cx + dx, yVal, 10, 0, 2 * Math.PI);
        if (active) {
          ctx.fillStyle = actColor;
          ctx.save();
          ctx.shadowBlur = 15;
          ctx.shadowColor = actColor;
          ctx.fill();
          ctx.restore();

          // Spark dot inside light
          ctx.beginPath();
          ctx.arc(cx + dx, yVal, 4, 0, 2 * Math.PI);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
        } else {
          ctx.fillStyle = inactColor;
          ctx.fill();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
          ctx.stroke();
        }
      });
    });

    ctx.restore();
  }, []);

  // Real-time Leaderboard standings HUD drawing on canvas
  const drawStandingsHUD = useCallback((ctx: CanvasRenderingContext2D, standings: { carIdx: number; progress: number }[]) => {
    ctx.save();
    const x = ctx.canvas.width - 136;
    const y = 16;
    const w = 120;
    const h = 98;

    // Container panel
    ctx.fillStyle = "rgba(5, 5, 20, 0.85)";
    ctx.strokeStyle = "rgba(0, 212, 255, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();

    // Header HUD
    ctx.fillStyle = "rgba(0, 212, 255, 0.65)";
    ctx.font = "bold 8px monospace";
    ctx.fillText("HUD STANDINGS", x + 8, y + 14);

    standings.forEach((entry, pos) => {
      const cColor = CAR_COLORS[entry.carIdx];
      const py = y + 28 + pos * 15;

      // Draw rank pos
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.font = "8px monospace";
      ctx.fillText(`${pos + 1}`, x + 8, py);

      // Draw color marker circle
      ctx.fillStyle = cColor;
      ctx.beginPath();
      ctx.arc(x + 22, py - 3, 3, 0, 2 * Math.PI);
      ctx.fill();

      // Car slot name
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = "bold 8px monospace";
      ctx.fillText(`P${entry.carIdx + 1}`, x + 30, py);

      // Distance completion or Lap
      const lap = entry.progress > 0.5 ? "Lap 2" : "Lap 1";
      ctx.fillStyle = entry.progress >= 1.0 ? "var(--text-success)" : "rgba(255, 255, 255, 0.35)";
      ctx.font = "7.5px monospace";
      ctx.fillText(entry.progress >= 1.0 ? "FINISH" : lap, x + 90, py);
    });

    ctx.restore();
  }, []);

  const drawTrack = useCallback((ctx: CanvasRenderingContext2D) => {
    // 1. Space theme backdrop
    ctx.fillStyle = "#020208";
    ctx.fillRect(0, 0, 1200, 600);

    const grad1 = ctx.createRadialGradient(300, 200, 100, 300, 200, 500);
    grad1.addColorStop(0, "rgba(80, 50, 200, 0.12)");
    grad1.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad1;
    ctx.fillRect(0, 0, 1200, 600);

    // Twinkling stars
    ctx.fillStyle = "#ffffff";
    STARS.forEach(s => {
      const flicker = (Math.random() - 0.5) * 0.04;
      const alpha = Math.max(0.1, Math.min(0.8, s.alpha + flicker));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillRect(s.x, s.y, s.size, s.size);
      ctx.restore();
    });

    // Outer & inner road track geometry offsets
    const x = 64;
    const y = 64;
    const w = 1072;
    const h = 472;
    const r = 100;

    const buildConcentricPath = (d: number) => {
      const nx = x - d;
      const ny = y - d;
      const nw = w + 2 * d;
      const nh = h + 2 * d;
      const nr = r + d;

      ctx.beginPath();
      ctx.moveTo(nx + nr, ny);
      ctx.lineTo(nx + nw - nr, ny);
      ctx.arcTo(nx + nw, ny, nx + nw, ny + nr, nr);
      ctx.lineTo(nx + nw, ny + nh - nr);
      ctx.arcTo(nx + nw, ny + nh, nx + nw - nr, ny + nh, nr);
      ctx.lineTo(nx + nr, ny + nh);
      ctx.arcTo(nx, ny + nh, nx, ny + nh - nr, nr);
      ctx.lineTo(nx, ny + nr);
      ctx.arcTo(nx, ny, nx + nr, ny, nr);
      ctx.closePath();
    };

    // Outer Wall Glow (Bright Cyan Laser Rail)
    ctx.save();
    buildConcentricPath(50);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(0, 212, 255, 0.85)";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#00d4ff";
    ctx.stroke();
    ctx.restore();

    // Inner Wall Glow (Bright Magenta Laser Rail)
    ctx.save();
    buildConcentricPath(-50);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(255, 77, 106, 0.85)";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#ff4d6a";
    ctx.stroke();
    ctx.restore();

    // Holographic Energy Pathway (Dark Translucent Cyber Base)
    buildConcentricPath(0);
    ctx.lineWidth = 100;
    ctx.strokeStyle = "rgba(6, 10, 32, 0.72)";
    ctx.stroke();

    // Deep Space Energy Glow Underlay
    buildConcentricPath(0);
    ctx.lineWidth = 96;
    ctx.strokeStyle = "rgba(79, 70, 229, 0.14)";
    ctx.stroke();

    // Scrolling Holographic Grid Ribs
    ctx.save();
    buildConcentricPath(0);
    ctx.lineWidth = 92;
    ctx.strokeStyle = "rgba(0, 212, 255, 0.07)";
    const ribOffset = -(Date.now() / 80) % 40;
    ctx.setLineDash([1.5, 38.5]);
    ctx.lineDashOffset = ribOffset;
    ctx.stroke();
    ctx.restore();

    // Glowing Laser Lane Guides
    ctx.save();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "rgba(0, 212, 255, 0.28)";
    const dashOffset = -(Date.now() / 100) % 20;
    ctx.setLineDash([8, 16]);
    ctx.lineDashOffset = dashOffset;
    
    buildConcentricPath(-25);
    ctx.stroke();
    buildConcentricPath(0);
    ctx.stroke();
    buildConcentricPath(25);
    ctx.stroke();
    ctx.restore();

    // Starting slots outlines
    ctx.save();
    const finishX = 400;
    const finishY = 536;
    ctx.lineWidth = 1.5;
    for (let carIdx = 0; carIdx < 4; carIdx++) {
      const laneOffset = (carIdx - 1.5) * 25;
      const boxX = finishX + 35;
      const boxY = finishY + laneOffset;
      ctx.strokeStyle = "rgba(0, 229, 160, 0.25)";
      ctx.strokeRect(boxX - 8, boxY - 7, 16, 14);
    }
    ctx.restore();

    // Checkered Finish line
    ctx.save();
    const fW = 12;
    const fH = 100;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(finishX - fW/2, finishY - fH/2, fW, fH);
    ctx.fillStyle = "#000000";
    const rh = fH / 8;
    const cw = fW / 2;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 2; col++) {
        if ((row + col) % 2 === 0) {
          ctx.fillRect(finishX - fW/2 + col * cw, finishY - fH/2 + row * rh, cw, rh);
        }
      }
    }
    ctx.strokeStyle = "#00d4ff";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(finishX - fW/2, finishY - fH/2, fW, fH);
    ctx.restore();
  }, []);

  const lastLeader = useRef<number | null>(null);

  const updateRace = useCallback((timestamp: number) => {
    if (!raceStartTime.current && gameStateRef.current === "racing") {
      raceStartTime.current = timestamp;
    }

    let progress = 0;
    let elapsed = 0;

    if (gameStateRef.current === "racing") {
      elapsed = (timestamp - raceStartTime.current) / 1000;
      const raceDuration = 10;
      progress = elapsed / raceDuration;
      if (progress > 1) {
        progress = 1;
      }
      setRaceTime(elapsed);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Star drift based on speed factors
    let starSpeed = 0.05;
    if (gameStateRef.current === "countdown") {
      starSpeed = 0.2;
    } else if (gameStateRef.current === "racing") {
      starSpeed = 0.95;
    }
    STARS.forEach(s => {
      s.x -= starSpeed;
      if (s.x < 0) s.x = 1200;
    });

    // Redraw track backdrop
    drawTrack(ctx);

    // Draw active track items (crystals and hazard mines)
    trackItems.current.forEach(item => {
      if (!item.active) return;

      const { x: itemX, y: itemY, angle: itemAngle } = getPathPoint(RACE_PATH, item.progress);
      const laneOffset = (item.lane - 1.5) * 22.5;
      const px = -Math.sin(itemAngle);
      const py = Math.cos(itemAngle);
      const drawX = itemX + px * laneOffset;
      const drawY = itemY + py * laneOffset;

      ctx.save();
      ctx.translate(drawX, drawY);

      if (item.type === "buff") {
        // Glowing spinning green/gold neon crystal
        ctx.rotate(Date.now() / 250);
        ctx.fillStyle = item.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = item.color;
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(5, 0);
        ctx.lineTo(0, 7);
        ctx.lineTo(-5, 0);
        ctx.closePath();
        ctx.fill();

        // Inner glowing core
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        // Glowing red/orange hazard mine/spike
        ctx.fillStyle = item.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = item.color;
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(6, 5);
        ctx.lineTo(-6, 5);
        ctx.closePath();
        ctx.fill();

        // Warning core sign
        ctx.fillStyle = "#000000";
        ctx.fillRect(-1, -1, 2, 3);
        ctx.fillRect(-1, 3, 2, 1);
      }
      ctx.restore();
    });

    // Update and draw rear particles (exhaust)
    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (p.type === "confetti") continue;

      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (p.type === "smoke") {
        ctx.arc(p.x, p.y, p.size * (2.2 - p.life), 0, 2 * Math.PI);
      } else {
        ctx.arc(p.x, p.y, p.size * p.life, 0, 2 * Math.PI);
        ctx.shadowBlur = 4;
        ctx.shadowColor = p.color;
      }
      ctx.fill();
      ctx.restore();
    }

    // Calculate standings positions for HUD
    const standings = seedVars.current.map((vars, carIdx) => {
      let carP = 0;
      if (gameStateRef.current === "racing" || gameStateRef.current === "finished") {
        carP = progress * vars.finalProgress;
        
        // Dynamic, dramatic overtaking curve using a sine wave modulated by sin(progress * pi)
        // This ensures the wobble is exactly 0 at progress = 0 and progress = 1.
        const oscFreq = 5.5 + (carIdx * 1.25);
        const wobble = Math.sin(progress * Math.PI * oscFreq + (carIdx * Math.PI / 2)) * vars.overtakeStrength * Math.sin(progress * Math.PI);
        carP += wobble;
        
        if (progress > vars.boostTime) {
          const boostProgress = (progress - vars.boostTime) / (1 - vars.boostTime);
          carP += vars.boostAmount * boostProgress;
        }
        
        // Add dynamic speed items modification
        carP += vars.speedModifier;
        
        carP = Math.max(0, Math.min(vars.finalProgress, carP));
      }
      return { carIdx, progress: carP };
    });
    standings.sort((a, b) => b.progress - a.progress);

    // Log live leader changes during active racing
    if (gameStateRef.current === "racing" && standings.length > 0 && progress < 1) {
      const currentLeader = standings[0].carIdx;
      if (currentLeader !== lastLeader.current) {
        addLog(`Telemetry: Car #${currentLeader + 1} (${CAR_NAMES[currentLeader]}) takes the lead!`);
        lastLeader.current = currentLeader;
      }
    }

    // Render each car on grid
    seedVars.current.forEach((vars, carIdx) => {
      let carP = 0;
      if (gameStateRef.current === "racing" || gameStateRef.current === "finished") {
        carP = progress * vars.finalProgress;
        
        // Same dynamic overtaking curve to synchronize rendering with standings HUD
        const oscFreq = 5.5 + (carIdx * 1.25);
        const wobble = Math.sin(progress * Math.PI * oscFreq + (carIdx * Math.PI / 2)) * vars.overtakeStrength * Math.sin(progress * Math.PI);
        carP += wobble;
        
        if (progress > vars.boostTime) {
          const boostProgress = (progress - vars.boostTime) / (1 - vars.boostTime);
          carP += vars.boostAmount * boostProgress;
        }
        
        // Add dynamic speed items modification
        carP += vars.speedModifier;
        
        carP = Math.max(0, Math.min(vars.finalProgress, carP));
      }

      // Decay speedModifier for this frame during active racing
      if (gameStateRef.current === "racing") {
        vars.speedModifier *= 0.95;
      }

      const { x, y, angle } = getPathPoint(RACE_PATH, carP);
      const laneOffset = (carIdx - 1.5) * 25;
      const px = -Math.sin(angle);
      const py = Math.cos(angle);
      const drawX = x + px * laneOffset;
      const drawY = y + py * laneOffset;

      // Check collision with track items
      if (gameStateRef.current === "racing") {
        trackItems.current.forEach(item => {
          if (!item.active) return;
          
          const diff = carP - item.progress;
          if (carIdx === item.lane && diff >= 0 && diff < 0.02) {
            item.active = false;
            
            if (item.type === "buff") {
              vars.speedModifier += 0.045; // Surge forward!
              addLog(`⚡ Car #${carIdx + 1} (${CAR_NAMES[carIdx]}) collected ${item.name} power-up!`);
              // Spawn green sparks
              for (let pIdx = 0; pIdx < 15; pIdx++) {
                spawnParticle(
                  drawX,
                  drawY,
                  (Math.random() - 0.5) * 3,
                  (Math.random() - 0.5) * 3,
                  item.color,
                  2.5 + Math.random() * 2,
                  0.03 + Math.random() * 0.02,
                  "spark"
                );
              }
            } else {
              vars.speedModifier -= 0.055; // Decelerate/lag behind!
              addLog(`⚠️ Car #${carIdx + 1} (${CAR_NAMES[carIdx]}) hit ${item.name} obstacle!`);
              // Spawn warning smoke/sparks
              for (let pIdx = 0; pIdx < 15; pIdx++) {
                spawnParticle(
                  drawX,
                  drawY,
                  (Math.random() - 0.5) * 3.5,
                  (Math.random() - 0.5) * 3.5,
                  item.color,
                  3.5 + Math.random() * 2.5,
                  0.04 + Math.random() * 0.02,
                  "smoke"
                );
              }
            }
          }
        });
      }

      // Exhaust smoke/sparks emitter
      if (gameStateRef.current === "racing" && progress < 1) {
        const rx = drawX - Math.cos(angle) * 15;
        const ry = drawY - Math.sin(angle) * 15;
        const isBoosting = progress > vars.boostTime;

        if (isBoosting) {
          const sparkColor = Math.random() > 0.4 ? "#ff5500" : "#ffaa00";
          spawnParticle(
            rx + px * (Math.random() - 0.5) * 3,
            ry + py * (Math.random() - 0.5) * 3,
            -Math.cos(angle) * 2.3 + (Math.random() - 0.5) * 0.6,
            -Math.sin(angle) * 2.3 + (Math.random() - 0.5) * 0.6,
            sparkColor,
            3 + Math.random() * 3,
            0.04 + Math.random() * 0.02,
            "spark"
          );
        } else if (Math.random() > 0.5) {
          spawnParticle(
            rx,
            ry,
            -Math.cos(angle) * 0.6 + (Math.random() - 0.5) * 0.2,
            -Math.sin(angle) * 0.6 + (Math.random() - 0.5) * 0.2,
            "rgba(99, 130, 230, 0.2)",
            2.2 + Math.random() * 2.5,
            0.03 + Math.random() * 0.02,
            "smoke"
          );
        }
      }

      // Draw car body image
      const carImg = carImages.current[carIdx];
      if (carImg) {
        ctx.save();
        ctx.translate(drawX, drawY);
        ctx.rotate(angle + Math.PI / 2);
        ctx.drawImage(carImg, -10, -20, 20, 40);
        ctx.restore();

        // Color neon marker circle
        ctx.shadowBlur = 6;
        ctx.shadowColor = CAR_COLORS[carIdx];
        ctx.fillStyle = CAR_COLORS[carIdx];
        ctx.beginPath();
        ctx.arc(drawX, drawY, 3, 0, 2 * Math.PI);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Draw the cosmic buff visual overlays
        if (vars.buffType) {
          const buffInfo = BUFF_POOL.find(b => b.type === vars.buffType);
          if (buffInfo) {
            // Draw a glowing outer aura around the holographic number badge
            ctx.save();
            ctx.strokeStyle = buffInfo.color;
            ctx.lineWidth = 1.6;
            ctx.shadowBlur = 8;
            ctx.shadowColor = buffInfo.color;
            ctx.beginPath();
            ctx.arc(drawX, drawY - 24, 11, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();

            // Specialized graphic overlay on the canvas
            if (vars.buffType === "shield" && gameStateRef.current === "racing" && progress < 1) {
              // Draw translucent purple protective energy shield around the ship body
              ctx.save();
              ctx.strokeStyle = "rgba(167, 139, 250, 0.4)";
              ctx.fillStyle = "rgba(167, 139, 250, 0.08)";
              ctx.lineWidth = 1.2;
              ctx.shadowBlur = 10;
              ctx.shadowColor = "rgba(167, 139, 250, 0.5)";
              ctx.beginPath();
              ctx.arc(drawX, drawY, 16, 0, 2 * Math.PI);
              ctx.fill();
              ctx.stroke();
              ctx.restore();
            } else if (vars.buffType === "hyperdrive" && gameStateRef.current === "racing" && progress < 1) {
              // Spawn some yellow/gold flare dust particles
              if (Math.random() > 0.6) {
                spawnParticle(
                  drawX - Math.cos(angle) * 12,
                  drawY - Math.sin(angle) * 12,
                  -Math.cos(angle) * 0.8 + (Math.random() - 0.5) * 0.3,
                  -Math.sin(angle) * 0.8 + (Math.random() - 0.5) * 0.3,
                  "#ffb800",
                  2 + Math.random() * 2,
                  0.04,
                  "spark"
                );
              }
            } else if (vars.buffType === "antigravity" && gameStateRef.current === "racing" && progress < 1) {
              // Silver ripples trailing behind
              if (Math.random() > 0.75) {
                ctx.save();
                ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.arc(drawX, drawY, 8 + Math.random() * 8, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.restore();
              }
            }
          }
        }

        // Upright holographic badge above car nose
        ctx.save();
        ctx.fillStyle = "rgba(4, 4, 12, 0.9)";
        ctx.strokeStyle = CAR_COLORS[carIdx];
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(drawX, drawY - 24, 7.5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 4;
        ctx.shadowColor = CAR_COLORS[carIdx];
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((carIdx + 1).toString(), drawX, drawY - 24);
        ctx.restore();
      }
    });

    // Standings leaderboard overlay
    if (gameStateRef.current === "racing" || gameStateRef.current === "finished") {
      drawStandingsHUD(ctx, standings);
    }

    // Starting Countdown Lights overlay on canvas
    if (gameStateRef.current === "countdown") {
      drawCountdownLights(ctx, countdownValRef.current);
    }

    // Confetti celebration particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (p.type !== "confetti") continue;

      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.life * Math.PI * 3);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }

    // Loop trigger (relying on useEffect loop starter instead of nested recursion to prevent stale state closures)
    if (gameStateRef.current === "countdown" || (gameStateRef.current === "racing" && progress < 1)) {
      animationFrameId.current = requestAnimationFrame(updateRace);
    } else if (gameStateRef.current === "racing" && progress >= 1) {
      setGameState("finished");
      setShowWinPopup(true);
      if (hasRacedRef.current) {
        // Confetti burst explosion at finish line
        const fX = 400;
        const fY = 536;
        const cfColors = ["#00d4ff", "#a78bfa", "#ffb800", "#00e5a0", "#ff0066", "#ffffff"];
        for (let i = 0; i < 75; i++) {
          const cfAngle = Math.random() * Math.PI * 2;
          const velocity = 1.2 + Math.random() * 4.5;
          spawnParticle(
            fX,
            fY + (Math.random() - 0.5) * 55,
            Math.cos(cfAngle) * velocity,
            Math.sin(cfAngle) * velocity - 1.0,
            cfColors[Math.floor(Math.random() * cfColors.length)],
            3.5 + Math.random() * 3.5,
            0.015 + Math.random() * 0.01,
            "confetti"
          );
        }
      }
    }

    // Continue drawing confetti frame if they exist and game finished
    if (gameStateRef.current === "finished" && particles.length > 0) {
      animationFrameId.current = requestAnimationFrame(updateRace);
    }
  }, [drawTrack, getPathPoint, spawnParticle, drawCountdownLights, drawStandingsHUD, addLog]);

  // Unified React Loop Manager Effect
  useEffect(() => {
    if (gameState === "countdown" || gameState === "racing" || (gameState === "finished" && particlesRef.current.length > 0)) {
      if (!animationFrameId.current) {
        animationFrameId.current = requestAnimationFrame(updateRace);
      }
    } else {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    }
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };
  }, [gameState, updateRace]);


  // Initiate deterministic weighted race based on cTRNG seed
  const startRound = useCallback(async () => {
    if (selectedCar === null) {
      setErrorMsg("Please select a car to bet on before launching the race.");
      setGameState("error");
      return;
    }

    if (betAmount > balance) {
      setErrorMsg("Insufficient credits for this bet.");
      setGameState("error");
      return;
    }

    if (betAmount <= 0) {
      setErrorMsg("Please enter a valid bet amount.");
      setGameState("error");
      return;
    }

    // Reset leader log tracker
    lastLeader.current = null;

    // Deduct credits and lock bet with visual notification
    setBalance(prev => {
      const next = prev - betAmount;
      localStorage.setItem("orbit_rush_balance", next.toString());
      return next;
    });
    setBalanceChange(-betAmount);
    setBalanceChangeId(prev => prev + 1);

    setGameState("loading");
    setErrorMsg(null);
    setWinner(null);
    setBetWon(null);
    setRaceTime(0);
    setHasRaced(true);
    raceStartTime.current = 0;
    particlesRef.current = [];

    addLog(`Locking wager: ${betAmount} Credits on Car #${selectedCar + 1} (${CAR_NAMES[selectedCar]})`);
    addLog("Connecting to Space cTRNG gateway...");

    try {
      const res = await fetch("/api/ctrng/random", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedCar,
          betAmount,
        }),
      });
      const json: RaceResult = await res.json();
      setRaceResult(json);

      if (!json.success || !json.parsed?.randomHex) {
        throw new Error(json.error?.message ?? "API did not return a valid random seed.");
      }

      const seed = json.parsed.randomHex;
      setRoundId(`OR-${Math.floor(Date.now() / 1000).toString().slice(-4)}`);

      addLog("Entropy payload received from Orbitport API.");
      addLog(`Seed derived: ${seed.slice(0, 16)}...${seed.slice(-16)}`);

      if (json.parsed?.ctrngVerified) {
        addLog("🛡️ Attestation verified. Signed in orbit by Satellite Enclave.");
      } else {
        addLog("⚠️ Unsigned IPFS beacon fallback mode.");
      }

      if (json.kmsProof) {
        addLog("✍️ Enclave Bet Seal acquired from Space KMS.");
        addLog(`Bet Message notarized under Key ID: ${json.kmsProof.keyId.slice(0, 16)}...`);
      }

      // 1. Provably Fair Weighted Winner selection:
      // Map seed modulo sum of car weights
      const totalWeight = carStats.reduce((sum, c) => sum + c.weight, 0);
      const seedBig = BigInt("0x" + seed);
      const target = Number(seedBig % BigInt(totalWeight));
      
      let accum = 0;
      let derivedWinner = 0;
      for (let i = 0; i < 4; i++) {
        accum += carStats[i].weight;
        if (target < accum) {
          derivedWinner = i;
          break;
        }
      }
      setWinner(derivedWinner);

      // Car performance variables derived from seed slices
      seedVars.current = CAR_NAMES.map((_, idx) => {
        const slice = seed.slice(idx * 16, (idx + 1) * 16);
        const val = BigInt("0x" + slice);
        const stats = carStats[idx];

        let boostTime = 0.3 + Number(val % 40n) / 100;
        let boostAmount = 0.03 + Number(val % 5n) / 100;
        let overtakeStrength = 0.045; // Base overtaking wobble amplitude

        if (stats?.buffType === "sails") {
          boostTime = Math.max(0.12, boostTime - 0.08); // Ignites earlier
        }
        if (stats?.buffType === "slingshot") {
          boostAmount += 0.025; // Stronger slingshot boost
        }
        if (stats?.buffType === "antigravity") {
          overtakeStrength = 0.085; // Amplified overtaking maneuvers
        }

        // Winner gets 1.0 (reaches finish line). Underdogs get fractional completion.
        const finalProgress = idx === derivedWinner ? 1.0 : 0.88 + Number(val % 6n) / 100;

        return { val, boostTime, boostAmount, finalProgress, overtakeStrength, buffType: stats?.buffType, speedModifier: 0 };
      });

      // Populate track items at startRound with randomized lanes
      trackItems.current = [
        { id: "buff-1", type: "buff", name: "Quantum Pack", progress: 0.14, lane: Math.floor(Math.random() * 4), color: "#00e5a0", active: true },
        { id: "obs-1", type: "obstacle", name: "EMP Mine", progress: 0.25, lane: Math.floor(Math.random() * 4), color: "#ff4d6a", active: true },
        { id: "buff-2", type: "buff", name: "Warp Core", progress: 0.38, lane: Math.floor(Math.random() * 4), color: "#ffb800", active: true },
        { id: "obs-2", type: "obstacle", name: "Space Junk", progress: 0.52, lane: Math.floor(Math.random() * 4), color: "#ff5500", active: true },
        { id: "buff-3", type: "buff", name: "Shield Cell", progress: 0.68, lane: Math.floor(Math.random() * 4), color: "#00d4ff", active: true },
        { id: "obs-3", type: "obstacle", name: "Plasma Cloud", progress: 0.82, lane: Math.floor(Math.random() * 4), color: "#ff0066", active: true },
      ];

      // Launch countdown light sequence (Triggered automatically by gameState effect)
      setGameState("countdown");
      setCountdownVal(3);
      speakText("Three");
      addLog("Launch system engaged. Countdown sequence started.");

      setTimeout(() => {
        setCountdownVal(2);
        speakText("Two");
        setTimeout(() => {
          setCountdownVal(1);
          speakText("One");
          setTimeout(() => {
            setCountdownVal("GO");
            speakText("Launch!");
            setTimeout(() => {
              setCountdownVal(null);
              setGameState("racing");
            }, 600);
          }, 1000);
        }, 1000);
      }, 1000);

    } catch (err: any) {
      // Refund credits
      setBalance(prev => {
        const next = prev + betAmount;
        localStorage.setItem("orbit_rush_balance", next.toString());
        return next;
      });
      setBalanceChange(betAmount);
      setBalanceChangeId(prev => prev + 1);

      setGameState("error");
      setErrorMsg(err.message ?? "Failed to connect to cTRNG service.");
      setHasRaced(false);
      addLog(`❌ Launch failed: ${err.message ?? "Failed to connect to cTRNG"}`);
    }
  }, [selectedCar, betAmount, balance, carStats, addLog]);

  const resetGame = useCallback(() => {
    setShowWinPopup(false);
    // Generate new stats for the next round
    generateStats();
    
    setGameState("idle");
    setWinner(null);
    setBetWon(null);
    setRaceTime(0);
    setRaceResult(null);
    setHasRaced(false);
    raceStartTime.current = 0;
    particlesRef.current = [];
    trackItems.current = [];
    
    // Reposition cars at grid start
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        drawTrack(ctx);
        CAR_NAMES.forEach((_, carIdx) => {
          const { x, y, angle } = getPathPoint(RACE_PATH, 0);
          const laneOffset = (carIdx - 1.5) * 22.5;
          const px = -Math.sin(angle);
          const py = Math.cos(angle);
          const drawX = x + px * laneOffset;
          const drawY = y + py * laneOffset;
          const carImg = carImages.current[carIdx];
          if (carImg) {
            ctx.save();
            ctx.translate(drawX, drawY);
            ctx.rotate(angle + Math.PI / 2);
            ctx.drawImage(carImg, -10, -20, 20, 40);
            ctx.restore();

            // Hologram labels
            ctx.save();
            ctx.fillStyle = "rgba(4, 4, 12, 0.9)";
            ctx.strokeStyle = CAR_COLORS[carIdx];
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(drawX, drawY - 24, 7.5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 9px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText((carIdx + 1).toString(), drawX, drawY - 24);
            ctx.restore();
          }
        });
      }
    }
    addLog("Arena reset. Generating new cosmic specifications...");
  }, [drawTrack, getPathPoint, generateStats, addLog]);

  // Handle betting payout calculation
  useEffect(() => {
    if (gameState === "finished" && winner !== null && selectedCar !== null && betWon === null && hasRaced && carStats.length > 0) {
      const won = winner === selectedCar;
      setBetWon(won);

      if (won) {
        const mult = carStats[selectedCar]?.multiplier ?? 3.0;
        const winnings = Math.round(betAmount * mult);
        setBalance(prev => {
          const next = prev + winnings;
          localStorage.setItem("orbit_rush_balance", next.toString());
          return next;
        });
        setBalanceChange(winnings);
        setBalanceChangeId(prev => prev + 1);
      }
    }
  }, [gameState, winner, selectedCar, betAmount, betWon, hasRaced, carStats]);

  // Initial render when assets load
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && assetsLoaded) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        drawTrack(ctx);
        CAR_NAMES.forEach((_, carIdx) => {
          const { x, y, angle } = getPathPoint(RACE_PATH, 0);
          const laneOffset = (carIdx - 1.5) * 22.5;
          const px = -Math.sin(angle);
          const py = Math.cos(angle);
          const drawX = x + px * laneOffset;
          const drawY = y + py * laneOffset;
          const carImg = carImages.current[carIdx];
          if (carImg) {
            ctx.save();
            ctx.translate(drawX, drawY);
            ctx.rotate(angle + Math.PI / 2);
            ctx.drawImage(carImg, -10, -20, 20, 40);
            ctx.restore();

            ctx.save();
            ctx.fillStyle = "rgba(4, 4, 12, 0.9)";
            ctx.strokeStyle = CAR_COLORS[carIdx];
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(drawX, drawY - 24, 7.5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 9px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText((carIdx + 1).toString(), drawX, drawY - 24);
            ctx.restore();
          }
        });
      }
    }
  }, [assetsLoaded, drawTrack, getPathPoint]);

  // Dynamic slider percentage calculations
  const maxWagerVal = Math.min(500, balance > 0 ? balance : 10);
  const sliderPercentage = ((betAmount - 10) / (maxWagerVal - 10 || 1)) * 100;

  // Sanitizing text input wager change
  const handleWagerInputChange = useCallback((valStr: string) => {
    if (valStr === "") {
      setBetAmount(0);
      return;
    }

    // Check if it contains characters other than digits (messy strings like pasted text)
    const hasMessyChars = /[^0-9]/.test(valStr);

    if (hasMessyChars) {
      // Extract the first continuous sequence of digits
      const digitsMatch = valStr.match(/\d+/);
      if (digitsMatch) {
        const parsed = parseInt(digitsMatch[0], 10);
        const clamped = Math.max(10, Math.min(maxWagerVal, parsed));
        setBetAmount(clamped);
        addLog(`Parsed bet size from input: ${parsed} (clamped to ${clamped})`);
      } else {
        // Fallback default
        setBetAmount(100);
        addLog(`No digits found in input. Defaulting bet size to 100.`);
      }
    } else {
      // Direct numeric typing
      const parsed = parseInt(valStr, 10);
      if (!isNaN(parsed)) {
        const clamped = Math.max(0, Math.min(maxWagerVal, parsed));
        setBetAmount(clamped);
      }
    }
  }, [maxWagerVal, addLog]);

  const handleWagerInputBlur = useCallback(() => {
    if (betAmount < 10) {
      setBetAmount(10);
      addLog(`Wager adjusted to minimum: 10 Credits`);
    } else if (betAmount > maxWagerVal) {
      setBetAmount(maxWagerVal);
      addLog(`Wager adjusted to maximum: ${maxWagerVal} Credits`);
    }
  }, [betAmount, maxWagerVal, addLog]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-base)" }}>
      
      {/* Sleek App Header */}
      <header
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          backdropFilter: "blur(12px)",
          background: "rgba(5, 5, 15, 0.8)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: 1320,
            margin: "0 auto",
            padding: "0 1.5rem",
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: "1rem", letterSpacing: "0.05em", color: "#ffffff", display: "flex", alignItems: "center", gap: "0.5rem" }} className="font-cyber">
              <Shield size={16} style={{ color: "var(--accent-cyan)" }} />
              COSMIC SPEEDWAY
            </div>
            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", letterSpacing: "0.02em" }}>
              DETERMINISTIC SPACE DERBY
            </div>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {/* Credit display with animated change notification */}
            <div style={{ position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(12, 13, 36, 0.65)", border: "1px solid var(--border-subtle)", padding: "0.45rem 0.85rem", borderRadius: 8, backdropFilter: "blur(4px)" }}>
                <Coins size={14} style={{ color: "var(--text-warning)" }} />
                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>Balance:</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-warning)", fontFamily: "JetBrains Mono, monospace" }}>
                  {balance.toLocaleString()}
                </span>
              </div>

              {/* Float-up credit notification */}
              <AnimatePresence mode="popLayout">
                {balanceChange !== null && (
                  <motion.span
                    key={balanceChangeId}
                    initial={{ opacity: 0, y: 10, scale: 0.8 }}
                    animate={{ opacity: 1, y: -22, scale: 1 }}
                    exit={{ opacity: 0, y: -38, scale: 0.8 }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: -12,
                      fontWeight: 800,
                      fontSize: "0.82rem",
                      fontFamily: "JetBrains Mono, monospace",
                      color: balanceChange > 0 ? "var(--text-success)" : "var(--text-error)",
                      pointerEvents: "none",
                      textShadow: balanceChange > 0 
                        ? "0 0 10px rgba(0, 229, 160, 0.6)" 
                        : "0 0 10px rgba(255, 77, 106, 0.6)",
                    }}
                  >
                    {balanceChange > 0 ? `+${balanceChange.toLocaleString()}` : `${balanceChange.toLocaleString()}`}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout Container */}
      <main style={{ flex: 1, maxWidth: 1320, margin: "0 auto", width: "100%", padding: "1.5rem 1.5rem 3rem" }}>
        
        {/* Game Title Info */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h1
              style={{
                fontSize: "1.8rem",
                fontWeight: 900,
                background: "linear-gradient(135deg, #ffffff 0%, var(--accent-cyan) 60%, var(--accent-green) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                marginBottom: "0.2rem",
              }}
              className="font-cyber"
            >
              Cosmic Derby Arena
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
              Analyze randomized cosmic specs, select your vehicle, and witness a weighted provably fair space derby.
            </p>
          </div>
        </div>

        {/* Large Racetrack Screen at the Top (Full Width) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ width: "100%", marginBottom: "1.5rem" }}
        >
          {/* Racetrack Canvas Card */}
          <div className="glass-card cyber-grid" style={{ padding: "0.5rem", overflow: "hidden", width: "100%" }}>
            <div style={{ width: "100%", overflowX: "auto" }}>
              <div style={{ position: "relative", width: "fit-content", maxWidth: "100%", margin: "0 auto" }}>
                
                {/* 1. Assets Loading Overlay */}
                {!assetsLoaded && (
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(5, 5, 15, 0.95)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.75rem",
                    zIndex: 10,
                    borderRadius: 8
                  }}>
                    <div className="animate-spin-slow" style={{ width: 22, height: 22, border: "2px solid var(--accent-cyan)", borderTopColor: "transparent", borderRadius: "50%" }} />
                    <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Warming enclaves...</span>
                  </div>
                )}

                {/* 2. Scanning Glow Radar Overlay */}
                {(gameState === "loading" || gameState === "racing") && (
                  <div className="scanline" style={{ borderRadius: 8 }} />
                )}

                {/* 3. React-based High-Fidelity Countdown Text Overlay */}
                <AnimatePresence mode="wait">
                  {gameState === "countdown" && countdownVal !== null && (
                    <motion.div
                      key={countdownVal}
                      initial={{ scale: 3.5, opacity: 0, filter: "blur(6px)" }}
                      animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                      exit={{ scale: 0.4, opacity: 0, filter: "blur(10px)" }}
                      transition={{ type: "spring", stiffness: 350, damping: 16 }}
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                        zIndex: 20,
                        background: "rgba(3, 3, 12, 0.25)",
                        borderRadius: 8
                      }}
                    >
                      <motion.div
                        animate={{ rotate: [0, -2, 2, 0] }}
                        transition={{ duration: 0.5 }}
                        style={{
                          fontFamily: "Orbitron, monospace",
                          fontSize: countdownVal === "GO" ? "5.5rem" : "6.5rem",
                          fontWeight: 900,
                          color: countdownVal === "GO" ? "var(--text-success)" : "#ffffff",
                          textShadow: countdownVal === "GO" 
                            ? "0 0 30px rgba(0, 229, 160, 0.85), 0 0 10px rgba(0, 229, 160, 0.5)" 
                            : "0 0 35px rgba(0, 212, 255, 0.85), 0 0 10px rgba(0, 212, 255, 0.4)",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {countdownVal}
                      </motion.div>
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 0.65, y: 0 }}
                        style={{
                          fontSize: "0.72rem",
                          letterSpacing: "0.2em",
                          color: "#ffffff",
                          marginTop: "0.5rem",
                          textTransform: "uppercase"
                        }}
                      >
                        {countdownVal === "GO" ? "Lanes Cleared" : "Engaging Enclave"}
                      </motion.p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <canvas
                  ref={canvasRef}
                  width={1200}
                  height={600}
                  style={{
                    display: "block",
                    maxWidth: "100%",
                    height: "auto",
                    borderRadius: 8,
                    background: "#03030b",
                    margin: "0 auto",
                    border: "1px solid rgba(255,255,255,0.04)"
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Cockpit Dashboard Controls below the Racetrack */}
        <div className="game-grid">
          
          {/* Left Column: Vehicle Selection */}
          <div className="glass-card cyber-grid" style={{ display: "flex", flexDirection: "column", gap: "1.2rem", height: "100%" }}>
            <div>
              <p className="label" style={{ marginBottom: "0.25rem" }}>1. Vehicle Selection</p>
              <p style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>Analyze weights & payout multipliers</p>
            </div>

            {/* 2x2 Grid of vehicle cards with spring gestures */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
              {CAR_NAMES.map((name, idx) => {
                const isSelected = selectedCar === idx;
                const isInteractive = gameState === "idle" || gameState === "error";
                const stats = carStats[idx];
                const multiplier = stats ? stats.multiplier : 3.0;
                
                return (
                  <motion.button
                    key={name}
                    disabled={!isInteractive}
                    onClick={() => setSelectedCar(idx)}
                    whileHover={isInteractive ? { y: -3, scale: 1.015 } : {}}
                    whileTap={isInteractive ? { scale: 0.98 } : {}}
                    className={`car-card`}
                    style={{
                      width: "100%",
                      opacity: !isInteractive && !isSelected ? 0.45 : 1,
                      transition: "opacity 0.25s, border-color 0.25s, box-shadow 0.25s, background-color 0.25s",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      gap: "0.65rem",
                      textAlign: "left",
                      position: "relative",
                      borderColor: isSelected ? CAR_COLORS[idx] : "rgba(255, 255, 255, 0.05)",
                      boxShadow: isSelected ? `0 0 20px ${CAR_COLORS[idx]}44, inset 0 0 10px ${CAR_COLORS[idx]}15` : "none",
                      background: isSelected 
                        ? `linear-gradient(180deg, ${CAR_COLORS[idx]}12 0%, ${CAR_COLORS[idx]}04 100%)` 
                        : "rgba(12, 13, 36, 0.35)",
                      padding: "0.85rem 1rem",
                    }}
                  >
                    {/* Active glowing indicator badge */}
                    {isSelected && (
                      <motion.span
                        layoutId="active-badge"
                        style={{
                          position: "absolute",
                          top: 0,
                          right: 0,
                          background: CAR_COLORS[idx],
                          color: "#020208",
                          fontSize: "7.5px",
                          fontWeight: 900,
                          padding: "2px 6px",
                          borderBottomLeftRadius: 6,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          fontFamily: "Orbitron, sans-serif",
                          boxShadow: `0 0 10px ${CAR_COLORS[idx]}`
                        }}
                      >
                        ACTIVE
                      </motion.span>
                    )}

                    {/* Top Row: Hologram image container + Title/Odds info */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", width: "100%" }}>
                      {/* Spacecraft Hologram Chamber */}
                      <div style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "8px",
                        background: "rgba(0, 0, 0, 0.4)",
                        border: `1px solid ${isSelected ? CAR_COLORS[idx] : "rgba(255,255,255,0.08)"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        overflow: "hidden",
                        boxShadow: isSelected ? `inset 0 0 10px ${CAR_COLORS[idx]}33` : "none",
                        flexShrink: 0
                      }}>
                        {/* Radial Scanning Scanline Grid */}
                        <div style={{
                          position: "absolute",
                          inset: 0,
                          background: `radial-gradient(circle, ${CAR_COLORS[idx]}10 0%, transparent 80%)`,
                          opacity: isSelected ? 1 : 0.4
                        }} />
                        <motion.img
                          src={`/game-assets/cars/car_${idx}.png`}
                          alt={name}
                          style={{
                            width: "36px",
                            height: "36px",
                            objectFit: "contain",
                            transform: "rotate(-45deg)",
                            filter: isSelected ? `drop-shadow(0 0 6px ${CAR_COLORS[idx]}88)` : "none"
                          }}
                          animate={{
                            y: [0, -3, 0],
                          }}
                          transition={{
                            repeat: Infinity,
                            duration: 2 + idx * 0.3,
                            ease: "easeInOut"
                          }}
                        />
                      </div>

                      {/* Text and payout odds */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          <span style={{
                            fontSize: "0.68rem",
                            fontWeight: 900,
                            color: CAR_COLORS[idx],
                            fontFamily: "Orbitron, monospace"
                          }}>
                            P{idx + 1}
                          </span>
                          <span style={{
                            fontSize: "0.8rem",
                            fontWeight: 800,
                            color: isSelected ? "#ffffff" : "var(--text-primary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap"
                          }}>
                            {name.split(" ")[1] ?? name}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <span style={{ fontSize: "0.65rem", color: "var(--text-secondary)" }}>Payout:</span>
                          <span style={{
                            fontSize: "0.74rem",
                            fontWeight: 800,
                            color: isSelected ? CAR_COLORS[idx] : "var(--text-warning)",
                            fontFamily: "JetBrains Mono, monospace"
                          }}>
                            x{multiplier.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Buff Indicator */}
                    {stats && stats.buffName && (
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        background: stats.buffColor ? stats.buffColor + "10" : "rgba(255, 255, 255, 0.05)",
                        border: `1px dashed ${stats.buffColor || "var(--border-subtle)"}33`,
                        padding: "0.25rem 0.45rem",
                        borderRadius: 6,
                        fontSize: "0.64rem",
                        marginTop: "0.1rem"
                      }}>
                        <span style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: stats.buffColor || "#fff",
                          boxShadow: stats.buffColor ? `0 0 6px ${stats.buffColor}` : "none"
                        }} />
                        <span style={{ color: "var(--text-secondary)", fontWeight: 500 }} className="font-cyber">
                          {stats.buffName}
                        </span>
                      </div>
                    )}
                    
                    {/* Interactive Spec Meters */}
                    {stats && (
                      <div style={{ 
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "0.5rem 0.65rem",
                        width: "100%",
                        paddingTop: "0.5rem",
                        borderTop: "1px solid rgba(255, 255, 255, 0.05)"
                      }}>
                        {/* SHD Progress Bar */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.62rem", color: "var(--text-secondary)" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                              <Shield size={9} style={{ color: CAR_COLORS[idx] }} />
                              <span>SHD</span>
                            </span>
                            <strong style={{ color: "#fff" }}>{stats.shield}%</strong>
                          </div>
                          <div style={{ height: 3, width: "100%", background: "rgba(255,255,255,0.06)", borderRadius: 1.5, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${stats.shield}%`, background: CAR_COLORS[idx], boxShadow: `0 0 6px ${CAR_COLORS[idx]}` }} />
                          </div>
                        </div>

                        {/* ENG Progress Bar */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.62rem", color: "var(--text-secondary)" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                              <Activity size={9} style={{ color: CAR_COLORS[idx] }} />
                              <span>ENG</span>
                            </span>
                            <strong style={{ color: "#fff" }}>{stats.engine}k</strong>
                          </div>
                          <div style={{ height: 3, width: "100%", background: "rgba(255,255,255,0.06)", borderRadius: 1.5, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${((stats.engine - 300) / 300) * 100}%`, background: CAR_COLORS[idx], boxShadow: `0 0 6px ${CAR_COLORS[idx]}` }} />
                          </div>
                        </div>

                        {/* DRF Progress Bar */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.62rem", color: "var(--text-secondary)" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                              <Compass size={9} style={{ color: CAR_COLORS[idx] }} />
                              <span>DRF</span>
                            </span>
                            <strong style={{ color: "#fff" }}>{stats.drift}x</strong>
                          </div>
                          <div style={{ height: 3, width: "100%", background: "rgba(255,255,255,0.06)", borderRadius: 1.5, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${((stats.drift - 0.5) / 2.0) * 100}%`, background: CAR_COLORS[idx], boxShadow: `0 0 6px ${CAR_COLORS[idx]}` }} />
                          </div>
                        </div>

                        {/* PWR Progress Bar */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.62rem", color: isSelected ? CAR_COLORS[idx] : "var(--text-muted)" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                              <Zap size={9} style={{ color: isSelected ? CAR_COLORS[idx] : "var(--text-muted)" }} />
                              <span>PWR</span>
                            </span>
                            <strong style={{ color: isSelected ? "#fff" : "var(--text-secondary)" }}>{stats.power}</strong>
                          </div>
                          <div style={{ height: 3, width: "100%", background: "rgba(255,255,255,0.06)", borderRadius: 1.5, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${((stats.power - 90) / 60) * 100}%`, background: isSelected ? CAR_COLORS[idx] : "rgba(255, 255, 255, 0.15)", boxShadow: isSelected ? `0 0 6px ${CAR_COLORS[idx]}` : "none" }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Bet Size & Launch Stacked */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            
            {/* Betting Panel Card */}
            <div className="glass-card cyber-grid" style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              {/* Wager Panel Section */}
              <div style={{ marginTop: "0.25rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div>
                  <p className="label" style={{ marginBottom: "0.25rem" }}>2. Bet Size</p>
                  <p style={{ fontSize: "0.74rem", color: "var(--text-secondary)" }}>Choose your credits wager amount</p>
                </div>

                {/* Digital Wager Readout Vault Container */}
                <div style={{
                  background: "rgba(2, 2, 8, 0.65)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 12,
                  padding: "0.75rem 1rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.25rem",
                  boxShadow: "inset 0 0 15px rgba(0,0,0,0.8)",
                  position: "relative",
                  overflow: "hidden"
                }}>
                  {/* Subtle top scanner line */}
                  <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "1px",
                    background: "linear-gradient(90deg, transparent, var(--text-warning), transparent)",
                    opacity: 0.7
                  }} />

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Coins size={16} style={{ color: "var(--text-warning)" }} className="animate-pulse-glow" />
                    <input
                      type="text"
                      value={betAmount === 0 ? "" : betAmount}
                      onChange={(e) => handleWagerInputChange(e.target.value)}
                      onBlur={handleWagerInputBlur}
                      disabled={gameState !== "idle" && gameState !== "error"}
                      style={{
                        background: "rgba(0, 0, 0, 0.5)",
                        border: "1px solid rgba(255, 184, 0, 0.35)",
                        borderRadius: 6,
                        padding: "0.15rem 0.45rem",
                        width: "84px",
                        textAlign: "center",
                        fontSize: "1.5rem",
                        fontWeight: 900,
                        color: "var(--text-warning)",
                        fontFamily: "Orbitron, sans-serif",
                        letterSpacing: "0.05em",
                        textShadow: "0 0 12px rgba(255, 184, 0, 0.5)",
                        outline: "none",
                        boxShadow: "inset 0 0 6px rgba(0,0,0,0.6)"
                      }}
                      className="wager-input-field"
                    />
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700, fontFamily: "Orbitron, sans-serif" }}>CREDITS</span>
                  </div>

                  {/* Estimated winnings readout */}
                  <div style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    color: "var(--text-success)",
                    fontFamily: "Orbitron, sans-serif",
                    letterSpacing: "0.02em"
                  }}>
                    EST. RETURN: +{Math.round(betAmount * (carStats[selectedCar ?? 0]?.multiplier ?? 3.0)).toLocaleString()} CREDITS (x{(carStats[selectedCar ?? 0]?.multiplier ?? 3.0).toFixed(1)})
                  </div>
                </div>
                
                {/* Wager slider wrapper with fine-tuning plus/minus buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <motion.button
                    className="btn-secondary"
                    style={{
                      padding: "0.4rem 0.75rem",
                      fontSize: "0.9rem",
                      fontWeight: 800,
                      minWidth: "34px",
                      justifyContent: "center",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      background: "rgba(255,255,255,0.02)"
                    }}
                    whileHover={{ scale: 1.08, borderColor: "var(--text-warning)" }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setBetAmount(prev => Math.max(10, prev - 10))}
                    disabled={gameState !== "idle" && gameState !== "error"}
                  >
                    -
                  </motion.button>
                  
                  <input
                    type="range"
                    min={10}
                    max={maxWagerVal}
                    step={10}
                    value={betAmount}
                    onChange={(e) => setBetAmount(Number(e.target.value))}
                    disabled={gameState !== "idle" && gameState !== "error"}
                    className="custom-slider"
                    style={{ 
                      flex: 1,
                      background: `linear-gradient(to right, #ff8c00 0%, #ffb800 ${sliderPercentage}%, rgba(255, 255, 255, 0.06) ${sliderPercentage}%, rgba(255, 255, 255, 0.06) 100%)`,
                      height: 6,
                      borderRadius: 3,
                      outline: "none"
                    }}
                  />

                  <motion.button
                    className="btn-secondary"
                    style={{
                      padding: "0.4rem 0.75rem",
                      fontSize: "0.9rem",
                      fontWeight: 800,
                      minWidth: "34px",
                      justifyContent: "center",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      background: "rgba(255,255,255,0.02)"
                    }}
                    whileHover={{ scale: 1.08, borderColor: "var(--text-warning)" }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setBetAmount(prev => Math.min(maxWagerVal, prev + 10))}
                    disabled={gameState !== "idle" && gameState !== "error"}
                  >
                    +
                  </motion.button>
                </div>

                {/* Quick select buttons */}
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  {[50, 100, 250].map((val) => (
                    <motion.button
                      key={val}
                      className="btn-secondary"
                      style={{
                        flex: 1,
                        padding: "0.45rem 0",
                        fontSize: "0.74rem",
                        fontFamily: "Orbitron, sans-serif",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        background: "rgba(255,255,255,0.02)",
                        color: betAmount === val ? "#ffffff" : "var(--text-secondary)",
                        borderColor: betAmount === val ? "var(--text-warning)" : "rgba(255, 255, 255, 0.08)",
                        boxShadow: betAmount === val ? "0 0 10px rgba(255, 184, 0, 0.2)" : "none"
                      }}
                      whileHover={{ scale: 1.03, borderColor: "var(--text-warning)" }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setBetAmount(Math.min(maxWagerVal, val))}
                      disabled={gameState !== "idle" && gameState !== "error"}
                    >
                      {val}
                    </motion.button>
                  ))}
                  <motion.button
                    className="btn-secondary"
                    style={{
                      flex: 1,
                      padding: "0.45rem 0",
                      fontSize: "0.74rem",
                      fontFamily: "Orbitron, sans-serif",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      background: "rgba(255,255,255,0.02)",
                      color: betAmount === maxWagerVal ? "#ffffff" : "var(--text-secondary)",
                      borderColor: betAmount === maxWagerVal ? "var(--text-warning)" : "rgba(255, 255, 255, 0.08)",
                      boxShadow: betAmount === maxWagerVal ? "0 0 10px rgba(255, 184, 0, 0.2)" : "none"
                    }}
                    whileHover={{ scale: 1.03, borderColor: "var(--text-warning)" }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setBetAmount(maxWagerVal)}
                    disabled={gameState !== "idle" && gameState !== "error"}
                  >
                    Max
                  </motion.button>
                </div>
              </div>

              {/* Action Launch Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.25rem" }}>
                {gameState === "finished" ? (
                  <motion.button
                    className="btn-primary"
                    onClick={resetGame}
                    whileHover={{ scale: 1.025 }}
                    whileTap={{ scale: 0.975 }}
                    style={{
                      background: "linear-gradient(135deg, var(--accent-green) 0%, #02ab77 100%)",
                      boxShadow: "var(--glow-green)",
                      width: "100%",
                      justifyContent: "center"
                    }}
                  >
                    <RotateCcw size={14} />
                    New Game (Reset)
                  </motion.button>
                ) : (
                  <motion.button
                    id="btn-start-race"
                    className="btn-primary"
                    onClick={startRound}
                    whileHover={!(gameState === "loading" || gameState === "countdown" || gameState === "racing" || !assetsLoaded) ? { scale: 1.025 } : {}}
                    whileTap={!(gameState === "loading" || gameState === "countdown" || gameState === "racing" || !assetsLoaded) ? { scale: 0.975 } : {}}
                    disabled={gameState === "loading" || gameState === "countdown" || gameState === "racing" || !assetsLoaded}
                    style={{ 
                      width: "100%", 
                      justifyContent: "center",
                      background: "linear-gradient(135deg, #4f46e5 0%, #00d4ff 100%)",
                    }}
                  >
                    {gameState === "loading" ? (
                      <>
                        <Activity size={14} className="animate-spin-slow" />
                        Fetching Space Entropy...
                      </>
                    ) : gameState === "countdown" ? (
                      <>
                        <Activity size={14} className="animate-pulse-glow" />
                        Transmitting...
                      </>
                    ) : gameState === "racing" ? (
                      <>
                        <Activity size={14} />
                        Racing ({raceTime.toFixed(1)}s)...
                      </>
                    ) : (
                      <>
                        <Play size={14} />
                        Lock Bet &amp; Launch
                      </>
                    )}
                  </motion.button>
                )}

                {gameState === "error" && (
                  <motion.button 
                    className="btn-secondary" 
                    onClick={resetGame} 
                    style={{ width: "100%", justifyContent: "center" }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <RotateCcw size={13} />
                    Reset Arena
                  </motion.button>
                )}
              </div>
            </div>

            {/* Vocal Announcer (TTS) Settings panel */}
            <div className="glass-card cyber-grid" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Volume2 size={15} style={{ color: "var(--accent-cyan)" }} />
                  <span className="label" style={{ color: "var(--text-primary)" }}>Vocal Announcer (TTS)</span>
                </div>
                <span className="badge badge-live" style={{ fontSize: "7px", padding: "1px 5px" }}>
                  {ttsEnabled ? "ON" : "OFF"}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Enable Vocal Commentary</span>
                  <input
                    type="checkbox"
                    checked={ttsEnabled}
                    onChange={(e) => setTtsEnabled(e.target.checked)}
                    style={{ cursor: "pointer" }}
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Win/Loss Modal Dialog popup */}
        <AnimatePresence>
          {showWinPopup && gameState === "finished" && winner !== null && selectedCar !== null && betWon !== null && hasRaced && carStats.length > 0 && (
            <div style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(2, 2, 8, 0.82)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              padding: "1.5rem"
            }}>
              {/* Clicking outside content card closes the modal */}
              <div 
                style={{ position: "absolute", inset: 0 }} 
                onClick={() => setShowWinPopup(false)} 
              />
              
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                style={{
                  width: "100%",
                  maxWidth: "480px",
                  background: betWon ? "rgba(10, 20, 25, 0.95)" : "rgba(25, 10, 15, 0.95)",
                  border: betWon ? "2px solid rgba(0, 229, 160, 0.5)" : "2px solid rgba(255, 77, 106, 0.5)",
                  borderRadius: 20,
                  padding: "2rem",
                  boxShadow: betWon 
                    ? "0 0 50px rgba(0, 229, 160, 0.25), inset 0 0 25px rgba(0, 229, 160, 0.08)" 
                    : "0 0 50px rgba(255, 77, 106, 0.25), inset 0 0 25px rgba(255, 77, 106, 0.08)",
                  position: "relative",
                  zIndex: 1001,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  gap: "1.25rem",
                }}
              >
                {/* Glowing Top Scanner Accent Line */}
                <div style={{
                  position: "absolute",
                  top: 0,
                  left: "10%",
                  right: "10%",
                  height: "2px",
                  background: betWon ? "var(--text-success)" : "var(--text-error)",
                  boxShadow: betWon ? "0 0 10px var(--text-success)" : "0 0 10px var(--text-error)",
                }} />

                {/* Animated Trophy / Finish Indicator */}
                <motion.div
                  animate={{ 
                    scale: [1, 1.08, 1],
                    rotate: betWon ? [0, -5, 5, 0] : 0
                  }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "50%",
                    background: betWon ? "rgba(0, 229, 160, 0.15)" : "rgba(255, 77, 106, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: betWon ? "var(--text-success)" : "var(--text-error)",
                    boxShadow: betWon ? "0 0 25px rgba(0, 229, 160, 0.25)" : "none",
                    border: betWon ? "1px solid rgba(0, 229, 160, 0.35)" : "1px solid rgba(255, 77, 106, 0.35)"
                  }}
                >
                  <Trophy size={36} />
                </motion.div>

                {/* Header */}
                <div>
                  <span className="label" style={{ 
                    color: betWon ? "var(--text-success)" : "var(--text-error)", 
                    fontSize: "0.8rem",
                    letterSpacing: "0.15em",
                    fontWeight: 900
                  }}>
                    {betWon ? "🏆 BETTING VICTORY" : "🏁 RACE STANDINGS"}
                  </span>
                  
                  <h2 style={{ 
                    fontSize: "1.6rem", 
                    fontWeight: 900, 
                    marginTop: "0.35rem",
                    color: "#ffffff",
                    fontFamily: "Orbitron, sans-serif",
                    letterSpacing: "0.02em"
                  }}>
                    {betWon ? "VICTORY!" : "DEFEAT"}
                  </h2>
                </div>

                {/* Body Message */}
                <p style={{ 
                  fontSize: "0.95rem", 
                  color: "var(--text-secondary)", 
                  lineHeight: 1.5,
                  margin: "0 0.5rem"
                }}>
                  {betWon 
                    ? `Outstanding prediction! Car #${winner + 1} dominated the arena. You have been credited +${Math.round(betAmount * (carStats[selectedCar]?.multiplier ?? 3.0)).toLocaleString()} credits!`
                    : `You wagered on Car #${selectedCar + 1} (${CAR_NAMES[selectedCar]}), but Car #${winner + 1} (${CAR_NAMES[winner]}) took 1st place at the finish line.`
                  }
                </p>

                {/* Vehicle Stats Block */}
                <div style={{
                  width: "100%",
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 12,
                  padding: "0.85rem 1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  textAlign: "left"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700 }}>WINNING VEHICLE:</span>
                    <span style={{ fontSize: "0.82rem", fontWeight: 800, color: CAR_COLORS[winner], fontFamily: "Orbitron, sans-serif" }}>
                      Car #{winner + 1}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.76rem", color: "#ffffff", fontWeight: 700 }}>{CAR_NAMES[winner]}</span>
                    <span style={{ fontSize: "0.76rem", color: "var(--text-warning)", fontWeight: 800, fontFamily: "JetBrains Mono, monospace" }}>
                      Odds: x{(carStats[winner]?.multiplier ?? 3.0).toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", gap: "0.75rem", width: "100%", marginTop: "0.5rem" }}>
                  <motion.button
                    className="btn-secondary"
                    onClick={() => setShowWinPopup(false)}
                    style={{ flex: 1, justifyContent: "center", padding: "0.65rem 0", fontSize: "0.8rem", fontWeight: 700 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    Close Panel
                  </motion.button>
                  
                  <motion.button
                    className="btn-primary"
                    onClick={() => {
                      setShowWinPopup(false);
                      resetGame();
                    }}
                    style={{ 
                      flex: 1.3, 
                      justifyContent: "center", 
                      padding: "0.65rem 0", 
                      fontSize: "0.8rem", 
                      fontWeight: 800,
                      background: betWon 
                        ? "linear-gradient(135deg, var(--accent-green) 0%, #02ab77 100%)" 
                        : "linear-gradient(135deg, #4f46e5 0%, #00d4ff 100%)",
                      boxShadow: betWon ? "var(--glow-green)" : "none"
                    }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    Play Again
                  </motion.button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Error Notification */}
        {gameState === "error" && errorMsg && (
          <div className="error-box" style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", marginTop: "1.5rem" }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, marginBottom: "0.1rem" }}>Gateway request failed</div>
              <div>{errorMsg}</div>
            </div>
          </div>
        )}

        {/* 🛠️ DEVELOPER TELEMETRY & CRYPTOGRAPHIC AUDITS */}
        <div className="glass-card cyber-grid" style={{ marginTop: "2rem", padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.2rem" }}>
            <Key size={15} style={{ color: "var(--accent-cyan)" }} />
            <h2 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.03em" }} className="font-cyber">
              DEVELOPER TELEMETRY &amp; CRYPTOGRAPHIC AUDITS
            </h2>
          </div>

          <div className="telemetry-grid">
            
            {/* Left Column: Real-Time Live Logs Terminal */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <span className="label">System Telemetry Log</span>
              <div style={{
                background: "#020208",
                border: "1px solid var(--border-subtle)",
                borderRadius: 8,
                padding: "0.75rem",
                height: 220,
                overflowY: "auto",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "0.72rem",
                color: "var(--text-success)",
                lineHeight: 1.5,
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                boxShadow: "inset 0 0 10px rgba(0,0,0,0.85)"
              }}>
                {logs.map((log, i) => (
                  <div key={i} style={{ wordBreak: "break-all" }}>
                    {log}
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Cryptographic Proofs & Verification */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {raceResult && raceResult.success && raceResult.parsed ? (
                <LayoutGroup>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                    
                    {/* Internal tabs with sliding pill background */}
                    <div style={{ display: "flex", gap: "0.25rem", background: "var(--bg-surface)", padding: "0.25rem", borderRadius: 8, border: "1px solid var(--border-subtle)", position: "relative" }}>
                      {["ctrng", "kms", "math"].map((tName) => (
                        <button
                          key={tName}
                          onClick={() => setProofTab(tName as any)}
                          style={{
                            flex: 1,
                            padding: "0.45rem 0.5rem",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            borderRadius: 6,
                            cursor: "pointer",
                            border: "none",
                            position: "relative",
                            background: "transparent",
                            color: proofTab === tName ? "#ffffff" : "var(--text-muted)",
                            transition: "color 0.2s ease",
                            fontFamily: "Orbitron, sans-serif",
                          }}
                        >
                          {proofTab === tName && (
                            <motion.div
                              layoutId="activeTabIndicator"
                              style={{
                                position: "absolute",
                                inset: 0,
                                background: "rgba(79, 70, 229, 0.25)",
                                border: "1px solid rgba(167, 139, 250, 0.4)",
                                borderRadius: 6,
                                zIndex: -1,
                                boxShadow: "0 0 10px rgba(167, 139, 250, 0.15)",
                              }}
                              transition={{ type: "spring", stiffness: 350, damping: 26 }}
                            />
                          )}
                          {tName === "ctrng" ? "cTRNG Seed" : tName === "kms" ? "KMS Bet Seal" : "Formula"}
                        </button>
                      ))}
                    </div>

                    {/* Tab 1: cTRNG */}
                    {proofTab === "ctrng" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                          <div>
                            <span className="label">Round ID</span>
                            <p className="value" style={{ color: "var(--accent-cyan)", fontSize: "0.8rem" }}>{roundId}</p>
                          </div>
                          <div>
                            <span className="label">Entropy Source</span>
                            <p className="value" style={{ textTransform: "capitalize", fontSize: "0.8rem" }}>{raceResult.parsed.source ?? "ipfs"}</p>
                          </div>
                        </div>
                        
                        <div>
                          <span className="label">Random Hex Seed</span>
                          <div style={{ background: "var(--bg-surface)", padding: "0.4rem 0.5rem", borderRadius: 6, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--border-subtle)" }}>
                            <code style={{ fontSize: "0.7rem", wordBreak: "break-all", fontFamily: "JetBrains Mono, monospace", color: "var(--text-secondary)" }}>
                              {raceResult.parsed.randomHex.slice(0, 32)}...
                            </code>
                            <CopyButton text={raceResult.parsed.randomHex} label="Copy" size="sm" />
                          </div>
                        </div>

                        <div>
                          <span className="label">Satellite Attestation Proof</span>
                          {raceResult.parsed.ctrngVerified && raceResult.parsed.signature ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginTop: 4, padding: "0.5rem", background: "rgba(0, 229, 160, 0.05)", border: "1px solid rgba(0, 229, 160, 0.2)", borderRadius: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00e5a0", boxShadow: "0 0 6px #00e5a0" }} />
                                <span style={{ fontSize: "0.72rem", color: "var(--text-success)", fontWeight: 700 }}>
                                  🛡️ Satellite Attestation Verified
                                </span>
                              </div>
                              <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                                Real cryptographic signature from Orbitport API (algo: {raceResult.parsed.signature.algo ?? "ECDSA"})
                              </span>
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginTop: 4, padding: "0.5rem", background: "rgba(255, 184, 0, 0.04)", border: "1px solid rgba(255, 184, 0, 0.2)", borderRadius: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ffb800" }} />
                                <span style={{ fontSize: "0.72rem", color: "var(--text-warning)", fontWeight: 700 }}>
                                  {raceResult.parsed.source === "derived" ? "cTRNG API — No Satellite Signature" : "IPFS Beacon — No Satellite Signature"}
                                </span>
                              </div>
                              <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                                {raceResult.parsed.source === "derived" 
                                  ? "The randomness came from the SpaceComputer cTRNG API (derived source). No cryptographic satellite signature is attached to this response — this is expected for derived entropy, which is still cryptographically secure." 
                                  : "The randomness came from the public decentralized IPFS beacon. No cryptographic satellite signature is attached — the data is still provably random but without orbital enclave attestation."
                                }
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tab 2: KMS */}
                    {proofTab === "kms" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        {raceResult.kmsProof ? (
                          <>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", padding: "0.4rem 0.5rem", background: "rgba(0, 229, 160, 0.03)", border: "1px solid rgba(0, 229, 160, 0.15)", borderRadius: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00e5a0" }} />
                                <span style={{ fontSize: "0.72rem", color: "var(--text-success)", fontWeight: 700 }}>
                                  ✍️ Enclave Sealed by Space KMS
                                </span>
                              </div>
                              <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                Bet receipt co-signed in orbit to lock the cTRNG output sequence.
                              </span>
                            </div>
                            <div>
                              <span className="label">KMS Key ID</span>
                              <code style={{ fontSize: "0.68rem", wordBreak: "break-all", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
                                {raceResult.kmsProof.keyId}
                              </code>
                            </div>
                            <div>
                              <span className="label">Notarized Bet Message</span>
                              <div style={{ background: "var(--bg-surface)", padding: "0.4rem 0.5rem", borderRadius: 6, marginTop: 4, border: "1px solid var(--border-subtle)" }}>
                                <code style={{ fontSize: "0.68rem", fontFamily: "JetBrains Mono, monospace", color: "var(--text-secondary)", wordBreak: "break-all" }}>
                                  {raceResult.kmsProof.message}
                                </code>
                              </div>
                            </div>
                            <div>
                              <span className="label">KMS Signature (ECDSA)</span>
                              <div style={{ background: "var(--bg-surface)", padding: "0.4rem 0.5rem", borderRadius: 6, marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid var(--border-subtle)" }}>
                                <code style={{ fontSize: "0.68rem", wordBreak: "break-all", fontFamily: "JetBrains Mono, monospace", color: "var(--text-muted)" }}>
                                  {raceResult.kmsProof.signature.slice(0, 32)}…
                                </code>
                                <CopyButton text={raceResult.kmsProof.signature} label="Copy" size="sm" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <div style={{ textAlign: "center", padding: "1.5rem 0", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                            <HelpCircle size={18} style={{ margin: "0 auto 0.5rem", opacity: 0.5 }} />
                            KMS Bet-Lock signature requires API credentials mode and placing a bet.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 3: Math */}
                    {proofTab === "math" && carStats.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        {raceResult.parsed.isMixed && (
                          <div>
                            <span className="label" style={{ color: "var(--text-warning)", display: "flex", alignItems: "center", gap: "4px" }}>
                              <Info size={11} /> Mixed Dynamic Hashing Formula
                            </span>
                            <div style={{ background: "rgba(255, 184, 0, 0.05)", border: "1px dashed rgba(255, 184, 0, 0.25)", padding: "0.5rem", borderRadius: 6, marginTop: 4 }}>
                              <code style={{ fontSize: "0.68rem", fontFamily: "JetBrains Mono, monospace", color: "var(--text-warning)", display: "block", whiteSpace: "pre-wrap" }}>
                                Seed = SHA256(IPFS_Beacon + KMS_Signature)
                              </code>
                              <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", display: "block", marginTop: 4, lineHeight: 1.3 }}>
                                Fallback IPFS beacons only change every 60 seconds. To prevent fixed seeds and ensure high client entropy, the final entropy seed was dynamically hashed in orbit mixing the IPFS block beacon with the KMS transaction signature.
                              </span>
                            </div>
                          </div>
                        )}
                        <div>
                          <span className="label">Provable Fairness Formula (Weighted)</span>
                          <div style={{ background: "var(--bg-surface)", padding: "0.5rem", borderRadius: 6, marginTop: 4, border: "1px solid var(--border-subtle)" }}>
                            <code style={{ fontSize: "0.7rem", fontFamily: "JetBrains Mono, monospace", color: "var(--text-muted)", display: "block", whiteSpace: "pre-wrap" }}>
                              Total Weight (S) = {carStats.reduce((sum, c) => sum + c.weight, 0)}
                              {"\n"}Target = BigInt("0x" + seed) % BigInt(S) = {Number(BigInt("0x" + raceResult.parsed.randomHex) % BigInt(carStats.reduce((sum, c) => sum + c.weight, 0)))}
                              {"\n"}Winner = Car #{winner !== null ? winner + 1 : "?"} ({CAR_NAMES[winner!]})
                            </code>
                          </div>
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                          The final winning car is derived deterministically by mapping the random seed modulo the total power weight of all cars:
                        </div>
                        <div style={{ background: "var(--bg-surface)", padding: "0.5rem", borderRadius: 6, border: "1px solid var(--border-subtle)" }}>
                          {carStats.map((c, i) => {
                            let start = 0;
                            for (let j = 0; j < i; j++) start += carStats[j].weight;
                            const end = start + c.weight;
                            const isWinner = winner === i;
                            return (
                              <div key={i} style={{ fontSize: "0.7rem", color: isWinner ? "var(--text-success)" : "var(--text-secondary)", fontFamily: "JetBrains Mono, monospace", margin: "0.15rem 0", fontWeight: isWinner ? "bold" : "normal" }}>
                                Car #{i+1} (Weight: {c.weight}): Range [{start}, {end}) {isWinner ? "◀ WINNER" : ""}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Raw JSON Response */}
                    <div style={{ marginTop: "0.25rem" }}>
                      <RawJsonViewer data={raceResult.raw} label="Raw cTRNG Response" />
                    </div>
                  </div>
                </LayoutGroup>
              ) : (
                <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--text-muted)", fontSize: "0.8rem", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", border: "1px dashed var(--border-subtle)", borderRadius: 8, height: "100%" }}>
                  <HelpCircle size={24} style={{ opacity: 0.4 }} />
                  <span>Start a round to generate deterministic entropy proofs.</span>
                </div>
              )}
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border-subtle)",
          padding: "1.25rem 1.5rem",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: "0.78rem",
          marginTop: "auto",
          background: "rgba(5, 5, 12, 0.4)"
        }}
      >
        <p>Cosmic Speedway — Deterministic Space Derby powered by SpaceComputer Orbitport cTRNG &amp; KMS.</p>
      </footer>
    </div>
  );
}
