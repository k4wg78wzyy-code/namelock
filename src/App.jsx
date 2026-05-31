import { useState, useEffect } from "react";

const FEATURES = [
  "forehead", "eyebrows", "eyes", "nose", "cheeks",
  "mouth", "chin", "ears", "jawline", "hair"
];

const FEATURE_ICONS = {
  forehead: "🧠", eyebrows: "〰️", eyes: "👁️", nose: "👃",
  cheeks: "🌸", mouth: "👄", chin: "🫦", ears: "👂",
  jawline: "💎", hair: "💇"
};

const FEATURE_TIPS = {
  forehead: "Is it high, wide, wrinkled, or shiny?",
  eyebrows: "Thick, thin, arched, bushy, or expressive?",
  eyes: "Color, shape, deep-set, wide, hooded?",
  nose: "Broad, narrow, upturned, hooked, button?",
  cheeks: "High cheekbones, rosy, full, hollow?",
  mouth: "Wide smile, thin lips, full lips, expressive?",
  chin: "Strong, round, cleft, receding, pointed?",
  ears: "Large, small, prominent, close to head?",
  jawline: "Sharp, soft, wide, narrow, square?",
  hair: "Color, texture, thick, receding, styled?"
};

const MEMORY_TIPS = [
  "🎭 Make the image ABSURD — the weirder, the stickier",
  "🌊 Add MOTION to your image — things should be moving or exploding",
  "🎨 Make it VIVID in color — saturate the mental picture",
  "😂 Add EMOTION — funny or shocking images stick best",
  "🔗 GLUE the image directly to the feature — imagine it physically there"
];

const DEFAULT_MODEL = "claude-sonnet-4-6";
const LS_KEY = "namelock_apikey";
const LS_MODEL = "namelock_model";
const LS_SAVED = "namelock_saved";

function lsGet(k, fallback = "") {
  try { return localStorage.getItem(k) ?? fallback; } catch { return fallback; }
}
function lsSet(k, v) {
  try { localStorage.setItem(k, v); } catch {}
}

function syllabify(name) {
  name = name.trim().toLowerCase();
  const vowels = "aeiouy";
  let syllables = [];
  let current = "";
  for (let i = 0; i < name.length; i++) {
    current += name[i];
    const isVowel = vowels.includes(name[i]);
    const nextIsConsonant = i + 1 < name.length && !vowels.includes(name[i + 1]);
    const nextNextIsVowel = i + 2 < name.length && vowels.includes(name[i + 2]);
    if (isVowel && nextIsConsonant && nextNextIsVowel && current.length > 1) {
      syllables.push(current);
      current = "";
    }
  }
  if (current) syllables.push(current);
  if (syllables.length === 1 && name.length > 3) {
    const mid = Math.ceil(name.length / 2);
    return [name.slice(0, mid), name.slice(mid)];
  }
  return syllables.length ? syllables : [name];
}

function extractText(data) {
  if (data == null) return "";
  if (typeof data === "string") return data.trim();
  if (Array.isArray(data.content)) {
    const t = data.content
      .filter(b => b && (b.type === "text" || typeof b.text === "string"))
      .map(b => b.text || "")
      .join("\n")
      .trim();
    if (t) return t;
  }
  if (data.message && Array.isArray(data.message.content)) return extractText(data.message);
  if (typeof data.completion === "string") return data.completion.trim();
  if (typeof data.text === "string") return data.text.trim();
  if (typeof data.content === "string") return data.content.trim();
  return "";
}

