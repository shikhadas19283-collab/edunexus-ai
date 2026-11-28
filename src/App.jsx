// Part 1/10: Imports, Gemini Model Config & Firebase Setup
import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  updateProfile
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "firebase/firestore";

// বিদ্যমান API key ব্যবহার করুন (নতুন API key লাগবে না)
const GEMINI_API_KEY =
  import.meta.env?.VITE_GEMINI_API_KEY || window.__GEMINI_API_KEY__ || "";

// বর্তমান সক্রিয় Gemini মডেল (API key না বদলেই ভবিষ্যতে এখান থেকে মডেল বদলানো যাবে)
const AI_MODEL = "gemini-3.5-flash-lite";

const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "YOUR_FIREBASE_API_KEY",
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT.firebaseapp.com",
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT.appspot.com",
  messagingSenderId: import.meta.env?.VITE_FIREBASE_SENDER_ID || "YOUR_SENDER_ID",
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// Part 2/10: Unified Gemini API Caller (Supports Text + Base64 Image)
async function callGemini({ prompt, imageBase64 = null, mimeType = "image/jpeg", model = AI_MODEL }) {
  if (!GEMINI_API_KEY) {
    return "⚠️ Gemini API Key সেট করা নেই। Environment ভ্যারিয়েবলে VITE_GEMINI_API_KEY যুক্ত করুন।";
  }

  const parts = [];
  if (imageBase64) {
    parts.push({
      inlineData: {
        data: imageBase64,
        mimeType
      }
    });
  }
  parts.push({ text: prompt });

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    GEMINI_API_KEY
  )}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API Error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("\n")
      .trim() || "কোনো উত্তর পাওয়া যায়নি।"
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function speakBengaliOrEnglish(text, lang = "bn-BD") {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = 1;
  window.speechSynthesis.speak(utter);
}
// Part 3/10: Core App State, Auth, XP & Anti-Cheating Monitor
export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("student"); // 'student' | 'teacher'
  const [activeTab, setActiveTab] = useState("home");
  const [xp, setXp] = useState(() => Number(localStorage.getItem("edunexus_xp") || 120));
  const [guardianPhone, setGuardianPhone] = useState(
    () => localStorage.getItem("edunexus_guardian_phone") || ""
  );
  const [examModeActive, setExamModeActive] = useState(false);
  const [cheatWarnings, setCheatWarnings] = useState(0);
  const [toastMsg, setToastMsg] = useState("");

  const notify = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  const addXp = async (points, reason = "") => {
    const nextXp = xp + points;
    setXp(nextXp);
    localStorage.setItem("edunexus_xp", String(nextXp));
    notify(`+${points} XP earned! ${reason}`);
    if (user) {
      await setDoc(
        doc(db, "users", user.uid),
        {
          name: user.displayName || "EduNexus Learner",
          role,
          xp: nextXp,
          guardianPhone,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
      } else {
        const cred = await signInAnonymously(auth);
        await updateProfile(cred.user, { displayName: "Student_" + cred.user.uid.slice(0, 4) });
        setUser(cred.user);
      }
    });
    return () => unsub();
  }, []);

  // Anti-Cheating Exam Mode: ট্যাব বদলালে বা অ্যাপ থেকে বের হলে সতর্কতা + লগ
  useEffect(() => {
    if (!examModeActive) return;
    const handleVisibility = async () => {
      if (document.hidden) {
        setCheatWarnings((prev) => {
          const updated = prev + 1;
          notify(`⚠️ অ্যান্টি-চিটিং সতর্কতা #${updated}: পরীক্ষা চলাকালীন অ্যাপ থেকে বের হওয়া যাবে না!`);
          return updated;
        });
        if (user) {
          await addDoc(collection(db, "exam_alerts"), {
            studentId: user.uid,
            studentName: user.displayName || "Student",
            event: "Left exam screen / tab switch",
            createdAt: serverTimestamp()
          });
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [examModeActive, user]);
// Part 4/10: Answer Sheet Evaluator, Page Summary/Translate & Lecture-to-Notes
  const [evalQuestion, setEvalQuestion] = useState("");
  const [evalFile, setEvalFile] = useState(null);
  const [evalResult, setEvalResult] = useState("");
  const [evalLoading, setEvalLoading] = useState(false);

  const [pageFile, setPageFile] = useState(null);
  const [pageMode, setPageMode] = useState("summary_bn"); // 'summary_bn' | 'translate_bn'
  const [pageOutput, setPageOutput] = useState("");

  const [lectureInput, setLectureInput] = useState("");
  const [lectureNotes, setLectureNotes] = useState("");
  const [savedVault, setSavedVault] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("edunexus_vault") || "[]");
    } catch {
      return [];
    }
  });

  const saveToVault = (title, content) => {
    const next = [{ id: Date.now(), title, content }, ...savedVault];
    setSavedVault(next);
    localStorage.setItem("edunexus_vault", JSON.stringify(next));
    addXp(10, "Saved to Vault");
  };

  const handleEvaluateSheet = async () => {
    if (!evalFile && !evalQuestion.trim()) return notify("উত্তরপত্রের ছবি বা প্রশ্ন দিন।");
    setEvalLoading(true);
    try {
      const b64 = evalFile ? await fileToBase64(evalFile) : null;
      const mime = evalFile?.type || "image/jpeg";
      const out = await callGemini({
        prompt: `তুমি একজন অভিজ্ঞ শিক্ষক। শিক্ষার্থীর খাতার উত্তর মূল্যায়ন করো। প্রশ্ন: "${
          evalQuestion || "ছবিতে থাকা প্রশ্ন"
        }"। ১০-এ নম্বর দাও, কোথায় সঠিক ও কোথায় ভুল তা পয়েন্টে দেখাও এবং সঠিক সমাধান লিখে দাও।`,
        imageBase64: b64,
        mimeType: mime
      });
      setEvalResult(out);
      addXp(25, "Answer Sheet Evaluated");
    } catch (e) {
      setEvalResult(e.message);
    } finally {
      setEvalLoading(false);
    }
  };

  const handleBookPageProcess = async () => {
    if (!pageFile) return notify("বইয়ের পাতার একটি ছবি সিলেক্ট করুন।");
    const b64 = await fileToBase64(pageFile);
    const instruction =
      pageMode === "summary_bn"
        ? "এই বইয়ের পাতার মূলভাব ও গুরুত্বপূর্ণ পয়েন্ট সহজ বাংলায় সারসংক্ষেপ তৈরি করো।"
        : "এই বইয়ের পাতার লেখাটি স্পষ্ট ও শুদ্ধ বাংলায় অনুবাদ করো।";
    const out = await callGemini({
      prompt: instruction,
      imageBase64: b64,
      mimeType: pageFile.type || "image/jpeg"
    });
    setPageOutput(out);
    addXp(20, "Book Page Processed");
  };

  const handleLectureToNotes = async () => {
    if (!lectureInput.trim()) return;
    const out = await callGemini({
      prompt: `নিচের লেকচার বা ভয়েস ট্রান্সক্রিপ্ট থেকে সুন্দর হেডিং, বুলেট পয়েন্ট, সংজ্ঞা ও পরীক্ষার জন্য গুরুত্বপূর্ণ নোট তৈরি করো:\n${lectureInput}`
    });
    setLectureNotes(out);
    addXp(15, "Notes Generated");
  };
