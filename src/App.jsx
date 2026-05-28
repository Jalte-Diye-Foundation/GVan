import { useState, useEffect, useRef } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');`;

const CSS = `
  *{box-sizing:border-box;margin:0;padding:0;}
  :root{
    --bg0:#0A0F1E;--bg1:#0F172A;--bg2:#1E293B;--bg3:#263352;
    --green:#10F38A;--green-dim:#0A9456;--green-muted:#063d25;
    --cyan:#22D3EE;--cyan-dim:#0891B2;--amber:#F59E0B;--amber-dim:#92400E;
    --red:#EF4444;--slate:#94A3B8;--slate-dim:#475569;
    --border:#1E3A5F;--border-bright:#2D5A8E;
    --font-mono:'JetBrains Mono',monospace;--font-sans:'Space Grotesk',sans-serif;
  }
  body{background:var(--bg0);color:#E2E8F0;font-family:var(--font-sans);min-height:100vh;}
  .mono{font-family:var(--font-mono);}
  input[type=range]{-webkit-appearance:none;appearance:none;height:4px;background:var(--bg3);border-radius:2px;outline:none;}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--green);cursor:pointer;border:2px solid var(--bg1);}
  input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:var(--green);cursor:pointer;border:2px solid var(--bg1);}
  select{background:var(--bg2);color:#E2E8F0;border:1px solid var(--border);border-radius:6px;padding:8px 12px;font-family:var(--font-sans);font-size:14px;outline:none;width:100%;cursor:pointer;}
  select:focus{border-color:var(--green-dim);}
  @keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(.8)}}
  @keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
  @keyframes fade-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes glow-pulse{0%,100%{box-shadow:0 0 8px rgba(16,243,138,.15)}50%{box-shadow:0 0 24px rgba(16,243,138,.35)}}
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
  @keyframes draw-line{from{stroke-dashoffset:200}to{stroke-dashoffset:0}}
  @keyframes node-pop{from{opacity:0;transform:scale(0)}to{opacity:1;transform:scale(1)}}
`;

// ──── SIMULATION ENGINE ────────────────────────────────────────────────────────
function simulate(params) {
  const { area, shape, density, landType, sunlight, soilPH, bulkDensity } = params;
  const densityVal = density === "miyawaki" ? 3.5 : 0.5;
  const N = Math.round(area * densityVal);
  const Vamend = area * 1.0 * 0.4;
  const compost = +(Vamend * 0.5).toFixed(2);
  const perforators = +(Vamend * 0.25).toFixed(2);
  const waterRetainers = +(Vamend * 0.25).toFixed(2);
  const mulch = +(area * 0.08).toFixed(2);
  const waterReq = +(N * 15).toFixed(0);
  // Carbon: sigmoidal scaling
  const co2_y1 = +(N * 0.5).toFixed(1);
  const co2_y3 = +(N * 3.2).toFixed(1);
  const co2_y10 = +(N * 15).toFixed(1);
  // Thermal cooling
  const baseCooling = density === "miyawaki" ? 3.2 : 1.4;
  const cooling = +(baseCooling + (area / 500) * 0.8).toFixed(1);
  // Hydrology
  const hydro = Math.round(area * 180 * (density === "miyawaki" ? 1.4 : 0.8));
  const isNarrow = shape === "narrow";
  // Layer distribution
  const canopy = Math.round(N * 0.2);
  const subcanopy = Math.round(N * 0.3);
  const arbor = Math.round(N * 0.3);
  const shrub = Math.round(N * 0.2);
  return { N, Vamend, compost, perforators, waterRetainers, mulch, waterReq, co2_y1, co2_y3, co2_y10, cooling, hydro, isNarrow, canopy, subcanopy, arbor, shrub, densityVal };
}