async function callClaude(messages, maxTokens) {
  const apiKey = lsGet(LS_KEY);
  const model = lsGet(LS_MODEL) || DEFAULT_MODEL;
  if (!apiKey) {
    throw new Error("No API key set. Open Settings (⚙) and paste your Anthropic API key.");
  }

  let response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        // Required to allow calling the API directly from a browser.
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages })
    });
  } catch (e) {
    throw new Error(`Network error reaching the model: ${e?.message || e}`);
  }

  const raw = await response.text();
  let data = null;
  try { data = JSON.parse(raw); } catch {}

  if (!response.ok) {
    const msg = data?.error?.message || data?.message || raw.slice(0, 300);
    if (response.status === 401) throw new Error("Your API key was rejected (401). Check it in Settings.");
    if (response.status === 429) throw new Error("Rate limited or out of credit (429). Try again shortly.");
    throw new Error(`Model request failed (${response.status}): ${msg || "no detail"}`);
  }
  if (data?.type === "error" || data?.error) {
    throw new Error(data.error?.message || "The model returned an error.");
  }

  const text = extractText(data ?? raw);
  if (!text) throw new Error(`Couldn't read the reply. Raw response: ${raw.slice(0, 200)}`);
  return text;
}

async function generateMemoryHook(name, syllables, feature, featureDetail) {
  const prompt = `You are a world-class memory coach trained in the MemoryOS and Major System techniques.

A person needs to remember the name "${name}" by linking it to their most distinctive facial feature: "${feature}" (described as: "${featureDetail || "prominent " + feature}").

The name breaks into syllables: ${syllables.map(s => `"${s}"`).join(", ")}.

Create a VIVID memory hook following these rules:
1. Transform each syllable into a concrete, memorable word or image that SOUNDS like that syllable
2. Create ONE bizarre, funny, or outrageous scene that links ALL the syllable images together AND physically involves the person's ${feature}
3. The scene must be active (things moving, exploding, dancing — not static)
4. Keep it short: 2-3 punchy sentences max
5. End with a one-line "The Anchor" — the single strongest image to recall first

Format your response as:
SYLLABLE IMAGES:
• [syllable]: [sound-alike word/image]

THE SCENE:
[2-3 vivid sentences of the bizarre linking scene involving the ${feature}]

THE ANCHOR:
[One punchy sentence — the single image to recall first]`;
  return callClaude([{ role: "user", content: prompt }], 1000);
}

async function generateQuizHint(name, feature, scene) {
  return callClaude([{
    role: "user",
    content: `Given this memory scene for the name "${name}": "${scene}"

Give ONE short quiz-style hint (1 sentence) that triggers recall without giving the name away. Focus on the ${feature} and the action in the scene.`
  }], 200);
}

// ─── Sub-components ────────────────────────────────────────────────

function SyllableChips({ syllables }) {
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", margin: "12px 0" }}>
      {syllables.map((s, i) => (
        <span key={i} style={{
          background: "linear-gradient(135deg, #ff6b35, #f7931e)", color: "#fff",
          padding: "6px 16px", borderRadius: "20px", fontFamily: "'Playfair Display', serif",
          fontSize: "1.1rem", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase",
          boxShadow: "0 4px 15px rgba(255,107,53,0.4)", animation: `popIn 0.3s ease ${i * 0.1}s both`
        }}>{s}</span>
      ))}
    </div>
  );
}