// Part 5/10: Spoken English Partner, Teach the AI & AI Debate Arena
  const [spokenInput, setSpokenInput] = useState("");
  const [spokenReply, setSpokenReply] = useState("");

  const [teachTopic, setTeachTopic] = useState("");
  const [studentExplanation, setStudentExplanation] = useState("");
  const [aiStudentFeedback, setAiStudentFeedback] = useState("");

  const [debateTopic, setDebateTopic] = useState("মোবাইল ফোন শিক্ষার্থীদের জন্য আশীর্বাদ না অভিশাপ?");
  const [debateArg, setDebateArg] = useState("");
  const [debateReply, setDebateReply] = useState("");

  const startVoiceDictation = (setter) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return notify("এই ব্রাউজারে ভয়েস ইনপুট সমর্থিত নয়।");
    const rec = new SR();
    rec.lang = "bn-BD";
    rec.onresult = (ev) => {
      const spoken = ev.results[0][0].transcript;
      setter((prev) => (prev ? `${prev} ${spoken}` : spoken));
    };
    rec.start();
  };

  const handleSpokenPartner = async () => {
    if (!spokenInput.trim()) return;
    const out = await callGemini({
      prompt: `Act as a friendly Spoken English & Grammar partner. Reply naturally in English to: "${spokenInput}". Then provide: 1) Grammar correction (if needed), 2) Better natural phrasing, 3) A short follow-up question.`
    });
    setSpokenReply(out);
    speakBengaliOrEnglish(out.split("\n")[0], "en-US");
    addXp(15, "Spoken Practice");
  };

  const handleTeachTheAI = async () => {
    if (!studentExplanation.trim()) return;
    const out = await callGemini({
      prompt: `তুমি এখন একজন কৌতূহলী ছাত্র/ছাত্রী এবং ব্যবহারকারী হলো তোমার শিক্ষক। টপিক: "${
        teachTopic || "সাধারণ পাঠ"
      }"। শিক্ষক তোমাকে যা বুঝিয়েছে: "${studentExplanation}"। ১) তুমি কতটুকু বুঝলে তা বলো, ২) না বোঝা জায়গা নিয়ে ১টি পাল্টা প্রশ্ন করো, ৩) শেষে বোঝার ঘাটতি থাকলে শিক্ষককে সংক্ষেপে ধরিয়ে দাও।`
    });
    setAiStudentFeedback(out);
    addXp(25, "Taught the AI");
  };

  const handleDebateTurn = async () => {
    if (!debateArg.trim()) return;
    const out = await callGemini({
      prompt: `বিতর্কের বিষয়: "${debateTopic}"। প্রতিযোগীর যুক্তি: "${debateArg}"। তুমি বিপরীত/চ্যালেঞ্জিং অবস্থান থেকে পাল্টা যুক্তি দাও এবং শেষে যুক্তির মান ও ভাষার ওপর ১০-এ একটি স্কোর ও সংক্ষিপ্ত মন্তব্য দাও।`
    });
    setDebateReply(out);
    addXp(20, "Debate Round");
  };
