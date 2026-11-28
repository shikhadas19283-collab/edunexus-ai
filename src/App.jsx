import React, { useState, useEffect, useRef } from "react";

// আপনার বিদ্যমান Gemini API Key (Vercel Environment Variable: VITE_GEMINI_API_KEY)
const GEMINI_API_KEY =
  import.meta.env?.VITE_GEMINI_API_KEY || window.__GEMINI_API_KEY__ || "";
const AI_MODEL = "gemini-3.5-flash-lite";

async function callGemini({ prompt, imageBase64 = null, mimeType = "image/jpeg" }) {
  if (!GEMINI_API_KEY) {
    return "⚠️ Vercel-এ VITE_GEMINI_API_KEY সেট করা নেই। Settings → Environment Variables-এ গিয়ে API Key যোগ করুন।";
  }
  const parts = [];
  if (imageBase64) parts.push({ inlineData: { data: imageBase64, mimeType } });
  parts.push({ text: prompt });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${encodeURIComponent(
      GEMINI_API_KEY
    )}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }] })
    }
  );
  if (!res.ok) throw new Error(`AI Error (${res.status})`);
  const data = await res.json();
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("\n")
      .trim() || "কোনো উত্তর পাওয়া যায়নি।"
  );
}

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || "").split(",")[1] || "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const speakText = (text, lang = "bn-BD") => {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  window.speechSynthesis.speak(u);
};