function MemoryCard({ content }) {
  const sections = { syllables: "", scene: "", anchor: "" };
  if (content) {
    const s = content.match(/SYLLABLE IMAGES:([\s\S]*?)(?=THE SCENE:|$)/i);
    const sc = content.match(/THE SCENE:([\s\S]*?)(?=THE ANCHOR:|$)/i);
    const a = content.match(/THE ANCHOR:([\s\S]*?)$/i);
    if (s) sections.syllables = s[1].trim();
    if (sc) sections.scene = sc[1].trim();
    if (a) sections.anchor = a[1].trim();
  }
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "16px", overflow: "hidden", marginTop: "20px" }}>
      {sections.syllables && (
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ color: "#ff6b35", fontSize: "0.7rem", fontWeight: "800", letterSpacing: "3px", marginBottom: "8px" }}>SYLLABLE IMAGES</div>
          <div style={{ color: "#e8dcc8", fontSize: "0.95rem", lineHeight: 1.7, whiteSpace: "pre-line" }}>{sections.syllables}</div>
        </div>
      )}
      {sections.scene && (
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,107,53,0.05)" }}>
          <div style={{ color: "#f7931e", fontSize: "0.7rem", fontWeight: "800", letterSpacing: "3px", marginBottom: "8px" }}>🎬 THE SCENE</div>
          <div style={{ color: "#f0e8d8", fontSize: "1rem", lineHeight: 1.8, whiteSpace: "pre-line" }}>{sections.scene}</div>
        </div>
      )}
      {sections.anchor && (
        <div style={{ padding: "16px 20px", background: "linear-gradient(135deg, rgba(255,107,53,0.15), rgba(247,147,30,0.1))" }}>
          <div style={{ color: "#ffd700", fontSize: "0.7rem", fontWeight: "800", letterSpacing: "3px", marginBottom: "8px" }}>⚓ THE ANCHOR</div>
          <div style={{ color: "#fff", fontSize: "1.05rem", fontWeight: "600", lineHeight: 1.6, fontStyle: "italic" }}>{sections.anchor}</div>
        </div>
      )}
      {!sections.syllables && !sections.scene && content && (
        <div style={{ padding: "20px", color: "#e8dcc8", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{content}</div>
      )}
    </div>
  );
}