// Part 6/10: Mind-Map, Mnemonics, Exam Suggestion, Assignment Guide & Story Mode
  const [creativeTopic, setCreativeTopic] = useState("");
  const [creativeResult, setCreativeResult] = useState("");

  const runCreativeTool = async (mode) => {
    if (!creativeTopic.trim()) return notify("অধ্যায় বা বিষয়ের নাম লিখুন।");
    const prompts = {
      mindmap: `"${creativeTopic}" অধ্যায়ের একটি পরিষ্কার টেক্সট/ASCII মাইন্ড-ম্যাপ ও শাখাভিত্তিক ফ্লোচার্ট তৈরি করো যাতে দ্রুত রিভিশন দেওয়া যায়।`,
      mnemonics: `"${creativeTopic}" মনে রাখার জন্য সহজ বাংলা ছন্দ, শর্টকাট ফর্মুলা ও মেমোরি ট্রিকস বানিয়ে দাও।`,
      suggestion: `"${creativeTopic}" থেকে বোর্ড পরীক্ষার জন্য সবচেয়ে গুরুত্বপূর্ণ সংক্ষিপ্ত, অনুধাবন ও সৃজনশীল/বড় প্রশ্নের সাজেশন দাও।`,
      assignment: `"${creativeTopic}" বিষয়ের ওপর একটি অ্যাসাইনমেন্ট/প্রজেক্ট গাইড তৈরি করো (ভূমিকা, মূল পয়েন্ট, তথ্য ও উপসংহারসহ)।`,
      story: `"${creativeTopic}" বিষয়টিকে একটি আকর্ষণীয় গল্প বা রহস্য কাহিনি (Story Mode) আকারে উপস্থাপন করো যাতে সহজে মনে থাকে।`
    };
    const out = await callGemini({ prompt: prompts[mode] });
    setCreativeResult(out);
    addXp(20, "Study Tool Used");
  };