const APP_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #0b1120; color: #f8fafc; font-family: 'Segoe UI', system-ui, sans-serif; }
  .app-shell { max-width: 520px; margin: 0 auto; min-height: 100vh; padding: 14px 14px 86px; background: radial-gradient(circle at top, #1e1b4b 0%, #0b1120 45%); }
  .topbar { display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: rgba(30,41,59,0.75); backdrop-filter: blur(12px); border: 1px solid rgba(148,163,184,0.18); border-radius: 16px; margin-bottom: 14px; }
  .brand { font-size: 18px; font-weight: 800; background: linear-gradient(90deg, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .badge { font-size: 11px; padding: 4px 8px; border-radius: 999px; background: rgba(99,102,241,0.22); color: #c7d2fe; border: 1px solid rgba(129,140,248,0.35); }
  .card { background: rgba(30,41,59,0.7); border: 1px solid rgba(148,163,184,0.16); border-radius: 16px; padding: 14px; margin-bottom: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.25); }
  .card h4 { margin: 0 0 10px; font-size: 15px; color: #e2e8f0; display: flex; align-items: center; gap: 6px; }
  .input, .textarea, .select { width: 100%; background: #0f172a; color: #f8fafc; border: 1px solid #334155; border-radius: 10px; padding: 10px 12px; font-size: 13px; margin-bottom: 8px; outline: none; }
  .input:focus, .textarea:focus { border-color: #6366f1; }
  .btn { background: linear-gradient(135deg, #4f46e5, #0ea5e9); color: #fff; border: none; border-radius: 10px; padding: 9px 14px; font-size: 13px; font-weight: 600; cursor: pointer; }
  .btn:disabled { opacity: 0.6; }
  .btn-sub { background: #1e293b; color: #cbd5e1; border: 1px solid #334155; border-radius: 10px; padding: 8px 12px; font-size: 12px; cursor: pointer; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .output { margin-top: 10px; background: #020617; border: 1px solid #1e293b; border-radius: 12px; padding: 12px; font-size: 13px; line-height: 1.55; white-space: pre-wrap; color: #e2e8f0; }
  .progress-bg { height: 8px; background: #1e293b; border-radius: 99px; overflow: hidden; margin: 8px 0; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, #22d3ee, #6366f1); }
  .bottom-nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 520px; display: grid; grid-template-columns: repeat(5, 1fr); background: rgba(15,23,42,0.94); backdrop-filter: blur(14px); border-top: 1px solid rgba(148,163,184,0.2); padding: 8px 6px; z-index: 40; }
  .nav-btn { background: none; border: none; color: #94a3b8; font-size: 11px; display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: pointer; padding: 4px; border-radius: 10px; }
  .nav-btn.active { color: #38bdf8; background: rgba(56,189,248,0.12); font-weight: 700; }
  .toast { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); background: #4f46e5; color: #fff; padding: 8px 16px; border-radius: 999px; font-size: 12px; font-weight: 600; z-index: 60; box-shadow: 0 6px 20px rgba(79,70,229,0.5); }
`;
export default function App() {
  const [tab, setTab] = useState("home");
  const [role, setRole] = useState("student");
  const [studentName, setStudentName] = useState(() => localStorage.getItem("en_name") || "EduNexus Student");
  const [xp, setXp] = useState(() => Number(localStorage.getItem("en_xp") || 150));
  const [guardianPhone, setGuardianPhone] = useState(() => localStorage.getItem("en_phone") || "");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);

  // Home & Exam Mode
  const [examDate, setExamDate] = useState("2027-11-27");
  const [examMode, setExamMode] = useState(false);
  const [cheatCount, setCheatCount] = useState(0);
  const [pomoSec, setPomoSec] = useState(25 * 60);
  const [pomoOn, setPomoOn] = useState(false);

  // AI Lab States
  const [aiTool, setAiTool] = useState("evaluator");
  const [aiPromptInput, setAiPromptInput] = useState("");
  const [aiFile, setAiFile] = useState(null);
  const [aiOutput, setAiOutput] = useState("");

  // Study Tools States
  const [toolTopic, setToolTopic] = useState("");
  const [toolOutput, setToolOutput] = useState("");
  const [battleQ, setBattleQ] = useState(null);
  const [scores, setScores] = useState({ me: 0, rival: 0 });
  const [calcExpr, setCalcExpr] = useState("");
  const [calcAns, setCalcAns] = useState("0");
  const [chapters, setChapters] = useState([
    { id: 1, title: "অধ্যায় ১: মৌলিক ধারণা", done: true },
    { id: 2, title: "অধ্যায় ২: সূত্র ও অনুশীলনী", done: false }
  ]);
  const [newChap, setNewChap] = useState("");
  const [revisions, setRevisions] = useState([{ id: 1, topic: "গুরুত্বপূর্ণ সূত্র রিভিশন", due: "৩ ও ৭ দিন পর" }]);
  const [revInput, setRevInput] = useState("");

  // Classroom & Vault
  const [doubts, setDoubts] = useState([
    { id: 1, author: "Anonymous", text: "ত্রিকোণমিতির সূত্র সহজে মনে রাখার উপায় কী?", answer: "" }
  ]);
  const [doubtInput, setDoubtInput] = useState("");
  const [anon, setAnon] = useState(false);
  const [poll, setPoll] = useState({ q: "পরের ক্লাসে কোনটি পড়ব?", a: 4, b: 2 });
  const [picked, setPicked] = useState("");
  const [vault, setVault] = useState(() => {
    try { return JSON.parse(localStorage.getItem("en_vault") || "[]"); } catch { return []; }
  });

  const canvasRef = useRef(null);
  const drawing = useRef(false);

  const notify = (m) => { setToast(m); setTimeout(() => setToast(""), 3000); };
  const addXp = (pts, msg = "") => {
    const next = xp + pts;
    setXp(next);
    localStorage.setItem("en_xp", String(next));
    notify(`+${pts} XP ${msg}`);
  };

  useEffect(() => {
    if (!pomoOn) return;
    const t = setInterval(() => {
      setPomoSec((s) => {
        if (s <= 1) { setPomoOn(false); addXp(30, "Study Session Done!"); return 25 * 60; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [pomoOn]);

  useEffect(() => {
    if (!examMode) return;
    const onHide = () => {
      if (document.hidden) {
        setCheatCount((c) => c + 1);
        notify("⚠️ অ্যান্টি-চিটিং সতর্কতা: পরীক্ষা চলাকালীন স্ক্রিন ছাড়া যাবে না!");
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [examMode]);

  const startVoice = (setter, lang = "bn-BD") => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return notify("এই ব্রাউজারে ভয়েস ইনপুট সাপোর্ট করে না।");
    const rec = new SR();
    rec.lang = lang;
    rec.onresult = (e) => setter((p) => (p ? p + " " : "") + e.results[0][0].transcript);
    rec.start();
  };

  const runAiLab = async () => {
    if (!aiPromptInput.trim() && !aiFile) return notify("টেক্সট লিখুন বা ছবি সিলেক্ট করুন।");
    setLoading(true);
    try {
      const b64 = aiFile ? await fileToBase64(aiFile) : null;
      const prompts = {
        evaluator: `তুমি একজন অভিজ্ঞ শিক্ষক। শিক্ষার্থীর খাতার উত্তর মূল্যায়ন করো। প্রশ্ন/বিবরণ: "${aiPromptInput}". ১০-এ নম্বর দাও, ভুল-সঠিক পয়েন্ট আকারে দেখাও ও সঠিক সমাধান দাও।`,
        book: `এই বইয়ের পাতার লেখাটি সহজ বাংলায় সারসংক্ষেপ ও প্রয়োজনীয় অনুবাদ করে দাও। অতিরিক্ত নির্দেশনা: "${aiPromptInput}"`,
        spoken: `Act as a friendly Spoken English & Grammar Partner. Reply naturally to: "${aiPromptInput}". Give grammar correction, better phrasing, and 1 follow-up question.`,
        teach: `তুমি একজন ছাত্র এবং ব্যবহারকারী তোমার শিক্ষক। সে তোমাকে বোঝাচ্ছে: "${aiPromptInput}". তুমি কতটা বুঝলে বলো, ১টি পাল্টা প্রশ্ন করো এবং বোঝার ঘাটতি থাকলে ধরিয়ে দাও।`,
        debate: `AI Debate Arena: প্রতিযোগীর যুক্তি: "${aiPromptInput}". বিপরীত অবস্থান থেকে শক্তিশালী পাল্টা যুক্তি দাও এবং শেষে ১০-এ স্কোর দাও।`,
        notes: `নিচের লেকচার/তথ্য থেকে পরীক্ষার উপযোগী সুন্দর হেডিং ও বুলেট পয়েন্ট নোট তৈরি করো:\n${aiPromptInput}`
      };
      const out = await callGemini({ prompt: prompts[aiTool], imageBase64: b64, mimeType: aiFile?.type || "image/jpeg" });
      setAiOutput(out);
      if (aiTool === "spoken") speakText(out.split("\n")[0], "en-US");
      addXp(20, "AI Lab Used");
    } catch (e) {
      setAiOutput("সমস্যা হয়েছে: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const runCreativeTool = async (mode) => {
    if (!toolTopic.trim()) return notify("অধ্যায় বা টপিকের নাম লিখুন।");
    setLoading(true);
    try {
      const map = {
        mindmap: `"${toolTopic}" অধ্যায়ের পরিষ্কার টেক্সট মাইন্ড-ম্যাপ তৈরি করো।`,
        mnemonics: `"${toolTopic}" মনে রাখার সহজ বাংলা ছন্দ ও শর্টকাট ট্রিকস দাও।`,
        suggestion: `"${toolTopic}" থেকে পরীক্ষার গুরুত্বপূর্ণ সাজেশন (সংক্ষিপ্ত ও বড় প্রশ্ন) দাও।`,
        assignment: `"${toolTopic}" বিষয়ের অ্যাসাইনমেন্ট ও প্রজেক্ট গাইড তৈরি করো।`,
        podcast: `"${toolTopic}" নিয়ে দুজন বন্ধুর ১ মিনিটের অডিও পডকাস্ট রিভিশন স্ক্রিপ্ট বাংলায় লেখো।`
      };
      const out = await callGemini({ prompt: map[mode] });
      setToolOutput(out);
      if (mode === "podcast") speakText(out, "bn-BD");
      addXp(15, "Tool Used");
    } catch (e) {
      setToolOutput(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadBattleQ = async () => {
    setLoading(true);
    try {
      const raw = await callGemini({
        prompt: "একটি শিক্ষামূলক MCQ দাও এই ফরম্যাটে:\nQ: [প্রশ্ন]\nA) ...\nB) ...\nC) ...\nD) ...\nANS: [A/B/C/D]"
      });
      const ans = (raw.split("\n").find((l) => l.startsWith("ANS:")) || "ANS: A").replace("ANS:", "").trim();
      setBattleQ({ raw: raw.replace(/ANS:.*/, "").trim(), ans });
    } finally {
      setLoading(false);
    }
  };

  const evalCalc = () => {
    try {
      const expr = calcExpr
        .replace(/sin\(/g, "Math.sin(").replace(/cos\(/g, "Math.cos(")
        .replace(/tan\(/g, "Math.tan(").replace(/sqrt\(/g, "Math.sqrt(")
        .replace(/log\(/g, "Math.log10(").replace(/pi/gi, "Math.PI").replace(/\^/g, "**");
      // eslint-disable-next-line no-new-func
      setCalcAns(String(Function(`"use strict"; return (${expr})`)()));
    } catch { setCalcAns("Error"); }
  };

  const saveVault = (title, content) => {
    const next = [{ id: Date.now(), title, content }, ...vault];
    setVault(next);
    localStorage.setItem("en_vault", JSON.stringify(next));
    addXp(10, "Saved to Vault");
  };

  const sendWhatsApp = () => {
    const msg = `📚 *EduNexus AI রিপোর্ট*\nশিক্ষার্থী: ${studentName}\nমোট XP: ${xp}\nকুইজ স্কোর: ${scores.me}\nসিলেবাস সম্পন্ন: ${syllabusPct}%`;
    const num = guardianPhone.replace(/\D/g, "");
    window.open(num ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const daysLeft = Math.max(0, Math.ceil((new Date(examDate) - Date.now()) / 86400000));
  const syllabusPct = chapters.length ? Math.round((chapters.filter((c) => c.done).length / chapters.length) * 100) : 0;

  const drawPos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };
  return (
    <>
      <style>{APP_CSS}</style>
      <div className="app-shell">
        {toast && <div className="toast">{toast}</div>}

        <header className="topbar">
          <div>
            <div className="brand">EduNexus AI</div>
            <small style={{ color: "#94a3b8" }}>পরীক্ষা বাকি: {daysLeft} দিন • সিলেবাস {syllabusPct}%</small>
          </div>
          <div className="row">
            <span className="badge">⚡ {xp} XP</span>
            <select className="select" style={{ width: "auto", margin: 0, padding: "4px 8px" }} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>
        </header>

        {tab === "home" && (
          <>
            <div className="card">
              <h4>⏳ Exam Countdown ও সিলেবাস অগ্রগতি</h4>
              <input className="input" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
              <div className="progress-bg"><div className="progress-fill" style={{ width: `${syllabusPct}%` }} /></div>
              <small style={{ color: "#94a3b8" }}>মোট {chapters.length}টি অধ্যায়ের মধ্যে {chapters.filter((c) => c.done).length}টি সম্পন্ন ({syllabusPct}%)</small>
            </div>

            <div className="card">
              <h4>⏱️ Study Together (Pomodoro Timer)</h4>
              <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: "#38bdf8" }}>
                {String(Math.floor(pomoSec / 60)).padStart(2, "0")}:{String(pomoSec % 60).padStart(2, "0")}
              </div>
              <div className="row">
                <button className="btn" onClick={() => setPomoOn(!pomoOn)}>{pomoOn ? "⏸️ Pause" : "▶️ Start Focus"}</button>
                <button className="btn-sub" onClick={() => { setPomoOn(false); setPomoSec(25 * 60); }}>Reset</button>
              </div>
            </div>

            <div className="card">
              <h4>🛡️ অ্যান্টি-চিটিং এক্সাম মোড</h4>
              <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 0 }}>চালু থাকলে পরীক্ষা চলাকালীন অন্য অ্যাপ বা ট্যাবে গেলে সতর্কতা লগ হবে।</p>
              <button className="btn" onClick={() => setExamMode(!examMode)}>
                {examMode ? `চালু আছে (সতর্কতা: ${cheatCount})` : "এক্সাম মোড চালু করুন"}
              </button>
            </div>
          </>
        )}

        {tab === "ai" && (
          <div className="card">
            <h4>🤖 অল-ইন-ওয়ান AI ল্যাব</h4>
            <select className="select" value={aiTool} onChange={(e) => setAiTool(e.target.value)}>
              <option value="evaluator">📝 Answer Sheet Evaluator (খাতা মূল্যায়ন)</option>
              <option value="book">📖 বইয়ের পাতা থেকে সারাংশ ও অনুবাদ</option>
              <option value="spoken">🗣️ Spoken English & Grammar Partner</option>
              <option value="teach">🎓 Teach the AI (উল্টো টিউটর)</option>
              <option value="debate">⚔️ AI ডিবেট অ্যারেনা</option>
              <option value="notes">🗒️ Lecture to Notes</option>
            </select>

            {(aiTool === "evaluator" || aiTool === "book") && (
              <input className="input" type="file" accept="image/*" onChange={(e) => setAiFile(e.target.files?.[0] || null)} />
            )}
            <textarea
              className="textarea"
              rows={3}
              placeholder="প্রশ্ন, যুক্তি, লেকচার বা ইংরেজি বাক্য লিখুন..."
              value={aiPromptInput}
              onChange={(e) => setAiPromptInput(e.target.value)}
            />
            <div className="row">
              <button className="btn" onClick={runAiLab} disabled={loading}>{loading ? "প্রসেস হচ্ছে..." : "✨ AI চালাও"}</button>
              <button className="btn-sub" onClick={() => startVoice(setAiPromptInput, aiTool === "spoken" ? "en-US" : "bn-BD")}>🎙️ Voice</button>
              {aiOutput && <button className="btn-sub" onClick={() => saveVault(aiTool.toUpperCase(), aiOutput)}>⭐ Save</button>}
            </div>
            {aiOutput && <div className="output">{aiOutput}</div>}
          </div>
        )}

        {tab === "tools" && (
          <>
            <div className="card">
              <h4>🧠 Mind-Map, Mnemonics, Suggestion, Assignment ও Podcast</h4>
              <input className="input" placeholder="অধ্যায় বা টপিকের নাম লিখুন..." value={toolTopic} onChange={(e) => setToolTopic(e.target.value)} />
              <div className="row">
                <button className="btn-sub" onClick={() => runCreativeTool("mindmap")}>Mind-Map</button>
                <button className="btn-sub" onClick={() => runCreativeTool("mnemonics")}>Mnemonics</button>
                <button className="btn-sub" onClick={() => runCreativeTool("suggestion")}>Suggestion</button>
                <button className="btn-sub" onClick={() => runCreativeTool("assignment")}>Assignment</button>
                <button className="btn-sub" onClick={() => runCreativeTool("podcast")}>🎧 Podcast</button>
              </div>
              {toolOutput && <div className="output">{toolOutput}</div>}
            </div>

            <div className="card">
              <h4>⚔️ 1v1 Quiz Battle (আপনি: {scores.me} | প্রতিদ্বন্দ্বী: {scores.rival})</h4>
              <button className="btn" onClick={loadBattleQ} disabled={loading}>নতুন প্রশ্ন নিন</button>
              {battleQ && (
                <>
                  <div className="output">{battleQ.raw}</div>
                  <div className="row" style={{ marginTop: 8 }}>
                    {["A", "B", "C", "D"].map((o) => (
                      <button key={o} className="btn-sub" onClick={() => {
                        const win = o === battleQ.ans;
                        setScores((s) => ({ me: s.me + (win ? 10 : 0), rival: s.rival + (Math.random() > 0.5 ? 10 : 0) }));
                        notify(win ? "✅ সঠিক উত্তর! +10" : `❌ সঠিক উত্তর: ${battleQ.ans}`);
                        loadBattleQ();
                      }}>{o}</button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="card">
              <h4>🧮 Scientific Calculator ও Formula Sheet</h4>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>(a+b)² = a²+2ab+b² • v = u+at • E = mc²</div>
              <div className="row">
                <input className="input" style={{ flex: 1, marginBottom: 0 }} placeholder="sin(0.5)+sqrt(16)" value={calcExpr} onChange={(e) => setCalcExpr(e.target.value)} />
                <button className="btn" onClick={evalCalc}>=</button>
              </div>
              <div style={{ marginTop: 6, fontWeight: 700, color: "#38bdf8" }}>ফলাফল: {calcAns}</div>
            </div>

            <div className="card">
              <h4>🎨 স্মার্ট হোয়াইটবোর্ড</h4>
              <canvas
                ref={canvasRef}
                width={300}
                height={150}
                style={{ width: "100%", background: "#020617", borderRadius: 10, border: "1px solid #334155", touchAction: "none" }}
                onMouseDown={(e) => { drawing.current = true; const ctx = canvasRef.current.getContext("2d"); const p = drawPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }}
                onMouseMove={(e) => { if (!drawing.current) return; const ctx = canvasRef.current.getContext("2d"); const p = drawPos(e); ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 2.5; ctx.lineTo(p.x, p.y); ctx.stroke(); }}
                onMouseUp={() => { drawing.current = false; }}
                onTouchStart={(e) => { drawing.current = true; const ctx = canvasRef.current.getContext("2d"); const p = drawPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }}
                onTouchMove={(e) => { if (!drawing.current) return; const ctx = canvasRef.current.getContext("2d"); const p = drawPos(e); ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 2.5; ctx.lineTo(p.x, p.y); ctx.stroke(); }}
                onTouchEnd={() => { drawing.current = false; }}
              />
              <button className="btn-sub" style={{ marginTop: 6 }} onClick={() => canvasRef.current.getContext("2d").clearRect(0, 0, 300, 150)}>Clear</button>
            </div>

            <div className="card">
              <h4>📚 Syllabus ও Spaced Revision</h4>
              <div className="row">
                <input className="input" style={{ flex: 1, marginBottom: 0 }} placeholder="নতুন অধ্যায়..." value={newChap} onChange={(e) => setNewChap(e.target.value)} />
                <button className="btn-sub" onClick={() => { if (!newChap.trim()) return; setChapters([...chapters, { id: Date.now(), title: newChap, done: false }]); setNewChap(""); }}>+ যোগ</button>
              </div>
              {chapters.map((c) => (
                <label key={c.id} style={{ display: "block", marginTop: 6, fontSize: 13 }}>
                  <input type="checkbox" checked={c.done} onChange={() => setChapters(chapters.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)))} /> {c.title}
                </label>
              ))}
              <hr style={{ borderColor: "#1e293b", margin: "10px 0" }} />
              <div className="row">
                <input className="input" style={{ flex: 1, marginBottom: 0 }} placeholder="রিভিশন টপিক..." value={revInput} onChange={(e) => setRevInput(e.target.value)} />
                <button className="btn-sub" onClick={() => { if (!revInput.trim()) return; setRevisions([...revisions, { id: Date.now(), topic: revInput, due: "৩ ও ৭ দিন পর" }]); setRevInput(""); }}>⏰ সেট</button>
              </div>
              {revisions.map((r) => <div key={r.id} style={{ fontSize: 12, color: "#cbd5e1", marginTop: 4 }}>⏰ {r.topic} ({r.due})</div>)}
            </div>
          </>
        )}

        {tab === "class" && (
          <>
            <div className="card">
              <h4>🤝 Peer Help ও Anonymous Doubt Box</h4>
              <label style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
                <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} /> নাম গোপন রাখুন (Anonymous)
              </label>
              <div className="row">
                <input className="input" style={{ flex: 1, marginBottom: 0 }} placeholder="আপনার প্রশ্ন লিখুন..." value={doubtInput} onChange={(e) => setDoubtInput(e.target.value)} />
                <button className="btn" onClick={() => {
                  if (!doubtInput.trim()) return;
                  setDoubts([{ id: Date.now(), author: anon ? "Anonymous" : studentName, text: doubtInput, answer: "" }, ...doubts]);
                  setDoubtInput("");
                  addXp(10, "Doubt Posted");
                }}>পোস্ট</button>
              </div>
              {doubts.map((d) => (
                <div key={d.id} className="output">
                  <strong>{d.author}:</strong> {d.text}
                  <div style={{ marginTop: 6 }}>
                    {d.answer ? `✅ ${d.answer}` : (
                      <button className="btn-sub" onClick={() => {
                        setDoubts(doubts.map((x) => (x.id === d.id ? { ...x, answer: "সহপাঠীর সমাধান: মূল সূত্রটি লিখে ধাপে ধাপে অনুশীলন করুন।" } : x)));
                        addXp(20, "Peer Help");
                      }}>সাহায্য করুন (+20 XP)</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <h4>📊 Live Poll, Seen List ও Random Picker</h4>
              <p style={{ margin: "0 0 8px", fontSize: 13 }}>{poll.q}</p>
              <div className="row">
                <button className="btn-sub" onClick={() => setPoll({ ...poll, a: poll.a + 1 })}>গণিত ({poll.a})</button>
                <button className="btn-sub" onClick={() => setPoll({ ...poll, b: poll.b + 1 })}>বিজ্ঞান ({poll.b})</button>
              </div>
              <p style={{ fontSize: 12, color: "#94a3b8" }}>নোটিশ Seen: রাহিম, মিতু, আরিফ</p>
              <button className="btn" onClick={() => {
                const list = ["আরিফ", "সুমাইয়া", "তানভীর", "নুসরাত", "দীপ", "প্রিয়া"];
                setPicked(list[Math.floor(Math.random() * list.length)]);
              }}>🎲 Random Student Picker</button>
              {picked && <span style={{ marginLeft: 10, color: "#38bdf8", fontWeight: 700 }}>নির্বাচিত: {picked}</span>}
            </div>
          </>
        )}

        {tab === "profile" && (
          <div className="card">
            <h4>🪪 My ID ও অভিভাবক WhatsApp রিপোর্ট</h4>
            <input className="input" value={studentName} onChange={(e) => { setStudentName(e.target.value); localStorage.setItem("en_name", e.target.value); }} placeholder="আপনার নাম" />
            <input className="input" value={guardianPhone} onChange={(e) => { setGuardianPhone(e.target.value); localStorage.setItem("en_phone", e.target.value); }} placeholder="অভিভাবকের WhatsApp নম্বর (8801...)" />
            <button className="btn" onClick={sendWhatsApp}>📲 WhatsApp-এ রেজাল্ট পাঠান</button>

            <h4 style={{ marginTop: 16 }}>⭐ Saved Answers Vault ({vault.length})</h4>
            {vault.length === 0 && <small style={{ color: "#94a3b8" }}>এখনো কিছু সেভ করা হয়নি।</small>}
            {vault.map((v) => (
              <div key={v.id} className="output">
                <strong>{v.title}</strong>{"\n"}{v.content}
              </div>
            ))}
          </div>
        )}

        <nav className="bottom-nav">
          {[
            ["home", "🏠", "Home"],
            ["ai", "🤖", "AI Lab"],
            ["tools", "🧰", "Tools"],
            ["class", "👥", "Class"],
            ["profile", "🪪", "My ID"]
          ].map(([id, icon, label]) => (
            <button key={id} className={`nav-btn ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>
              <span style={{ fontSize: 18 }}>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