function SavedCard({ entry, onQuiz, onDelete }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "12px", padding: "16px", display: "flex", justifyContent: "space-between",
      alignItems: "center", gap: "12px" }}>
      <div>
        <div style={{ color: "#fff", fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", fontWeight: "700" }}>{entry.name}</div>
        <div style={{ color: "#a09080", fontSize: "0.8rem", marginTop: "2px" }}>{FEATURE_ICONS[entry.feature]} {entry.feature} · {entry.syllables.join("-")}</div>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={() => onQuiz(entry)} style={{ background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.3)",
          color: "#ffd700", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", fontSize: "0.8rem", fontWeight: "700" }}>Quiz</button>
        <button onClick={() => onDelete(entry.id)} style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.2)",
          color: "#ff8080", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", fontSize: "0.8rem" }}>✕</button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState("create");
  const [name, setName] = useState("");
  const [syllables, setSyllables] = useState([]);
  const [feature, setFeature] = useState("");
  const [featureDetail, setFeatureDetail] = useState("");
  const [loading, setLoading] = useState(false);
  const [hookContent, setHookContent] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState([]);
  const [tipIdx, setTipIdx] = useState(0);
  const [quizEntry, setQuizEntry] = useState(null);
  const [quizHint, setQuizHint] = useState("");
  const [quizAnswer, setQuizAnswer] = useState("");
  const [quizRevealed, setQuizRevealed] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);

  // Settings
  const [apiKey, setApiKey] = useState(lsGet(LS_KEY));
  const [model, setModel] = useState(lsGet(LS_MODEL) || DEFAULT_MODEL);
  const [keySaved, setKeySaved] = useState(false);
  const hasKey = !!lsGet(LS_KEY);

  useEffect(() => {
    if (name.length > 1) setSyllables(syllabify(name));
    else setSyllables([]);
  }, [name]);

  useEffect(() => {
    const t = setInterval(() => setTipIdx(i => (i + 1) % MEMORY_TIPS.length), 3500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const s = lsGet(LS_SAVED);
    if (s) { try { setSaved(JSON.parse(s)); } catch {} }
  }, []);

  const persist = (entries) => {
    setSaved(entries);
    lsSet(LS_SAVED, JSON.stringify(entries));
  };

  const saveSettings = () => {
    lsSet(LS_KEY, apiKey.trim());
    lsSet(LS_MODEL, model.trim() || DEFAULT_MODEL);
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  };

  const handleGenerate = async () => {
    if (!name.trim() || !feature) return;
    setLoading(true); setHookContent(""); setError("");
    try {
      setHookContent(await generateMemoryHook(name, syllables, feature, featureDetail));
    } catch (e) {
      setError(e?.message || "Something went wrong.");
    }
    setLoading(false);
  };

  const handleSave = () => {
    if (!hookContent || !name) return;
    persist([{ id: Date.now(), name: name.trim(), syllables, feature, featureDetail, hook: hookContent }, ...saved]);
    setTab("library");
  };

  const handleQuiz = async (entry) => {
    setQuizEntry(entry); setQuizAnswer(""); setQuizRevealed(false); setQuizLoading(true); setQuizHint("");
    try { setQuizHint(await generateQuizHint(entry.name, entry.feature, entry.hook)); } catch (e) { setQuizHint("(Couldn't load hint — review the scene below.)"); }
    setQuizLoading(false);
  };

  const S = {
    app: { minHeight: "100vh", background: "#0f0c09", color: "#e8dcc8", fontFamily: "'DM Sans', sans-serif", position: "relative", overflow: "hidden" },
    grain: { position: "fixed", inset: 0, zIndex: 0, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`, pointerEvents: "none" },
    glow1: { position: "fixed", top: "-200px", right: "-200px", width: "600px", height: "600px", background: "radial-gradient(circle, rgba(255,107,53,0.12) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none", zIndex: 0 },
    glow2: { position: "fixed", bottom: "-300px", left: "-200px", width: "700px", height: "700px", background: "radial-gradient(circle, rgba(247,147,30,0.08) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none", zIndex: 0 },
    container: { position: "relative", zIndex: 1, maxWidth: "640px", margin: "0 auto", padding: "calc(28px + env(safe-area-inset-top)) 20px calc(80px + env(safe-area-inset-bottom))" },
    header: { textAlign: "center", marginBottom: "28px", position: "relative" },
    logo: { display: "inline-flex", alignItems: "center", gap: "10px", background: "linear-gradient(135deg, #ff6b35, #f7931e)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontFamily: "'Playfair Display', serif", fontSize: "2.2rem", fontWeight: "900" },
    subtitle: { color: "#806050", fontSize: "0.8rem", letterSpacing: "4px", textTransform: "uppercase", marginTop: "6px" },
    gear: { position: "absolute", right: 0, top: "4px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", width: "40px", height: "40px", cursor: "pointer", fontSize: "1.1rem", color: "#e8dcc8" },
    tabs: { display: "flex", gap: "4px", marginBottom: "24px", background: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "4px" },
    tab: (a) => ({ flex: 1, padding: "10px", border: "none", borderRadius: "9px", cursor: "pointer", fontSize: "0.82rem", fontWeight: "700", letterSpacing: "0.5px", transition: "all 0.2s", background: a ? "linear-gradient(135deg, #ff6b35, #f7931e)" : "transparent", color: a ? "#fff" : "#806050" }),
    label: { display: "block", fontSize: "0.7rem", fontWeight: "800", letterSpacing: "3px", color: "#806050", textTransform: "uppercase", marginBottom: "8px" },
    input: { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "#fff", padding: "14px 16px", fontSize: "1.05rem", fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" },
    featureGrid: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px", marginTop: "4px" },
    featureBtn: (a) => ({ padding: "10px 4px", border: "1px solid", borderColor: a ? "#ff6b35" : "rgba(255,255,255,0.08)", borderRadius: "10px", cursor: "pointer", textAlign: "center", background: a ? "rgba(255,107,53,0.15)" : "rgba(255,255,255,0.03)", color: a ? "#ff6b35" : "#806050", fontSize: "0.65rem", fontWeight: "700" }),
    genBtn: { width: "100%", padding: "16px", background: "linear-gradient(135deg, #ff6b35, #f7931e)", border: "none", borderRadius: "12px", color: "#fff", fontSize: "1rem", fontWeight: "800", letterSpacing: "2px", cursor: "pointer", marginTop: "20px", textTransform: "uppercase", boxShadow: "0 8px 30px rgba(255,107,53,0.35)" },
    tip: { background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.15)", borderRadius: "10px", padding: "12px 16px", color: "#c8a840", fontSize: "0.85rem", textAlign: "center", marginBottom: "20px", minHeight: "44px" }
  };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes popIn { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes fadeUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        input:focus, textarea:focus { border-color: rgba(255,107,53,0.5) !important; outline: none; }
        button:active { transform: scale(0.97); }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: rgba(255,107,53,0.3); border-radius: 2px; }
      `}</style>
      <div style={S.app}>
        <div style={S.grain} /><div style={S.glow1} /><div style={S.glow2} />
        <div style={S.container}>
          <div style={S.header}>
            <div style={S.logo}>🧠 NameLock</div>
            <div style={S.subtitle}>Memory-Powered Name Recall</div>
            <button style={S.gear} onClick={() => setTab("settings")} title="Settings">⚙</button>
          </div>

          {!hasKey && tab !== "settings" && (
            <div onClick={() => setTab("settings")} style={{ cursor: "pointer", marginBottom: "20px", padding: "14px 16px", background: "rgba(255,107,53,0.1)", border: "1px solid rgba(255,107,53,0.3)", borderRadius: "10px", color: "#ffb088", fontSize: "0.85rem" }}>
              👋 First time? Tap here to add your Anthropic API key in Settings, then you're ready to go.
            </div>
          )}

          <div style={S.tabs}>
            {["create", "library", "quiz"].map(t => (
              <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>
                {t === "create" ? "✦ Create" : t === "library" ? "📚 Library" : "⚡ Quiz"}
              </button>
            ))}
          </div>

          {/* SETTINGS */}
          {tab === "settings" && (
            <div style={{ animation: "fadeUp 0.4s ease" }}>
              <label style={S.label}>Anthropic API Key</label>
              <input style={S.input} type="password" placeholder="sk-ant-..." value={apiKey} onChange={e => setApiKey(e.target.value)} autoComplete="off" />
              <div style={{ color: "#806050", fontSize: "0.78rem", marginTop: "8px", lineHeight: 1.6 }}>
                Stored only on this device (your browser). Get a key at{" "}
                <span style={{ color: "#ff9a5a" }}>console.anthropic.com → API Keys</span>. Each memory hook costs a fraction of a cent.
              </div>
              <label style={{ ...S.label, marginTop: "20px" }}>Model</label>
              <input style={S.input} value={model} onChange={e => setModel(e.target.value)} />
              <div style={{ color: "#806050", fontSize: "0.78rem", marginTop: "8px" }}>Default: {DEFAULT_MODEL}</div>
              <button style={S.genBtn} onClick={saveSettings}>{keySaved ? "✓ Saved" : "Save Settings"}</button>
              <button onClick={() => setTab("create")} style={{ width: "100%", marginTop: "10px", padding: "12px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "#806050", cursor: "pointer", fontWeight: "700" }}>Back</button>
            </div>
          )}

          {/* CREATE */}
          {tab === "create" && (
            <div style={{ animation: "fadeUp 0.4s ease" }}>
              <div style={S.tip}>{MEMORY_TIPS[tipIdx]}</div>
              <div style={{ marginBottom: "20px" }}>
                <label style={S.label}>Person's Name</label>
                <input style={S.input} placeholder="e.g. Margaret, Carlos, Priya..." value={name} onChange={e => setName(e.target.value)} />
                {syllables.length > 0 && (
                  <div style={{ marginTop: "10px" }}>
                    <div style={{ fontSize: "0.65rem", color: "#806050", letterSpacing: "2px", marginBottom: "6px" }}>SYLLABLES DETECTED</div>
                    <SyllableChips syllables={syllables} />
                  </div>
                )}
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label style={S.label}>Most Distinctive Feature</label>
                <div style={S.featureGrid}>
                  {FEATURES.map(f => (
                    <button key={f} style={S.featureBtn(feature === f)} onClick={() => setFeature(f)}>
                      <div style={{ fontSize: "1.2rem", marginBottom: "3px" }}>{FEATURE_ICONS[f]}</div>{f}
                    </button>
                  ))}
                </div>
                {feature && <div style={{ marginTop: "10px", color: "#806050", fontSize: "0.8rem", textAlign: "center" }}>💡 {FEATURE_TIPS[feature]}</div>}
              </div>
              {feature && (
                <div style={{ marginBottom: "8px", animation: "fadeUp 0.3s ease" }}>
                  <label style={S.label}>Describe the {feature} (optional)</label>
                  <textarea style={{ ...S.input, minHeight: "64px", resize: "vertical", lineHeight: 1.6 }} placeholder={FEATURE_TIPS[feature]} value={featureDetail} onChange={e => setFeatureDetail(e.target.value)} />
                </div>
              )}
              <button style={{ ...S.genBtn, opacity: (!name.trim() || !feature || loading) ? 0.5 : 1 }} disabled={!name.trim() || !feature || loading} onClick={handleGenerate}>
                {loading ? "⚡ Building..." : "✦ Generate Memory Hook"}
              </button>
              {loading && <div style={{ textAlign: "center", marginTop: "16px", color: "#806050", fontSize: "0.85rem", animation: "pulse 1.5s infinite" }}>Crafting your unforgettable scene...</div>}
              {error && !loading && (
                <div style={{ marginTop: "16px", padding: "14px 16px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.25)", borderRadius: "10px", color: "#ff9a9a", fontSize: "0.85rem", lineHeight: 1.5 }}>
                  ⚠️ {error}
                </div>
              )}
              {hookContent && (
                <div style={{ animation: "fadeUp 0.4s ease" }}>
                  <MemoryCard content={hookContent} />
                  {!loading && <button onClick={handleSave} style={{ width: "100%", marginTop: "12px", padding: "13px", background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)", borderRadius: "10px", color: "#ffd700", cursor: "pointer", fontSize: "0.85rem", fontWeight: "800", letterSpacing: "1px" }}>⭐ Save to Library</button>}
                </div>
              )}
            </div>
          )}

          {/* LIBRARY */}
          {tab === "library" && (
            <div style={{ animation: "fadeUp 0.4s ease" }}>
              {saved.length === 0 ? (
                <div style={{ textAlign: "center", color: "#806050", padding: "60px 20px" }}>
                  <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🧠</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>No names saved yet</div>
                  <div style={{ fontSize: "0.85rem", marginTop: "8px" }}>Generate a memory hook and save it here</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ color: "#806050", fontSize: "0.75rem", letterSpacing: "2px", marginBottom: "4px" }}>{saved.length} NAME{saved.length !== 1 ? "S" : ""} IN MEMORY</div>
                  {saved.map(entry => (
                    <SavedCard key={entry.id} entry={entry} onQuiz={(e) => { setTab("quiz"); handleQuiz(e); }} onDelete={(id) => persist(saved.filter(s => s.id !== id))} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* QUIZ */}
          {tab === "quiz" && (
            <div style={{ animation: "fadeUp 0.4s ease" }}>
              {!quizEntry ? (
                saved.length === 0 ? (
                  <div style={{ textAlign: "center", color: "#806050", padding: "60px 20px" }}>
                    <div style={{ fontSize: "3rem", marginBottom: "16px" }}>⚡</div>
                    <div>Save some names first, then quiz yourself here!</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ color: "#806050", fontSize: "0.75rem", letterSpacing: "2px", marginBottom: "16px" }}>PICK A NAME TO QUIZ</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {saved.map(entry => <SavedCard key={entry.id} entry={entry} onQuiz={handleQuiz} onDelete={(id) => persist(saved.filter(s => s.id !== id))} />)}
                    </div>
                  </div>
                )
              ) : (
                <div style={{ animation: "fadeUp 0.4s ease" }}>
                  <button onClick={() => setQuizEntry(null)} style={{ background: "none", border: "none", color: "#806050", cursor: "pointer", fontSize: "0.85rem", marginBottom: "20px", padding: 0 }}>← Back to list</button>
                  <div style={{ background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.15)", borderRadius: "16px", padding: "24px", textAlign: "center", marginBottom: "20px" }}>
                    <div style={{ fontSize: "0.7rem", color: "#806050", letterSpacing: "3px", marginBottom: "12px" }}>WHAT'S THIS PERSON'S NAME?</div>
                    <div style={{ fontSize: "0.95rem", color: "#c8a840", lineHeight: 1.7, minHeight: "48px" }}>
                      {quizLoading ? <span style={{ animation: "pulse 1s infinite" }}>Generating hint...</span> : quizHint}
                    </div>
                    <div style={{ marginTop: "12px", color: "#806050", fontSize: "0.8rem" }}>{FEATURE_ICONS[quizEntry.feature]} Think about their {quizEntry.feature}...</div>
                  </div>
                  <input style={{ ...S.input, marginBottom: "12px" }} placeholder="Type the name..." value={quizAnswer} onChange={e => setQuizAnswer(e.target.value)} />
                  {!quizRevealed ? (
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button onClick={() => setQuizRevealed(true)} style={{ flex: 1, padding: "13px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "#e8dcc8", cursor: "pointer", fontWeight: "700" }}>Reveal</button>
                      {quizAnswer && <button onClick={() => setQuizRevealed(true)} style={{ flex: 2, padding: "13px", background: quizAnswer.toLowerCase().trim() === quizEntry.name.toLowerCase() ? "linear-gradient(135deg, #22c55e, #16a34a)" : "linear-gradient(135deg, #ff6b35, #f7931e)", border: "none", borderRadius: "10px", color: "#fff", cursor: "pointer", fontWeight: "800" }}>Check Answer</button>}
                    </div>
                  ) : (
                    <div>
                      <div style={{ padding: "20px", borderRadius: "12px", textAlign: "center", background: quizAnswer.toLowerCase().trim() === quizEntry.name.toLowerCase() ? "rgba(34,197,94,0.1)" : "rgba(255,80,80,0.08)", border: `1px solid ${quizAnswer.toLowerCase().trim() === quizEntry.name.toLowerCase() ? "rgba(34,197,94,0.3)" : "rgba(255,80,80,0.2)"}`, marginBottom: "16px" }}>
                        {quizAnswer.toLowerCase().trim() === quizEntry.name.toLowerCase() ? (
                          <><div style={{ fontSize: "2rem" }}>🎉</div><div style={{ color: "#4ade80", fontWeight: "800", fontSize: "1.1rem" }}>Perfect recall!</div></>
                        ) : (
                          <><div style={{ fontSize: "1.5rem" }}>🧠</div><div style={{ color: "#ff8080", fontWeight: "700" }}>The name was:</div><div style={{ color: "#fff", fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: "900", marginTop: "4px" }}>{quizEntry.name}</div></>
                        )}
                      </div>
                      <div style={{ color: "#806050", fontSize: "0.8rem", marginBottom: "8px", letterSpacing: "2px" }}>REVIEW THE SCENE</div>
                      <MemoryCard content={quizEntry.hook} />
                      <button onClick={() => { setQuizAnswer(""); setQuizRevealed(false); handleQuiz(quizEntry); }} style={{ width: "100%", marginTop: "12px", padding: "13px", background: "linear-gradient(135deg, #ff6b35, #f7931e)", border: "none", borderRadius: "10px", color: "#fff", cursor: "pointer", fontWeight: "800", letterSpacing: "1px" }}>Try Again</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