// Part 7/10: 1v1 Quiz Battle, Audio Podcast, Syllabus Tracker & Spaced Revision
  const [battleQuestion, setBattleQuestion] = useState(null);
  const [myScore, setMyScore] = useState(0);
  const [rivalScore, setRivalScore] = useState(0);
  const [podcastScript, setPodcastScript] = useState("");
  const [podcastTopic, setPodcastTopic] = useState("");

  const [chapters, setChapters] = useState([
    { id: 1, title: "অধ্যায় ১: মৌলিক ধারণা", done: true },
    { id: 2, title: "অধ্যায় ২: তত্ত্ব ও সূত্রাবলি", done: false },
    { id: 3, title: "অধ্যায় ৩: অনুশীলনী ও বিশ্লেষণ", done: false }
  ]);
  const [newChapter, setNewChapter] = useState("");

  const [revisionQueue, setRevisionQueue] = useState([
    { id: 1, topic: "সূত্র ও উপপাদ্য রিভিশন", days: "৩ দিন ও ৭ দিন পর" }
  ]);
  const [revTopic, setRevTopic] = useState("");

  const generateBattleQuestion = async () => {
    const raw = await callGemini({
      prompt: `একটি সংক্ষিপ্ত শিক্ষামূলক MCQ প্রশ্ন তৈরি করো। ঠিক এই ফরম্যাটে উত্তর দাও:
Q: [প্রশ্ন]
A) [অপশন ১]
B) [অপশন ২]
C) [অপশন ৩]
D) [অপশন ৪]
ANS: [A/B/C/D]`
    });
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    const ansLine = lines.find((l) => l.startsWith("ANS:")) || "ANS: A";
    setBattleQuestion({
      raw,
      correct: ansLine.replace("ANS:", "").trim()
    });
  };

  const answerBattle = (choice) => {
    if (!battleQuestion) return;
    const botPickedRight = Math.random() > 0.45;
    if (botPickedRight) setRivalScore((s) => s + 10);
    if (choice === battleQuestion.correct) {
      setMyScore((s) => s + 10);
      addXp(15, "1v1 Battle Point");
    } else {
      notify(`সঠিক উত্তর ছিল ${battleQuestion.correct}`);
    }
    generateBattleQuestion();
  };

  const createAudioPodcast = async () => {
    if (!podcastTopic.trim()) return;
    const script = await callGemini({
      prompt: `"${podcastTopic}" নিয়ে দুজন বন্ধুর কথোপকথনের মতো একটি ১ মিনিটের অডিও পডকাস্ট রিভিশন স্ক্রিপ্ট বাংলায় লেখো।`
    });
    setPodcastScript(script);
    speakBengaliOrEnglish(script, "bn-BD");
    addXp(15, "Podcast Revision");
  };

  const completedCount = chapters.filter((c) => c.done).length;
  const syllabusPercent = chapters.length ? Math.round((completedCount / chapters.length) * 100) : 0;