// ──── LAYOUT CANVAS ───────────────────────────────────────────────────────────
function PlotCanvas({ params, results }) {
  const { shape, area } = params;
  const { N, canopy, subcanopy, arbor, shrub, isNarrow } = results;
  const W = shape === "narrow" ? 160 : shape === "square" ? 280 : 320;
  const H = shape === "narrow" ? 360 : shape === "square" ? 280 : 200;
  const pad = 18;
  const cols = Math.ceil(Math.sqrt(Math.min(N, 120) * (W / H)));
  const rows = Math.ceil(Math.min(N, 120) / cols);
  const gx = (W - pad * 2) / Math.max(cols - 1, 1);
  const gy = (H - pad * 2) / Math.max(rows - 1, 1);
  const nodes = [];
  const layerColors = ["#10F38A","#22D3EE","#F59E0B","#A78BFA"];
  const layerNames = ["Canopy","Sub-Canopy","Arbor","Shrub"];
  const layerCounts = [canopy, subcanopy, arbor, shrub];
  let layerIdx = 0, layerCount = 0;
  for (let i = 0; i < Math.min(N, 120); i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const jitter = (v) => v + (Math.sin(i * 7.3 + col) * 4);
    const x = pad + jitter(col * gx);
    const y = pad + jitter(row * gy);
    if (layerCount >= layerCounts[layerIdx]) { layerIdx = Math.min(layerIdx + 1, 3); layerCount = 0; }
    layerCount++;
    nodes.push({ x, y, color: layerColors[layerIdx], layer: layerIdx, r: layerIdx === 0 ? 5 : layerIdx === 1 ? 4 : layerIdx === 2 ? 3 : 2.5 });
  }

  return (
    <div style={{ display: "flex", gap: 32, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 11, color: "var(--slate)", fontFamily: "var(--font-mono)", marginBottom: 8, letterSpacing: "0.1em" }}>
          PLOT CANVAS — {shape.toUpperCase()} · {area}m²
        </div>
        {isNarrow && (
          <div style={{ background: "#451A03", border: "1px solid var(--amber)", borderRadius: 6, padding: "6px 12px", fontSize: 12, color: "var(--amber)", fontFamily: "var(--font-mono)", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ animation: "blink 1s infinite" }}>⚠</span> EDGE EFFECT WARNING: Narrow strip geometry increases perimeter heat exposure
          </div>
        )}
        <svg width={W} height={H} style={{ background: "var(--bg2)", borderRadius: 8, border: "1px solid var(--border)", display: "block" }}>
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(46,68,100,0.5)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#grid)" />
          {nodes.map((n, i) => (
            <circle key={i} cx={n.x} cy={n.y} r={n.r} fill={n.color} opacity={0.85}
              style={{ animation: `node-pop 0.3s ease ${(i * 8) % 300}ms both` }} />
          ))}
          {N > 120 && (
            <text x={W / 2} y={H - 8} textAnchor="middle" fill="var(--slate)" fontSize="10" fontFamily="var(--font-mono)">
              +{N - 120} more nodes
            </text>
          )}
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 11, color: "var(--slate)", fontFamily: "var(--font-mono)", marginBottom: 12, letterSpacing: "0.1em" }}>LAYER INDEX</div>
        {layerNames.map((name, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: layerColors[i], flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{name}</div>
              <div style={{ fontSize: 11, color: "var(--slate)", fontFamily: "var(--font-mono)" }}>{layerCounts[i]} specimens</div>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 16, padding: "10px 14px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: "var(--slate)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>TOTAL SAPLINGS</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--green)", fontFamily: "var(--font-mono)" }}>{results.N.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

// ──── STAT CARD ───────────────────────────────────────────────────────────────
function StatCard({ label, value, unit, color = "var(--green)", sub, icon }) {
  return (
    <div style={{ background: "var(--bg2)", border: `1px solid var(--border)`, borderRadius: 10, padding: "16px 20px", animation: "fade-up .4s ease both" }}>
      <div style={{ fontSize: 11, color: "var(--slate)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "var(--font-mono)" }}>{value}</span>
        <span style={{ fontSize: 13, color: "var(--slate)" }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 12, color: "var(--slate-dim)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ──── CARBON TIMELINE BAR ─────────────────────────────────────────────────────
function CarbonBar({ label, value, max, color }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: "var(--slate)", fontFamily: "var(--font-mono)" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color, fontFamily: "var(--font-mono)" }}>{value.toLocaleString()} t CO₂</span>
      </div>
      <div style={{ height: 6, background: "var(--bg3)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 1s ease" }} />
      </div>
    </div>
  );
}

// ──── LOGISTICS TABLE ─────────────────────────────────────────────────────────
function LogisticsTable({ results }) {
  const rows = [
    { item: "Native Saplings", qty: results.N.toLocaleString(), unit: "specimens", notes: "Multi-layer randomized layout", color: "var(--green)" },
    { item: "Organic Compost", qty: results.compost.toLocaleString(), unit: "m³", notes: "50% of soil amendment volume", color: "var(--cyan)" },
    { item: "Rice Husk Perforators", qty: results.perforators.toLocaleString(), unit: "m³", notes: "Aeration & drainage layer", color: "var(--cyan)" },
    { item: "Coco-peat Retainers", qty: results.waterRetainers.toLocaleString(), unit: "m³", notes: "Moisture retention matrix", color: "var(--cyan)" },
    { item: "Surface Mulch", qty: results.mulch.toLocaleString(), unit: "m³", notes: "8cm insulation blanket", color: "var(--amber)" },
    { item: "Irrigation Water (Est.)", qty: results.waterReq.toLocaleString(), unit: "L/mo", notes: "First 6-month establishment phase", color: "var(--amber)" },
  ];
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-bright)" }}>
            {["MATERIAL ITEM","QTY","UNIT","NOTES"].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "8px 14px", color: "var(--slate)", fontSize: 10, letterSpacing: "0.1em", fontWeight: 500 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "rgba(30,41,59,.4)" }}>
              <td style={{ padding: "10px 14px", color: r.color, fontWeight: 500 }}>{r.item}</td>
              <td style={{ padding: "10px 14px", color: "#E2E8F0", fontWeight: 700 }}>{r.qty}</td>
              <td style={{ padding: "10px 14px", color: "var(--slate)" }}>{r.unit}</td>
              <td style={{ padding: "10px 14px", color: "var(--slate-dim)", fontSize: 12 }}>{r.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--green-muted)", border: "1px solid var(--green-dim)", borderRadius: 8, fontSize: 12, color: "#86EFAC", fontFamily: "var(--font-mono)" }}>
        ∑ TOTAL AMENDMENT VOLUME: {results.Vamend.toFixed(2)} m³ — depth: 1.0m · modification fraction: 40%
      </div>
    </div>
  );
}

// ──── ANALYTICS PANEL ─────────────────────────────────────────────────────────
function Analytics({ results }) {
  const max = results.co2_y10;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
      {/* Carbon */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: "18px 20px", gridColumn: "1/-1" }}>
        <div style={{ fontSize: 11, color: "var(--slate)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", marginBottom: 16 }}>⬡ CARBON OFFSET TRACKER — PREDICTED SEQUESTRATION</div>
        <CarbonBar label="YEAR 1" value={results.co2_y1} max={max} color="#4ADE80" />
        <CarbonBar label="YEAR 3" value={results.co2_y3} max={max} color="#22D3EE" />
        <CarbonBar label="YEAR 10" value={results.co2_y10} max={max} color="#10F38A" />
        <div style={{ fontSize: 11, color: "var(--slate-dim)", marginTop: 8, fontFamily: "var(--font-mono)" }}>
          AGB formula: N × sigmoid growth × 15kg CO₂/tree at decade-scale
        </div>
      </div>

      {/* Cooling */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: "18px 20px" }}>
        <div style={{ fontSize: 11, color: "var(--slate)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", marginBottom: 12 }}>⬡ THERMAL COOLING GRADIENT</div>
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div style={{ fontSize: 48, fontWeight: 800, color: "var(--cyan)", fontFamily: "var(--font-mono)", lineHeight: 1 }}>
            -{results.cooling}°C
          </div>
          <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 8 }}>estimated microclimate reduction</div>
          <svg viewBox="0 0 100 40" style={{ marginTop: 16, width: "100%", height: 40 }}>
            <defs>
              <linearGradient id="heatg" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#EF4444" />
                <stop offset="50%" stopColor="#F59E0B" />
                <stop offset="100%" stopColor="#22D3EE" />
              </linearGradient>
            </defs>
            <rect x="0" y="14" width="100" height="12" rx="6" fill="url(#heatg)" />
            <text x="0" y="34" fontSize="7" fill="var(--slate)" fontFamily="var(--font-mono)">HOT</text>
            <text x="70" y="34" fontSize="7" fill="var(--slate)" fontFamily="var(--font-mono)">COOL</text>
          </svg>
        </div>
      </div>

      {/* Hydrology */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: "18px 20px" }}>
        <div style={{ fontSize: 11, color: "var(--slate)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", marginBottom: 12 }}>⬡ HYDROLOGICAL SPONGE VOLUME</div>
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div style={{ fontSize: 38, fontWeight: 800, color: "var(--cyan)", fontFamily: "var(--font-mono)", lineHeight: 1 }}>
            {(results.hydro / 1000).toFixed(1)}kL
          </div>
          <div style={{ fontSize: 12, color: "var(--slate)", marginTop: 8 }}>{results.hydro.toLocaleString()} L annual stormwater diverted</div>
          <div style={{ display: "flex", gap: 4, marginTop: 16, justifyContent: "center" }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} style={{
                width: 16, height: 16 + i * 3, borderRadius: 3,
                background: i < Math.round((results.hydro / 200000) * 10) ? "var(--cyan)" : "var(--bg3)"
              }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──── TIMELINE ────────────────────────────────────────────────────────────────
function Timeline() {
  const phases = [
    { id: "01", title: "Pre-Planting Excavation", duration: "Weeks 1–3", color: "var(--amber)", items: ["Mark plot boundary & soil sampling", "Excavate 1.0m depth across full plot area", "Test and record bulk density, pH baseline", "Commission soil lab report & amendment ratios"] },
    { id: "02", title: "Soil Amendment & Bed Prep", duration: "Weeks 4–5", color: "var(--cyan)", items: ["Layer compost (50%), perforators (25%), retainers (25%)", "Mechanical tilling to 0.8m for substrate integration", "Grade & level amended soil bed", "Install irrigation line layout (drip network)"] },
    { id: "03", title: "Randomized Sapling Setup", duration: "Week 6", color: "var(--green)", items: ["Canopy layer planting (outermost ring, 20%)", "Sub-Canopy fill (intermediate density, 30%)", "Arbor species random scatter (30%)", "Shrub understory dense interplanting (20%)"] },
    { id: "04", title: "Mulch Insulation Blanket", duration: "Week 7", color: "var(--green)", items: ["Apply 8cm wood-chip mulch layer uniformly", "Ensure no bare soil exposed", "Establish perimeter edge-guard boundary", "Document sapling GPS grid for mortality tracking"] },
    { id: "05", title: "36-Month Hydrological Upkeep", duration: "Months 2–36", color: "var(--slate)", items: ["Month 1–6: Daily watering, 15L/tree", "Month 7–18: Reduce to 3× weekly", "Month 19–36: Rainfall-dependent, monitor only", "Annual mortality audit; gap-fill with natives"] },
  ];
  return (
    <div style={{ position: "relative", paddingLeft: 40 }}>
      <div style={{ position: "absolute", left: 18, top: 0, bottom: 0, width: 2, background: "linear-gradient(to bottom, var(--green), var(--cyan), var(--amber))", borderRadius: 1 }} />
      {phases.map((p, i) => (
        <div key={i} style={{ marginBottom: 32, position: "relative", animation: `fade-up .5s ease ${i * 80}ms both` }}>
          <div style={{ position: "absolute", left: -31, top: 4, width: 16, height: 16, borderRadius: "50%", background: p.color, border: "2px solid var(--bg0)", boxShadow: `0 0 10px ${p.color}55`, animation: "glow-pulse 2s infinite" }} />
          <div style={{ marginLeft: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: p.color, letterSpacing: "0.1em" }}>PHASE {p.id}</span>
              <span style={{ fontSize: 11, color: "var(--slate-dim)", fontFamily: "var(--font-mono)" }}>{p.duration}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>{p.title}</div>
            <div style={{ background: "var(--bg2)", border: `1px solid var(--border)`, borderRadius: 8, padding: "12px 16px" }}>
              {p.items.map((item, j) => (
                <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: j < p.items.length - 1 ? 8 : 0 }}>
                  <span style={{ color: p.color, fontSize: 12, marginTop: 2, flexShrink: 0 }}>▸</span>
                  <span style={{ fontSize: 13, color: "#CBD5E1" }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ──── WIZARD STEPS ────────────────────────────────────────────────────────────
function ToggleCard({ label, sub, selected, onClick }) {
  return (
    <div onClick={onClick} style={{
      padding: "14px 18px", borderRadius: 8, cursor: "pointer",
      border: `1px solid ${selected ? "var(--green)" : "var(--border)"}`,
      background: selected ? "rgba(16,243,138,.08)" : "var(--bg2)",
      transition: "all .2s", flex: 1, minWidth: 140
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: selected ? "var(--green)" : "var(--slate-dim)", transition: "background .2s", animation: selected ? "pulse-dot 1.5s infinite" : "none" }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: selected ? "var(--green)" : "#E2E8F0" }}>{label}</span>
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--slate)", fontFamily: "var(--font-mono)", marginLeft: 18 }}>{sub}</div>}
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 11, color: "var(--slate)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", marginBottom: 8 }}>{children}</div>;
}

function InputBox({ value, onChange, type = "number", min, max, placeholder }) {
  return (
    <input type={type} value={value} onChange={onChange} min={min} max={max} placeholder={placeholder} style={{
      background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6,
      padding: "9px 14px", color: "#E2E8F0", fontFamily: "var(--font-mono)", fontSize: 14,
      outline: "none", width: "100%", transition: "border-color .2s"
    }}
      onFocus={e => e.target.style.borderColor = "var(--green-dim)"}
      onBlur={e => e.target.style.borderColor = "var(--border)"}
    />
  );
}

// ──── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("landing"); // landing | wizard | dashboard
  const [wizStep, setWizStep] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState("canvas");
  const [params, setParams] = useState({
    area: 500, shape: "rectangular", landType: "barren", sunlight: "full",
    soilPH: 6.5, bulkDensity: 1.4, density: "miyawaki"
  });
  const [results, setResults] = useState(null);

  const set = (key) => (e) => setParams(p => ({ ...p, [key]: typeof e === "string" || typeof e === "number" ? e : e.target.value }));

  const runSim = () => {
    setResults(simulate(params));
    setScreen("dashboard");
    setActiveTab("canvas");
  };

  const TABS = [
    { id: "canvas", label: "Spatial Grid" },
    { id: "logistics", label: "Material Matrix" },
    { id: "analytics", label: "Sustainability Analytics" },
    { id: "timeline", label: "Field Timeline" },
  ];

  return (
    <>
      <style>{FONTS + CSS}</style>
      <div style={{ minHeight: "100vh", background: "var(--bg0)" }}>
        {/* Scanline overlay */}
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,.04) 2px, rgba(0,0,0,.04) 4px)", zIndex: 9999 }} />

        {/* NAV */}
        <div style={{ borderBottom: "1px solid var(--border)", padding: "12px 32px", display: "flex", alignItems: "center", gap: 16, background: "rgba(10,15,30,.9)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 100 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--green)", letterSpacing: "0.1em" }}>
            G<span style={{ color: "var(--cyan)" }}>V</span>AN
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--slate-dim)" }}>
            DIGITAL ECOLOGICAL COMPILER 
          </div>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)", animation: "pulse-dot 2s infinite" }} />
        </div>

        {/* ──── LANDING ──── */}
        {screen === "landing" && (
          <div style={{ minHeight: "calc(100vh - 57px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
            <div style={{ maxWidth: 700, textAlign: "center", animation: "fade-up .6s ease" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--green)", letterSpacing: "0.2em", marginBottom: 24 }}>
                 URBAN AFFORESTATION INTELLIGENCE SYSTEM
              </div>
              <h1 style={{ fontSize: "clamp(28px, 6vw, 52px)", fontWeight: 800, lineHeight: 1.15, marginBottom: 24, letterSpacing: "-0.02em" }}>
                {/* Wrap line 1 in a block span with a solid color */}
                <span style={{ display: "block", color: "#E2E8F0" }}>
                  Compile Raw Urban Land
                </span>
  
                {/* Line 2 handles the gradient overlay cleanly */}
                <span style={{ background: "linear-gradient(90deg, var(--green), var(--cyan))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", display: "block" }}>
                  into Self-Sustaining Ecosystems
                </span>
              </h1>
              <p style={{ fontSize: 16, color: "#94A3B8", lineHeight: 1.7, marginBottom: 40, maxWidth: 520, margin: "0 auto 40px" }}>
                GVan translates site parameters into precision-engineered Miyawaki and traditional afforestation blueprints—saplings, soil amendments, carbon analytics, and field timelines.
              </p>
              {/* Feature chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginBottom: 48 }}>
                {["Miyawaki Method","Mass-Balance Soil Math","CO₂ Forecasting","Hydrological Modeling","Field Execution Plans"].map(f => (
                  <span key={f} style={{ padding: "5px 14px", borderRadius: 20, border: "1px solid var(--border-bright)", fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--slate)" }}>{f}</span>
                ))}
              </div>
              <button onClick={() => setScreen("wizard")} style={{
                background: "var(--green)", color: "#0A0F1E", border: "none", borderRadius: 8,
                padding: "14px 40px", fontSize: 15, fontWeight: 700, fontFamily: "var(--font-mono)",
                cursor: "pointer", letterSpacing: "0.05em", transition: "all .2s",
                animation: "glow-pulse 3s infinite"
              }}
                onMouseOver={e => e.target.style.transform = "scale(1.03)"}
                onMouseOut={e => e.target.style.transform = "scale(1)"}
              >
                ANALYZE YOUR PLOT →
              </button>
              {/* Terminal preview */}
              <div style={{ marginTop: 56, background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 10, padding: "20px 24px", textAlign: "left", fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--slate)", lineHeight: "1.6" }}>
                <div style={{ color: "var(--green)", fontWeight: 600, fontSize: 15, marginBottom: 10 }}>🌱 Your Planting Roadmap</div>
                <div style={{ marginBottom: 6 }}><strong style={{ color: "#E2E8F0" }}>Phase 1: Soil Prep</strong> — Loosening the earth down to one meter to let young roots grow effortlessly.</div>
                <div style={{ marginBottom: 6 }}><strong style={{ color: "#E2E8F0" }}>Phase 2: Organic Nourishment</strong> — Mixing natural compost and water-retaining nutrients into your specific plot soil.</div>
                <div style={{ marginBottom: 6 }}><strong style={{ color: "#E2E8F0" }}>Phase 3: High-Density Planting</strong> — Carefully arranging native species close together so they support each other's upward growth.</div>
                <div style={{ color: "var(--cyan)", fontWeight: 500, marginTop: 10 }}>✓ Complete the steps ahead to unlock your detailed step-by-step field guide.</div>
              </div>
            </div>
          </div>
        )}

        {/* ──── WIZARD ──── */}
        {screen === "wizard" && (
          <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px" }}>
            {/* Progress */}
            <div style={{ display: "flex", gap: 8, marginBottom: 36 }}>
              {[1, 2, 3].map(s => (
                <div key={s} style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: wizStep >= s ? "var(--green)" : "var(--slate-dim)", marginBottom: 6 }}>
                    STEP {s} / 3
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: wizStep >= s ? "var(--green)" : "var(--border)", transition: "background .3s" }} />
                </div>
              ))}
            </div>

            <div style={{ animation: "fade-up .3s ease" }}>
              {/* STEP 1 */}
              {wizStep === 1 && (
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--green)", letterSpacing: "0.15em", marginBottom: 12 }}>MODULE 1 — PHYSICAL PARAMETERS</div>
                  <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 28 }}>Define Your Plot</h2>
                  <div style={{ marginBottom: 24 }}>
                    <Label>PLOT AREA (m²)</Label>
                    <InputBox value={params.area} onChange={set("area")} min={10} max={100000} />
                    <div style={{ fontSize: 11, color: "var(--slate-dim)", fontFamily: "var(--font-mono)", marginTop: 6 }}>{params.area} m² ≈ {(params.area * 10.764).toFixed(0)} sq ft</div>
                  </div>
                  <div>
                    <Label>PLOT GEOMETRY</Label>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {[{ v: "square", l: "Square", s: "1:1 ratio" }, { v: "rectangular", l: "Rectangular", s: "Wide format" }, { v: "narrow", l: "Narrow Strip", s: "⚠ Edge effects" }].map(o => (
                        <ToggleCard key={o.v} label={o.l} sub={o.s} selected={params.shape === o.v} onClick={() => setParams(p => ({ ...p, shape: o.v }))} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {wizStep === 2 && (
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--cyan)", letterSpacing: "0.15em", marginBottom: 12 }}>MODULE 2 — ENVIRONMENTAL PARAMETERS</div>
                  <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 28 }}>Site Conditions</h2>
                  <div style={{ marginBottom: 20 }}>
                    <Label>LAND TYPE</Label>
                    <select value={params.landType} onChange={set("landType")}>
                      <option value="barren">Barren Dirt / Degraded Soil</option>
                      <option value="industrial">Industrial / Post-Industrial</option>
                      <option value="residential">Residential / Urban Green</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <Label>SUNLIGHT EXPOSURE</Label>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {[{ v: "full", l: "Full Sun", s: "6+ hrs/day" }, { v: "partial", l: "Partial", s: "3–6 hrs/day" }, { v: "shade", l: "Shaded", s: "<3 hrs/day" }].map(o => (
                        <ToggleCard key={o.v} label={o.l} sub={o.s} selected={params.sunlight === o.v} onClick={() => setParams(p => ({ ...p, sunlight: o.v }))} />
                      ))}
                    </div>
                  </div>
                  {/* Advanced section */}
                  <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                    <div onClick={() => setShowAdvanced(!showAdvanced)} style={{ padding: "12px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg2)" }}>
                      <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--slate)" }}>▸ ADVANCED SOIL SPECIFICATIONS</span>
                      <span style={{ fontSize: 12, color: "var(--slate-dim)" }}>{showAdvanced ? "▲" : "▼"}</span>
                    </div>
                    {showAdvanced && (
                      <div style={{ padding: "16px", background: "var(--bg1)" }}>
                        <div style={{ marginBottom: 20 }}>
                          <Label>SOIL pH — {params.soilPH.toFixed(1)}</Label>
                          <input type="range" min="4.0" max="9.0" step="0.1" value={params.soilPH} onChange={e => setParams(p => ({ ...p, soilPH: +e.target.value }))} style={{ width: "100%" }} />
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--slate-dim)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
                            <span>4.0 ACIDIC</span><span>7.0 NEUTRAL</span><span>ALKALINE 9.0</span>
                          </div>
                        </div>
                        <div>
                          <Label>BULK DENSITY — {params.bulkDensity.toFixed(2)} g/cm³</Label>
                          <input type="range" min="0.8" max="2.0" step="0.05" value={params.bulkDensity} onChange={e => setParams(p => ({ ...p, bulkDensity: +e.target.value }))} style={{ width: "100%" }} />
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--slate-dim)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
                            <span>0.8 LOOSE</span><span>COMPACTED 2.0</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {wizStep === 3 && (
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--amber)", letterSpacing: "0.15em", marginBottom: 12 }}>MODULE 3 — STRATEGIC PRESET</div>
                  <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Select Your Method</h2>
                  <p style={{ fontSize: 14, color: "var(--slate)", marginBottom: 28, lineHeight: 1.6 }}>Your planting density determines sapling count, soil volume, and projected outcomes.</p>
                  <div style={{ display: "flex", gap: 16, flexDirection: "column" }}>
                    {/* Miyawaki */}
                    <div onClick={() => setParams(p => ({ ...p, density: "miyawaki" }))} style={{
                      padding: "20px 22px", borderRadius: 10, cursor: "pointer",
                      border: `1px solid ${params.density === "miyawaki" ? "var(--green)" : "var(--border)"}`,
                      background: params.density === "miyawaki" ? "rgba(16,243,138,.07)" : "var(--bg2)",
                      transition: "all .2s"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: params.density === "miyawaki" ? "var(--green)" : "var(--border)", transition: "background .2s" }} />
                        <span style={{ fontSize: 16, fontWeight: 700, color: params.density === "miyawaki" ? "var(--green)" : "#E2E8F0" }}>Max Growth Acceleration</span>
                        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--green)", padding: "2px 8px", border: "1px solid var(--green-dim)", borderRadius: 4 }}>MIYAWAKI METHOD</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--slate)", marginLeft: 24, lineHeight: 1.6 }}>
                        Dense multi-layer planting at <strong style={{ color: "#E2E8F0" }}>3.5 trees/m²</strong>. Forest establishment in 20–30 years vs. 200+ years traditional. Higher upfront cost; maximizes biodiversity and carbon velocity.
                      </div>
                      <div style={{ marginLeft: 24, marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--green-dim)" }}>
                        N = {params.area} × 3.5 = {Math.round(params.area * 3.5).toLocaleString()} saplings
                      </div>
                    </div>
                    {/* Traditional */}
                    <div onClick={() => setParams(p => ({ ...p, density: "traditional" }))} style={{
                      padding: "20px 22px", borderRadius: 10, cursor: "pointer",
                      border: `1px solid ${params.density === "traditional" ? "var(--amber)" : "var(--border)"}`,
                      background: params.density === "traditional" ? "rgba(245,158,11,.07)" : "var(--bg2)",
                      transition: "all .2s"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: params.density === "traditional" ? "var(--amber)" : "var(--border)", transition: "background .2s" }} />
                        <span style={{ fontSize: 16, fontWeight: 700, color: params.density === "traditional" ? "var(--amber)" : "#E2E8F0" }}>Budget Restoration</span>
                        <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--amber)", padding: "2px 8px", border: "1px solid var(--amber-dim)", borderRadius: 4 }}>TRADITIONAL FORESTRY</span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--slate)", marginLeft: 24, lineHeight: 1.6 }}>
                        Spaced planting at <strong style={{ color: "#E2E8F0" }}>0.5 trees/m²</strong>. Lower sapling and amendment cost; suitable for large-area phased restoration with limited capital budget.
                      </div>
                      <div style={{ marginLeft: 24, marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--amber-dim)" }}>
                        N = {params.area} × 0.5 = {Math.round(params.area * 0.5).toLocaleString()} saplings
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation buttons */}
            <div style={{ display: "flex", gap: 12, marginTop: 36 }}>
              {wizStep > 1 && (
                <button onClick={() => setWizStep(s => s - 1)} style={{ flex: 1, padding: "12px", background: "transparent", border: "1px solid var(--border)", color: "var(--slate)", borderRadius: 8, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 13 }}>← BACK</button>
              )}
              {wizStep < 3 ? (
                <button onClick={() => setWizStep(s => s + 1)} style={{ flex: 2, padding: "12px", background: "var(--bg2)", border: "1px solid var(--border-bright)", color: "#E2E8F0", borderRadius: 8, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600 }}>
                  NEXT STEP →
                </button>
              ) : (
                <button onClick={runSim} style={{ flex: 2, padding: "13px", background: "var(--green)", border: "none", color: "#0A0F1E", borderRadius: 8, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 800, letterSpacing: "0.05em", animation: "glow-pulse 2s infinite" }}>
                  COMPILE ECOSYSTEM ⬡
                </button>
              )}
            </div>
          </div>
        )}

        {/* ──── DASHBOARD ──── */}
        {screen === "dashboard" && results && (
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 28 }}>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--green)", letterSpacing: "0.15em", marginBottom: 8 }}>
                  COMPILATION COMPLETE — {new Date().toLocaleDateString("en-IN")}
                </div>
                <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: "#E2E8F0" }}>
                  Ecosystem Blueprint
                  <span style={{ fontSize: 13, fontWeight: 400, color: "var(--slate)", fontFamily: "var(--font-mono)", marginLeft: 14 }}>
                    {params.area}m² · {params.density === "miyawaki" ? "Miyawaki" : "Traditional"}
                  </span>
                </h1>
              </div>
              <button onClick={() => { setScreen("wizard"); setWizStep(1); }} style={{ padding: "8px 18px", background: "transparent", border: "1px solid var(--border)", color: "var(--slate)", borderRadius: 6, cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                ← RECOMPILE
              </button>
            </div>

            {/* KPI strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 28 }}>
              <StatCard label="TOTAL SAPLINGS" value={results.N.toLocaleString()} unit="specimens" color="var(--green)" />
              <StatCard label="AMENDMENT VOL." value={results.Vamend.toFixed(1)} unit="m³" color="var(--cyan)" />
              <StatCard label="CO₂ @ YEAR 10" value={results.co2_y10.toLocaleString()} unit="t" color="var(--green)" />
              <StatCard label="MICROCLIMATE Δ" value={`-${results.cooling}`} unit="°C" color="var(--cyan)" />
              <StatCard label="STORMWATER DIV." value={`${(results.hydro / 1000).toFixed(0)}k`} unit="L/yr" color="var(--cyan)" />
              {results.isNarrow && <StatCard label="EDGE EFFECT" value="ACTIVE" unit="" color="var(--amber)" sub="Narrow strip warning" />}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                  padding: "10px 18px", background: "transparent", border: "none",
                  borderBottom: activeTab === t.id ? "2px solid var(--green)" : "2px solid transparent",
                  color: activeTab === t.id ? "var(--green)" : "var(--slate)",
                  cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.05em",
                  transition: "all .2s", marginBottom: -1
                }}>
                  {t.label.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ animation: "fade-up .3s ease" }}>
              {activeTab === "canvas" && <PlotCanvas params={params} results={results} />}
              {activeTab === "logistics" && <LogisticsTable results={results} />}
              {activeTab === "analytics" && <Analytics results={results} />}
              {activeTab === "timeline" && <Timeline />}
            </div>

            {/* Footer */}
            <div style={{ marginTop: 48, padding: "16px 20px", background: "var(--bg1)", border: "1px solid var(--border)", borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--slate-dim)", display: "flex", gap: 24, flexWrap: "wrap" }}>
              <span>GVan · Ecological Compiler</span>
              <span>Method: {params.density === "miyawaki" ? "Miyawaki (3.5/m²)" : "Traditional (0.5/m²)"}</span>
              <span>pH: {params.soilPH.toFixed(1)} · ρb: {params.bulkDensity.toFixed(2)} g/cm³</span>
              <span>Land: {params.landType} · Sun: {params.sunlight}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}