// Part 8/10: Formula Sheet, Scientific Calculator, Smart Whiteboard & Study Together
  const [calcExpr, setCalcExpr] = useState("");
  const [calcAns, setCalcAns] = useState("0");
  const [pomoSeconds, setPomoSeconds] = useState(25 * 60);
  const [pomoRunning, setPomoRunning] = useState(false);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    if (!pomoRunning) return;
    const timer = setInterval(() => {
      setPomoSeconds((s) => {
        if (s <= 1) {
          setPomoRunning(false);
          addXp(30, "Study Session Complete");
          return 25 * 60;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pomoRunning]);

  const evalScientific = () => {
    try {
      const normalized = calcExpr
        .replace(/sin\(/g, "Math.sin(")
        .replace(/cos\(/g, "Math.cos(")
        .replace(/tan\(/g, "Math.tan(")
        .replace(/sqrt\(/g, "Math.sqrt(")
        .replace(/log\(/g, "Math.log10(")
        .replace(/pi/gi, "Math.PI")
        .replace(/\^/g, "**");
      // eslint-disable-next-line no-new-func
      const val = Function(`"use strict"; return (${normalized})`)();
      setCalcAns(String(val));
    } catch {
      setCalcAns("Error");
    }
  };

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDraw = (e) => {
    drawingRef.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawMove = (e) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#38bdf8";
    ctx.lineTo(x, y);
    ctx.stroke();
  };
// Part 9/10: Classroom Hub, Peer Help, Polls, Anonymous Doubt, Seen List & WhatsApp Share
  const [doubts, setDoubts] = useState([]);
  const [doubtText, setDoubtText] = useState("");
  const [anonymousMode, setAnonymousMode] = useState(false);

  const [pollQuestion, setPollQuestion] = useState("পরের অধ্যায় কোনটি পড়ব?");
  const [pollVotes, setPollVotes] = useState({ optA: 0, optB: 0 });
  const [noticeText, setNoticeText] = useState("আগামীকাল ক্লাস টেস্ট ও রিভিশন সেশন রয়েছে।");
  const [seenStudents, setSeenStudents] = useState(["রাহিম", "মিতু"]);
  const [pickedStudent, setPickedStudent] = useState("");
  const [examDate, setExamDate] = useState("2027-11-27");

  useEffect(() => {
    const q = query(collection(db, "doubts"), orderBy("createdAt", "desc"), limit(20));
    return onSnapshot(q, (snap) => {
      setDoubts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const postDoubt = async () => {
    if (!doubtText.trim()) return;
    await addDoc(collection(db, "doubts"), {
      text: doubtText,
      author: anonymousMode ? "Anonymous Student" : user?.displayName || "Student",
      answer: "",
      createdAt: serverTimestamp()
    });
    setDoubtText("");
    addXp(10, "Doubt Posted");
  };

  const answerDoubt = async (id, replyText) => {
    if (!replyText.trim()) return;
    await updateDoc(doc(db, "doubts", id), { answer: replyText });
    addXp(20, "Peer Help Reward");
  };

  const pickRandomStudent = () => {
    const pool = ["আরিফ", "সুমাইয়া", "তানভীর", "নুসরাত", "দীপ", "প্রিয়া"];
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    setPickedStudent(chosen);
  };

  const sendResultToWhatsApp = () => {
    const cleanPhone = guardianPhone.replace(/\D/g, "");
    const report = `📚 *EduNexus AI রিপোর্ট কার্ড*\nশিক্ষার্থী: ${
      user?.displayName || "Student"
    }\nমোট XP: ${xp}\nকুুইজ/ব্যাটেল স্কোর: ${myScore}\nতারিখ: ${new Date().toLocaleDateString("bn-BD")}`;
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(report)}`
      : `https://wa.me/?text=${encodeURIComponent(report)}`;
    window.open(url, "_blank");
  };

  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
// Part 10A/10: Toast, Header, Navigation Bar & Home Tab
  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#f8fafc", padding: 16, fontFamily: "sans-serif" }}>
      {toastMsg && (
        <div style={{ position: "fixed", bottom: 70, left: 16, right: 16, background: "#4f46e5", padding: 10, borderRadius: 10, zIndex: 50 }}>
          {toastMsg}
        </div>
      )}

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>EduNexus AI</h2>
          <small>XP: {xp} | Exam Countdown: {daysLeft} দিন | Syllabus: {syllabusPercent}%</small>
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value)} style={{ padding: 6, borderRadius: 8 }}>
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
        </select>
      </header>

      <nav style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 14 }}>
        {["home", "ai-lab", "battle", "tools", "classroom", "my-id"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              background: activeTab === tab ? "#4f46e5" : "#1e293b",
              color: "#fff"
            }}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </nav>

      {activeTab === "home" && (
        <div>
          <h3>আজকের চ্যালেঞ্জ ও স্টাডি রুম</h3>
          <p>ডেইলি ১-মিনিট চ্যালেঞ্জ: পাই (π)-এর আনুমানিক মান কত? উত্তর ভেবে পরের ট্যাবে কুইজ ব্যাটেল খেলুন।</p>
          <button onClick={() => setExamModeActive(!examModeActive)}>
            {examModeActive
              ? "অ্যান্টি-চিটিং এক্সাম মোড চালু (Warnings: " + cheatWarnings + ")"
              : "অ্যান্টি-চিটিং এক্সাম মোড চালু করুন"}
          </button>
          <div style={{ marginTop: 12 }}>
            <strong>Study Together (Pomodoro):</strong> {Math.floor(pomoSeconds / 60)}:
            {String(pomoSeconds % 60).padStart(2, "0")}{" "}
            <button onClick={() => setPomoRunning(!pomoRunning)}>{pomoRunning ? "Pause" : "Start"}</button>
          </div>
          <div style={{ marginTop: 12 }}>
            <label>পরীক্ষার তারিখ: </label>
            <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          </div>
        </div>
      )}
// Part 10B/10: AI Lab & 1v1 Battle + Audio Podcast Tab
      {activeTab === "ai-lab" && (
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <h4>১. Answer Sheet Evaluator</h4>
            <input placeholder="প্রশ্ন লিখুন (ঐচ্ছিক)" value={evalQuestion} onChange={(e) => setEvalQuestion(e.target.value)} />
            <input type="file" accept="image/*" onChange={(e) => setEvalFile(e.target.files?.[0] || null)} />
            <button onClick={handleEvaluateSheet} disabled={evalLoading}>
              {evalLoading ? "যাচাই হচ্ছে..." : "খাতা যাচাই করুন"}
            </button>
            {evalResult && <pre style={{ whiteSpace: "pre-wrap", background: "#1e293b", padding: 10 }}>{evalResult}</pre>}
          </div>

          <div>
            <h4>২. বইয়ের পাতা থেকে সারাংশ ও অনুবাদ</h4>
            <select value={pageMode} onChange={(e) => setPageMode(e.target.value)}>
              <option value="summary_bn">সহজ বাংলায় সারাংশ</option>
              <option value="translate_bn">বাংলায় অনুবাদ</option>
            </select>
            <input type="file" accept="image/*" onChange={(e) => setPageFile(e.target.files?.[0] || null)} />
            <button onClick={handleBookPageProcess}>প্রসেস করুন</button>
            {pageOutput && <pre style={{ whiteSpace: "pre-wrap", background: "#1e293b", padding: 10 }}>{pageOutput}</pre>}
          </div>

          <div>
            <h4>৩. Spoken English & Grammar Partner</h4>
            <input placeholder="Type or speak in English..." value={spokenInput} onChange={(e) => setSpokenInput(e.target.value)} />
            <button onClick={() => startVoiceDictation(setSpokenInput)}>🎙️ Voice</button>
            <button onClick={handleSpokenPartner}>Send</button>
            {spokenReply && <pre style={{ whiteSpace: "pre-wrap", background: "#1e293b", padding: 10 }}>{spokenReply}</pre>}
          </div>

          <div>
            <h4>৪. Teach the AI (উল্টো টিউটর মোড)</h4>
            <input placeholder="বিষয়/অধ্যায়" value={teachTopic} onChange={(e) => setTeachTopic(e.target.value)} />
            <textarea
              placeholder="AI-কে নিজের ভাষায় বুঝিয়ে লিখুন বা ভয়েস দিন..."
              value={studentExplanation}
              onChange={(e) => setStudentExplanation(e.target.value)}
            />
            <button onClick={() => startVoiceDictation(setStudentExplanation)}>🎙️ Voice</button>
            <button onClick={handleTeachTheAI}>AI-কে শেখান</button>
            {aiStudentFeedback && <pre style={{ whiteSpace: "pre-wrap", background: "#1e293b", padding: 10 }}>{aiStudentFeedback}</pre>}
          </div>

          <div>
            <h4>৫. AI Debate Arena</h4>
            <input value={debateTopic} onChange={(e) => setDebateTopic(e.target.value)} />
            <input placeholder="আপনার যুক্তি লিখুন..." value={debateArg} onChange={(e) => setDebateArg(e.target.value)} />
            <button onClick={handleDebateTurn}>বিতর্কে যুক্তি দিন</button>
            {debateReply && <pre style={{ whiteSpace: "pre-wrap", background: "#1e293b", padding: 10 }}>{debateReply}</pre>}
          </div>

          <div>
            <h4>৬. Lecture to Notes & Saved Vault</h4>
            <textarea
              placeholder="লেকচার বা নোটের মূল লেখা দিন..."
              value={lectureInput}
              onChange={(e) => setLectureInput(e.target.value)}
            />
            <button onClick={() => startVoiceDictation(setLectureInput)}>🎙️ Voice</button>
            <button onClick={handleLectureToNotes}>নোট তৈরি করুন</button>
            {lectureNotes && (
              <div style={{ background: "#1e293b", padding: 10, marginTop: 6 }}>
                <pre style={{ whiteSpace: "pre-wrap" }}>{lectureNotes}</pre>
                <button onClick={() => saveToVault(lectureInput.slice(0, 25), lectureNotes)}>⭐ Vault-এ সেভ করুন</button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "battle" && (
        <div>
          <h3>1v1 Quiz Battle & Audio Podcast Revision</h3>
          <p>আপনার স্কোর: {myScore} | প্রতিদ্বন্দ্বী স্কোর: {rivalScore}</p>
          <button onClick={generateBattleQuestion}>নতুন প্রশ্ন নিন</button>
          {battleQuestion && (
            <div style={{ marginTop: 10 }}>
              <pre style={{ whiteSpace: "pre-wrap" }}>{battleQuestion.raw}</pre>
              {["A", "B", "C", "D"].map((opt) => (
                <button key={opt} onClick={() => answerBattle(opt)} style={{ marginRight: 6 }}>
                  {opt}
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <h4>অডিও পডকাস্ট রিভিশন</h4>
            <input placeholder="অধ্যায়ের নাম দিন" value={podcastTopic} onChange={(e) => setPodcastTopic(e.target.value)} />
            <button onClick={createAudioPodcast}>🎧 পডকাস্ট চালান</button>
            {podcastScript && <pre style={{ whiteSpace: "pre-wrap", background: "#1e293b", padding: 10 }}>{podcastScript}</pre>}
          </div>
        </div>
      )}
// Part 10C/10: Tools, Classroom & My ID Tabs + Closing Tags
      {activeTab === "tools" && (
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <h4>Mind-Map, Mnemonics, Suggestion, Assignment & Story Mode</h4>
            <input placeholder="অধ্যায় বা টপিকের নাম লিখুন" value={creativeTopic} onChange={(e) => setCreativeTopic(e.target.value)} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              <button onClick={() => runCreativeTool("mindmap")}>Mind-Map</button>
              <button onClick={() => runCreativeTool("mnemonics")}>Mnemonics</button>
              <button onClick={() => runCreativeTool("suggestion")}>Exam Suggestion</button>
              <button onClick={() => runCreativeTool("assignment")}>Assignment Guide</button>
              <button onClick={() => runCreativeTool("story")}>Story Mode</button>
            </div>
            {creativeResult && <pre style={{ whiteSpace: "pre-wrap", background: "#1e293b", padding: 10 }}>{creativeResult}</pre>}
          </div>

          <div>
            <h4>Syllabus Progress & Spaced Revision</h4>
            <input placeholder="নতুন অধ্যায় যোগ করুন" value={newChapter} onChange={(e) => setNewChapter(e.target.value)} />
            <button
              onClick={() => {
                if (!newChapter.trim()) return;
                setChapters([...chapters, { id: Date.now(), title: newChapter, done: false }]);
                setNewChapter("");
              }}
            >
              যোগ করুন
            </button>
            {chapters.map((c) => (
              <div key={c.id}>
                <input
                  type="checkbox"
                  checked={c.done}
                  onChange={() => setChapters(chapters.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)))}
                />
                <span>{c.title}</span>
              </div>
            ))}

            <div style={{ marginTop: 10 }}>
              <input placeholder="রিভিশন টপিক" value={revTopic} onChange={(e) => setRevTopic(e.target.value)} />
              <button
                onClick={() => {
                  if (!revTopic.trim()) return;
                  setRevisionQueue([...revisionQueue, { id: Date.now(), topic: revTopic, days: "৩ দিন ও ৭ দিন পর" }]);
                  setRevTopic("");
                }}
              >
                রিমাইন্ডার সেট করুন
              </button>
              {revisionQueue.map((r) => (
                <div key={r.id}>
                  ⏰ {r.topic} ({r.days})
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4>Scientific Calculator & Formula Sheet</h4>
            <p>সূত্র: $(a+b)^2 = a^2 + 2ab + b^2$ | $v = u + at$ | $E = mc^2$</p>
            <input placeholder="যেমন: sin(0.5) + sqrt(16)" value={calcExpr} onChange={(e) => setCalcExpr(e.target.value)} />
            <button onClick={evalScientific}>=</button>
            <strong> ফলাফল: {calcAns}</strong>
          </div>

          <div>
            <h4>স্মার্ট হোয়াইটবোর্ড</h4>
            <canvas
              ref={canvasRef}
              width={320}
              height={180}
              onMouseDown={startDraw}
              onMouseMove={drawMove}
              onMouseUp={endDraw}
              onTouchStart={startDraw}
              onTouchMove={drawMove}
              onTouchEnd={endDraw}
              style={{ border: "1px solid #475569", background: "#020617", borderRadius: 8 }}
            />
            <div>
              <button onClick={() => canvasRef.current?.getContext("2d").clearRect(0, 0, 320, 180)}>Clear Board</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "classroom" && (
        <div style={{ display: "grid", gap: 14 }}>
          <div>
            <h4>Peer-to-Peer Help & Anonymous Doubt Box</h4>
            <label>
              <input type="checkbox" checked={anonymousMode} onChange={(e) => setAnonymousMode(e.target.checked)} /> নাম গোপন রাখুন
            </label>
            <div>
              <input placeholder="প্রশ্ন বা ডাউট লিখুন..." value={doubtText} onChange={(e) => setDoubtText(e.target.value)} />
              <button onClick={postDoubt}>পোস্ট করুন</button>
            </div>
            {doubts.map((d) => (
              <div key={d.id} style={{ background: "#1e293b", padding: 8, marginTop: 6, borderRadius: 6 }}>
                <div>
                  <strong>{d.author}:</strong> {d.text}
                </div>
                {d.answer ? (
                  <div>✅ উত্তর: {d.answer}</div>
                ) : (
                  <button onClick={() => answerDoubt(d.id, "সঠিক নিয়ম অনুযায়ী ধাপগুলো অনুসরণ করুন।")}>সাহায্য করুন (+20 XP)</button>
                )}
              </div>
            ))}
          </div>

          <div>
            <h4>Live Poll, Seen List & Random Student Picker</h4>
            <p>{pollQuestion}</p>
            <button onClick={() => setPollVotes({ ...pollVotes, optA: pollVotes.optA + 1 })}>Option A ({pollVotes.optA})</button>
            <button onClick={() => setPollVotes({ ...pollVotes, optB: pollVotes.optB + 1 })}>Option B ({pollVotes.optB})</button>
            <p>
              নোটিশ: {noticeText} | Seen: {seenStudents.join(", ")}
            </p>
            <button onClick={pickRandomStudent}>🎲 Random Student Picker</button>
            {pickedStudent && (
              <span>
                {" "}
                নির্বাচিত: <strong>{pickedStudent}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {activeTab === "my-id" && (
        <div>
          <h3>My ID & অভিভাবক WhatsApp রিপোর্ট</h3>
          <p>
            নাম: {user?.displayName || "Student"} | Role: {role} | মোট XP: {xp}
          </p>
          <input
            placeholder="অভিভাবকের WhatsApp নম্বর (যেমন 8801XXXXXXXXX)"
            value={guardianPhone}
            onChange={(e) => {
              setGuardianPhone(e.target.value);
              localStorage.setItem("edunexus_guardian_phone", e.target.value);
            }}
          />
          <button onClick={sendResultToWhatsApp} style={{ marginLeft: 8 }}>
            📲 WhatsApp-এ রেজাল্ট পাঠান
          </button>
          <div style={{ marginTop: 14 }}>
            <h4>Saved Answers Vault ({savedVault.length})</h4>
            {savedVault.map((item) => (
              <div key={item.id} style={{ background: "#1e293b", padding: 8, marginTop: 6 }}>
                <strong>{item.title || "Saved Item"}</strong>
                <pre style={{ whiteSpace: "pre-wrap" }}>{item.content}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

  const endDraw = () => {
    drawingRef.current = false;
  };
