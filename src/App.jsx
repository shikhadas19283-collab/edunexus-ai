import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  collection,
  serverTimestamp
} from 'firebase/firestore';
import {
  BookOpen,
  MessageSquare,
  Award,
  Brain,
  Mic,
  Clock,
  Users,
  Sun,
  Moon,
  Globe,
  Sparkles,
  CheckCircle2,
  XCircle,
  Trash2,
  Copy,
  Download,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Search,
  Folder,
  Camera,
  FileText,
  Volume2,
  VolumeX,
  Zap,
  Flame,
  Trophy,
  Send,
  ChevronRight,
  ChevronLeft,
  Eraser,
  PenTool,
  Share2,
  LogIn,
  LogOut,
  Layers,
  Calendar,
  AlertCircle,
  Check,
  Printer,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  Home,
  GraduationCap,
  NotebookPen,
  Network,
  Bell,
  BellRing,
  AtSign,
  Smile,
  ShieldCheck,
  Radio,
  UserCheck
} from 'lucide-react';

// ============================================================================
// 1. FIREBASE INITIALIZATION (MANDATORY GLOBAL CONFIG & AUTH PATTERN)
// ============================================================================
const firebaseConfig = typeof __firebase_config !== 'undefined'
  ? JSON.parse(__firebase_config)
  : {
      apiKey: "demo-key",
      authDomain: "demo.firebaseapp.com",
      projectId: "demo-project",
      storageBucket: "demo.appspot.com",
      messagingSenderId: "000000",
      appId: "1:000000:web:000000"
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'edunexus-ai-ultimate';

// ============================================================================
// 2. GEMINI API HELPER WITH EXPONENTIAL BACKOFF
// ============================================================================
const GEMINI_MODEL = 'gemini-3-flash-preview';

async function callGeminiAPI({
  prompt,
  systemInstruction = '',
  inlineImage = null, // { mimeType, data }
  responseSchema = null,
  maxRetries = 3
}) {
  const apiKey = ""; // Runtime environment injects API key automatically
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const parts = [];
  if (prompt) parts.push({ text: prompt });
  if (inlineImage && inlineImage.data) {
    parts.push({
      inlineData: {
        mimeType: inlineImage.mimeType || 'image/png',
        data: inlineImage.data
      }
    });
  }

  const payload = {
    contents: [{ role: 'user', parts }]
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  if (responseSchema) {
    payload.generationConfig = {
      responseMimeType: 'application/json',
      responseSchema
    };
  }

  let delay = 1000;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`HTTP ${response.status}`);
        }
        const errBody = await response.text();
        throw new Error(`API Error ${response.status}: ${errBody}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) throw new Error('Empty response from Gemini');

      if (responseSchema) {
        return JSON.parse(text);
      }
      return text;
    } catch (err) {
      if (attempt === maxRetries) {
        throw err;
      }
      await new Promise((res) => setTimeout(res, delay));
      delay *= 2;
    }
  }
}

// ============================================================================
// 3. BILINGUAL TRANSLATIONS (ENGLISH & BENGALI / বাংলা)
// ============================================================================
const TRANSLATIONS = {
  en: {
    appName: 'EduNexus AI',
    tagline: 'Ultimate Study & Exam OS',
    navDashboard: 'Dashboard',
    navChat: 'AI Doubt Solver',
    navExam: 'Exam & Vault',
    navGrader: 'Homework & Docs',
    navMindMap: 'Mind Maps',
    navVoice: 'Voice & Audio',
    navProductivity: 'Study Tools',
    navRooms: 'Study Rooms',
    navGlobalChat: 'Global Chat',
    xpPoints: 'XP',
    dayStreak: 'Day Streak',
    signInGoogle: 'Sign in with Google',
    guestMode: 'Cloud Guest Sync',
    signedInAs: 'Google Verified',
    signOut: 'Sign Out',
    welcomeBack: 'Ready to level up your learning today?',
    quickStart: 'Quick Launch Modules',
    leaderboardTitle: 'Global Student Leaderboard',
    yourRank: 'Your Progress',
    newChat: 'New Chat Session',
    searchChats: 'Search chats or folders...',
    personaLabel: 'AI Mentor Persona',
    askPlaceholder: 'Ask any doubt, paste code, or request math step-by-step...',
    saveToNotes: 'Save Note',
    exportPdf: 'Print / PDF',
    examSetup: 'Configure Mock Exam',
    mistakeVault: 'Mistake Notebook (Revision Vault)',
    startExam: 'Start Live Exam',
    retestMistakes: 'Re-Test Weak Topics',
    homeworkGrader: 'AI Photo Homework Grader',
    chapterAnalyzer: 'Chapter & Text Analyzer',
    generateMindMap: 'Generate Visual Mind Map',
    voiceTutor: 'Two-Way AI Voice Tutor & English Coach',
    audioReader: 'Podcast Audio Note Reader',
    flashcards: 'Smart Flashcards',
    routinePlanner: 'AI Exam Routine Planner',
    pomodoro: 'Pomodoro & Focus Audio',
    scratchpad: 'Math Scratchpad',
    createRoom: 'Create Study Room',
    joinRoom: 'Join with 6-Char Code',
    quizBattle: 'Live Group Quiz Battle',
    globalChatTitle: 'Global Student Community Chat',
    globalChatSubtitle: 'Chat live with all signed-in students • Type @AI to ask the AI Tutor in group!',
    onlineStudents: 'Online Students',
    notificationsTitle: 'Notifications',
    markAllRead: 'Mark all as read',
    enablePush: 'Browser Push Alerts',
    loginGateTitle: 'Welcome to EduNexus AI',
    loginGateSubtitle: 'Sign in with your Google Account to sync notes, join live global student chat, and compete on the leaderboard.',
    continueGuestFallback: 'Continue as Guest (Preview Fallback)',
    languageInstruction: 'Respond clearly in English.'
  },
  bn: {
    appName: 'এডুনেক্সাস এআই',
    tagline: 'স্মার্ট স্টাডি ও এক্সাম প্ল্যাটফর্ম',
    navDashboard: 'ড্যাশবোর্ড',
    navChat: 'এআই ডাউট সলভার',
    navExam: 'পরীক্ষা ও ভুল খাতা',
    navGrader: 'হোমওয়ার্ক ও নোটস',
    navMindMap: 'মাইন্ড ম্যাপ',
    navVoice: 'ভয়েস ও অডিও',
    navProductivity: 'স্টাডি টুলস',
    navRooms: 'গ্রুপ স্টাডি রুম',
    navGlobalChat: 'সকলে একসাথে চ্যাট',
    xpPoints: 'এক্সপি',
    dayStreak: 'দিনের স্ট্রিক',
    signInGoogle: 'গুগল অ্যাকাউন্ট দিয়ে লগইন করুন',
    guestMode: 'ক্লাউড গেস্ট সিঙ্ক',
    signedInAs: 'গুগল ভেরিফাইড',
    signOut: 'লগ আউট',
    welcomeBack: 'আজকের পড়াশোনা শুরু করার জন্য প্রস্তুত?',
    quickStart: 'দ্রুত শুরু করুন',
    leaderboardTitle: 'গ্লোবাল স্টুডেন্ট লিডারবোর্ড',
    yourRank: 'আপনার অগ্রগতি',
    newChat: 'নতুন চ্যাট সেশন',
    searchChats: 'চ্যাট বা ফোল্ডার খুঁজুন...',
    personaLabel: 'এআই শিক্ষকের ধরন',
    askPlaceholder: 'যেকোনো প্রশ্ন করুন, গণিত বা বিজ্ঞানের সমাধান চান...',
    saveToNotes: 'নোট সেভ করুন',
    exportPdf: 'প্রিন্ট / পিডিএফ',
    examSetup: 'মক টেস্ট তৈরি করুন',
    mistakeVault: 'ভুল খাতা (রিভিশন ভল্ট)',
    startExam: 'লাইভ পরীক্ষা শুরু করুন',
    retestMistakes: 'ভুল প্রশ্নগুলো আবার পরীক্ষা দিন',
    homeworkGrader: 'এআই ফটো হোমওয়ার্ক পরীক্ষক',
    chapterAnalyzer: 'অধ্যায় ও নোট বিশ্লেষক',
    generateMindMap: 'ভিজ্যুয়াল মাইন্ড ম্যাপ তৈরি করুন',
    voiceTutor: 'এআই ভয়েস টিউটর ও ইংরেজি অনুশীলন',
    audioReader: 'অডিও নোট রিডার',
    flashcards: 'স্মার্ট ফ্ল্যাশকার্ডস',
    routinePlanner: 'এআই পরীক্ষার রুটিন প্ল্যানার',
    pomodoro: 'পোমোডোরো ও ফোকাস সাউন্ড',
    scratchpad: 'রাফ খাতা / হোয়াইটবোর্ড',
    createRoom: 'নতুন স্টাডি রুম তৈরি করুন',
    joinRoom: '৬-অক্ষরের কোড দিয়ে যোগ দিন',
    quizBattle: 'লাইভ গ্রুপ কুইজ ব্যাটেল',
    globalChatTitle: 'গ্লোবাল স্টুডেন্ট কমিউনিটি চ্যাট',
    globalChatSubtitle: 'সবাই একসাথে লাইভ চ্যাট করুন • গ্রুপে @AI লিখে প্রশ্ন করলে এআই উত্তর দেবে!',
    onlineStudents: 'অনলাইন শিক্ষার্থী',
    notificationsTitle: 'নোটিফিকেশন সেন্টার',
    markAllRead: 'সব পড়া হয়েছে হিসেবে চিহ্নিত করুন',
    enablePush: 'ব্রাউজার পুশ নোটিফিকেশন',
    loginGateTitle: 'এডুনেক্সাস এআই-তে স্বাগতম',
    loginGateSubtitle: 'আপনার গুগল অ্যাকাউন্ট দিয়ে লগইন করে নোট সিঙ্ক করুন, সবার সাথে লাইভ চ্যাট করুন এবং লিডারবোর্ডে অংশ নিন।',
    continueGuestFallback: 'গেস্ট হিসেবে প্রবেশ করুন (প্রিভিউ মোড)',
    languageInstruction: 'Always respond in clear, natural Bengali (বাংলা) script, keeping technical/math formulas accurate.'
  }
};

const PERSONAS = [
  {
    id: 'friendly',
    nameEn: 'Friendly Tutor',
    nameBn: 'বন্ধুসুলভ শিক্ষক',
    desc: 'Encouraging, warm, uses everyday analogies.',
    system: 'You are a warm, encouraging, patient tutor who celebrates student curiosity and explains concepts clearly with helpful analogies.'
  },
  {
    id: 'examiner',
    nameEn: 'Strict Examiner',
    nameBn: 'কঠোর পরীক্ষক',
    desc: 'Exam-focused, concise, highlights marking schemes.',
    system: 'You are a strict board/competitive exam evaluator. Give crisp, high-scoring model answers, highlight common exam traps, and show exact marking rubrics.'
  },
  {
    id: 'eli5',
    nameEn: 'Simple Explainer (ELI5)',
    nameBn: 'সহজ ব্যাখ্যাকারী (ELI5)',
    desc: 'Zero jargon, ultra-simple intuition first.',
    system: 'Explain like I am 12 years old. Avoid heavy jargon, use vivid real-world stories, and build intuition from scratch.'
  },
  {
    id: 'stem',
    nameEn: 'Math & Science Step-by-Step',
    nameBn: 'গণিত ও বিজ্ঞান মেন্টর',
    desc: 'Rigorous step-by-step derivations & formulas.',
    system: 'You are an expert STEM mentor. Always break problems into numbered logical steps: Given, Formula Used, Step-by-Step Substitution, and Final Answer.'
  }
];

// ============================================================================
// 4. RICH MARKDOWN / CODE / MATH FORMATTER COMPONENT
// ============================================================================
function FormattedMessage({ content, onSaveNote, onCopy }) {
  const [copiedIdx, setCopiedIdx] = useState(null);

  const handleCopyCode = (code, idx) => {
    navigator.clipboard.writeText(code);
    setCopiedIdx(idx);
    if (onCopy) onCopy();
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  // Split by fenced code blocks ```lang ... ```
  const blocks = useMemo(() => {
    if (!content) return [];
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    const result = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: 'text', value: content.slice(lastIndex, match.index) });
      }
      result.push({ type: 'code', lang: match[1] || 'code', value: match[2].trim() });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < content.length) {
      result.push({ type: 'text', value: content.slice(lastIndex) });
    }
    return result;
  }, [content]);

  const renderInlineFormatting = (text) => {
    // Format bold **text**, inline code `code`, and math $...$
    const parts = text.split(/(\*\*.*?\*\*|`[^`]+`|\$[^$]+\$)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-indigo-600 dark:text-indigo-400">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-200 dark:bg-slate-800 text-pink-600 dark:text-pink-400 font-mono text-xs">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('$') && part.endsWith('$')) {
        return (
          <span key={i} className="px-2 py-0.5 mx-0.5 rounded bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 font-mono text-amber-800 dark:text-amber-300 text-sm">
            {part.slice(1, -1)}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-3 text-sm sm:text-base leading-relaxed">
      {blocks.map((block, idx) => {
        if (block.type === 'code') {
          return (
            <div key={idx} className="rounded-xl overflow-hidden border border-slate-700 bg-slate-900 text-slate-100 shadow-sm my-2">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 text-xs text-slate-300 border-b border-slate-700">
                <span className="font-mono uppercase tracking-wider">{block.lang}</span>
                <button
                  onClick={() => handleCopyCode(block.value, idx)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-700 transition"
                >
                  {copiedIdx === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedIdx === idx ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3.5 overflow-x-auto font-mono text-xs sm:text-sm leading-relaxed">
                <code>{block.value}</code>
              </pre>
            </div>
          );
        }

        // Render paragraphs & bullet lists
        const lines = block.value.split('\n');
        return (
          <div key={idx} className="space-y-1.5">
            {lines.map((line, lIdx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={lIdx} className="h-1" />;
              if (trimmed.startsWith('### ')) {
                return <h4 key={lIdx} className="text-base font-bold text-slate-900 dark:text-white mt-2">{renderInlineFormatting(trimmed.slice(4))}</h4>;
              }
              if (trimmed.startsWith('## ')) {
                return <h3 key={lIdx} className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-3">{renderInlineFormatting(trimmed.slice(3))}</h3>;
              }
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-2">
                    <span className="text-indigo-500 mt-1.5 text-xs">●</span>
                    <span className="flex-1">{renderInlineFormatting(trimmed.slice(2))}</span>
                  </div>
                );
              }
              if (/^\d+\.\s/.test(trimmed)) {
                const numMatch = trimmed.match(/^(\d+\.)\s(.*)$/);
                return (
                  <div key={lIdx} className="flex items-start gap-2 pl-2">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 min-w-[1.25rem]">{numMatch[1]}</span>
                    <span className="flex-1">{renderInlineFormatting(numMatch[2])}</span>
                  </div>
                );
              }
              return <p key={lIdx}>{renderInlineFormatting(line)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// 5. MAIN APPLICATION COMPONENT
// ============================================================================
export default function App() {
  // Theme, Language, Navigation & Toast Notification
  const [darkMode, setDarkMode] = useState(false);
  const [lang, setLang] = useState('bn');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toast, setToast] = useState(null);

  // Auth, Login Gate & User Profile State
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [gateDismissed, setGateDismissed] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [userStats, setUserStats] = useState({
    displayName: 'Scholar Student',
    email: '',
    photoURL: '',
    xp: 150,
    streak: 1,
    lastStudyDate: new Date().toISOString().slice(0, 10),
    examsTaken: 0,
    notesSaved: 0
  });
  const [leaderboard, setLeaderboard] = useState([]);
  const [communityProfiles, setCommunityProfiles] = useState([]);

  // Notification Center State
  const [notifications, setNotifications] = useState([
    {
      id: 'welcome-notif',
      title: 'Welcome to EduNexus AI!',
      body: 'Join the Global Student Chat (সকলে একসাথে চ্যাট) to study together with peers.',
      targetTab: 'globalchat',
      read: false,
      createdAt: Date.now()
    }
  ]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifSoundEnabled, setNotifSoundEnabled] = useState(true);
  const [pushPermission, setPushPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const lastSeenGlobalMsgIdRef = useRef(null);
  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Cloud-Synced Collections State
  const [chatSessions, setChatSessions] = useState([]);
  const [savedNotes, setSavedNotes] = useState([]);
  const [mistakes, setMistakes] = useState([]);
  const [flashcards, setFlashcards] = useState([]);

  const t = TRANSLATIONS[lang];

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Subtle Notification Chime using Web Audio API
  const playNotificationChime = useCallback(() => {
    if (!notifSoundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.14); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.26);
    } catch (e) {
      // Ignore audio autoplay restriction
    }
  }, [notifSoundEnabled]);

  // Push a real-time notification to Notification Center + Optional Browser Notification
  const pushNotification = useCallback(({ title, body, targetTab = 'dashboard', silent = false }) => {
    const newItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      body,
      targetTab,
      read: false,
      createdAt: Date.now()
    };
    setNotifications((prev) => [newItem, ...prev.slice(0, 29)]);
    if (!silent) {
      playNotificationChime();
      notify(`${title}: ${body}`, 'info');
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
      try {
        new Notification(title, { body });
      } catch (e) {
        // Ignore browser notification error
      }
    }
  }, [notify, playNotificationChime]);

  const handleRequestBrowserPush = async () => {
    if (typeof Notification === 'undefined') {
      notify('Browser notifications are not supported on this device.', 'error');
      return;
    }
    const perm = await Notification.requestPermission();
    setPushPermission(perm);
    if (perm === 'granted') {
      notify(lang === 'bn' ? 'ব্রাউজার পুশ নোটিফিকেশন চালু হয়েছে!' : 'Browser push notifications enabled!');
    }
  };

  const unreadNotifCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // --------------------------------------------------------------------------
  // Firebase Authentication & Profile Initialization
  // --------------------------------------------------------------------------
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('Auth error:', err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (currentUser) {
        if (!currentUser.isAnonymous) {
          setGateDismissed(true);
        }
        const profileRef = doc(db, 'artifacts', appId, 'users', currentUser.uid, 'profile', 'stats');
        const publicLeaderRef = doc(db, 'artifacts', appId, 'public', 'data', 'leaderboard', currentUser.uid);
        try {
          const snap = await getDoc(profileRef);
          const today = new Date().toISOString().slice(0, 10);
          if (snap.exists()) {
            const data = snap.data();
            let updatedStreak = data.streak || 1;
            if (data.lastStudyDate !== today) {
              const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
              updatedStreak = data.lastStudyDate === yesterday ? updatedStreak + 1 : 1;
            }
            const merged = {
              ...data,
              displayName: currentUser.displayName || data.displayName || 'Scholar Student',
              email: currentUser.email || data.email || '',
              photoURL: currentUser.photoURL || data.photoURL || '',
              isGoogleUser: !currentUser.isAnonymous,
              streak: updatedStreak,
              lastStudyDate: today
            };
            setUserStats(merged);
            await setDoc(profileRef, merged, { merge: true });
            await setDoc(publicLeaderRef, {
              uid: currentUser.uid,
              displayName: merged.displayName,
              email: merged.email,
              photoURL: merged.photoURL,
              isGoogleUser: !currentUser.isAnonymous,
              xp: merged.xp || 150,
              streak: updatedStreak,
              lastActive: Date.now()
            }, { merge: true });
          } else {
            const initial = {
              displayName: currentUser.displayName || `Student_${currentUser.uid.slice(0, 5)}`,
              email: currentUser.email || '',
              photoURL: currentUser.photoURL || '',
              isGoogleUser: !currentUser.isAnonymous,
              xp: 150,
              streak: 1,
              lastStudyDate: today,
              examsTaken: 0,
              notesSaved: 0
            };
            setUserStats(initial);
            await setDoc(profileRef, initial);
            await setDoc(publicLeaderRef, {
              uid: currentUser.uid,
              displayName: initial.displayName,
              email: initial.email,
              photoURL: initial.photoURL,
              isGoogleUser: !currentUser.isAnonymous,
              xp: 150,
              streak: 1,
              lastActive: Date.now()
            });
          }
        } catch (e) {
          console.error('Profile sync error:', e);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Award XP Helper
  const addXP = useCallback(async (amount, reason = '') => {
    if (!user) return;
    setUserStats((prev) => {
      const nextXP = (prev.xp || 0) + amount;
      const updated = { ...prev, xp: nextXP };
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'stats');
      const publicLeaderRef = doc(db, 'artifacts', appId, 'public', 'data', 'leaderboard', user.uid);
      setDoc(profileRef, updated, { merge: true }).catch(() => {});
      setDoc(publicLeaderRef, {
        uid: user.uid,
        displayName: updated.displayName,
        email: updated.email || '',
        photoURL: updated.photoURL || '',
        isGoogleUser: !user.isAnonymous,
        xp: nextXP,
        streak: updated.streak || 1,
        lastActive: Date.now()
      }, { merge: true }).catch(() => {});
      return updated;
    });
    if (reason) {
      notify(`+${amount} XP • ${reason}`);
    }
  }, [user, notify]);

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      setGateDismissed(true);
      notify(
        lang === 'bn'
          ? `স্বাগতম, ${result.user.displayName || 'শিক্ষার্থী'}! গুগল অ্যাকাউন্ট যুক্ত হয়েছে।`
          : `Welcome, ${result.user.displayName || 'Student'}! Signed in with Google.`
      );
    } catch (err) {
      notify(
        lang === 'bn'
          ? 'এই ব্রাউজার ফ্রেমে গুগল পপ-আপ ব্লক করা আছে। নিচের গেস্ট মোড ব্যবহার করতে পারেন।'
          : 'Google popup blocked in sandboxed preview frame. You can use Guest Fallback below.',
        'error'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await signOut(auth);
      setGateDismissed(false);
      await signInAnonymously(auth);
      notify(lang === 'bn' ? 'সফলভাবে লগ আউট হয়েছে' : 'Signed out successfully');
    } catch (err) {
      notify('Sign out error', 'error');
    }
  };

  // --------------------------------------------------------------------------
  // Real-time Firestore Subscriptions
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;

    const chatsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'chats');
    const unsubChats = onSnapshot(chatsRef, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      setChatSessions(list);
    }, (err) => console.error('Chats listener:', err));

    const notesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'notes');
    const unsubNotes = onSnapshot(notesRef, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setSavedNotes(list);
    }, (err) => console.error('Notes listener:', err));

    const mistakesRef = collection(db, 'artifacts', appId, 'users', user.uid, 'mistakes');
    const unsubMistakes = onSnapshot(mistakesRef, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setMistakes(list);
    }, (err) => console.error('Mistakes listener:', err));

    const cardsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'flashcards');
    const unsubCards = onSnapshot(cardsRef, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setFlashcards(list);
    }, (err) => console.error('Flashcards listener:', err));

    const leaderRef = collection(db, 'artifacts', appId, 'public', 'data', 'leaderboard');
    const unsubLeader = onSnapshot(leaderRef, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCommunityProfiles(list);
      const sorted = [...list].sort((a, b) => (b.xp || 0) - (a.xp || 0));
      setLeaderboard(sorted.slice(0, 10));
    }, (err) => console.error('Leaderboard listener:', err));

    const globalChatRef = collection(db, 'artifacts', appId, 'public', 'data', 'global_chat');
    const unsubGlobalChat = onSnapshot(globalChatRef, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      msgs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      const latest = msgs[msgs.length - 1];
      if (latest) {
        if (lastSeenGlobalMsgIdRef.current && latest.id !== lastSeenGlobalMsgIdRef.current) {
          const isFromOther = latest.uid !== user.uid;
          const myName = (user.displayName || '').toLowerCase();
          const isMentioned = myName && (latest.text || '').toLowerCase().includes(`@${myName.split(' ')[0]}`);
          if (isFromOther && (activeTabRef.current !== 'globalchat' || isMentioned)) {
            pushNotification({
              title: isMentioned
                ? `${latest.senderName} mentioned you in Global Chat`
                : `New message from ${latest.senderName}`,
              body: (latest.text || '').slice(0, 90),
              targetTab: 'globalchat'
            });
          }
        }
        lastSeenGlobalMsgIdRef.current = latest.id;
      }
    }, (err) => console.error('Global chat notif listener:', err));

    return () => {
      unsubChats();
      unsubNotes();
      unsubMistakes();
      unsubCards();
      unsubLeader();
      unsubGlobalChat();
    };
  }, [user, pushNotification]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleSaveNote = async (title, content, category = 'General') => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'notes'), {
        title,
        content,
        category,
        createdAt: Date.now()
      });
      addXP(15, 'Note Saved');
    } catch (err) {
      notify('Failed to save note', 'error');
    }
  };
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || isGenerating) return;
    const promptText = chatInput.trim();
    setChatInput('');
    const newMsgs = [...messages, { role: 'user', text: promptText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }];
    setMessages(newMsgs);
    setIsGenerating(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
      const personaPrompt = selectedPersona === 'Socratic Mentor'
        ? 'You are a Socratic Mentor. Guide the student with thought-provoking questions rather than giving direct answers immediately.'
        : selectedPersona === 'Strict Examiner'
        ? 'You are a Strict Examiner. Be concise, rigorous, point out flaws, and test deep understanding.'
        : 'You are EduNexus AI, a friendly, clear, and encouraging personal study tutor.';

      if (!apiKey) {
        await new Promise((r) => setTimeout(r, 800));
        setMessages((prev) => [
          ...prev,
          {
            role: 'ai',
            text: `(${selectedPersona}) Demo Mode: Add VITE_GEMINI_API_KEY in Vercel Environment Variables to activate live Gemini AI responses.\n\nRegarding "${promptText}": Break this concept into core definitions, key formulas, and one practical example to master it!`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${personaPrompt}\n\nStudent Question: ${promptText}` }] }]
          })
        });
        const data = await res.json();
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not generate a response. Please check your API key.';
        setMessages((prev) => [
          ...prev,
          { role: 'ai', text: reply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
        ]);
      }
      addXP(10, 'AI Tutor Session');
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: 'Network error while contacting Gemini AI. Please try again.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!examTopic.trim() || isGeneratingExam) return;
    setIsGeneratingExam(true);
    setExamSubmitted(false);
    setExamAnswers({});
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
      if (!apiKey) {
        await new Promise((r) => setTimeout(r, 700));
        setExamQuestions([
          {
            q: `What is the fundamental principle behind ${examTopic}?`,
            options: ['Conservation & Equilibrium', 'Random Dispersion', 'Linear Decay', 'Static Isolation'],
            answer: 0
          },
          {
            q: `Which approach best solves complex problems in ${examTopic}?`,
            options: ['Guesswork', 'Step-by-step analytical breakdown', 'Skipping edge cases', 'Memorizing without context'],
            answer: 1
          },
          {
            q: `How should you verify your result in ${examTopic}?`,
            options: ['Check boundary conditions & units', 'Assume it is right', 'Ignore anomalies', 'Restart completely'],
            answer: 0
          }
        ]);
      } else {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Generate 3 multiple-choice questions on "${examTopic}" (Difficulty: ${examDifficulty}). Return ONLY valid JSON array: [{"q":"question","options":["A","B","C","D"],"answer":0}] where answer is index 0-3.`
              }]
            }]
          })
        });
        const data = await res.json();
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        const cleaned = raw.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed) && parsed.length > 0) setExamQuestions(parsed);
      }
    } catch (e) {
      notify('Could not parse quiz. Try another topic.', 'error');
    } finally {
      setIsGeneratingExam(false);
    }
  };

  const handleSendGlobalChat = async (e) => {
    e?.preventDefault();
    if (!globalInput.trim() || !user) return;
    const text = globalInput.trim();
    setGlobalInput('');
    try {
      await addDoc(collection(db, 'global_chat'), {
        text,
        uid: user.uid,
        name: user.displayName || profile?.name || 'Scholar',
        createdAt: Date.now()
      });
      addXP(5, 'Community Chat');
    } catch (err) {
      notify('Unable to post message (check Firebase config)', 'error');
    }
  };
  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} transition-colors`}>
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-indigo-600/95 text-white px-4 py-3 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-amber-300" />
          <span className="font-bold text-lg tracking-tight">EduNexus AI</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full">
            ⚡ {profile?.xp || 0} XP
          </span>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20"
            title="Toggle Theme"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {user && !user.isAnonymous ? (
            <button onClick={() => signOut(auth)} className="text-xs bg-rose-500 hover:bg-rose-600 px-2.5 py-1 rounded-lg font-medium">
              Logout
            </button>
          ) : (
            <button
              onClick={() => signInWithPopup(auth, new GoogleAuthProvider()).catch(() => notify('Configure Firebase Auth first', 'error'))}
              className="text-xs bg-white text-indigo-700 font-semibold px-3 py-1 rounded-lg shadow"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-16 right-4 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg border border-indigo-500/40">
          {toast.msg}
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 pb-24">
        {activeTab === 'tutor' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="font-bold text-base flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-500" /> AI Study Tutor
              </h2>
              <select
                value={selectedPersona}
                onChange={(e) => setSelectedPersona(e.target.value)}
                className={`text-xs rounded-lg px-2.5 py-1.5 border ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
              >
                <option>Friendly Tutor</option>
                <option>Socratic Mentor</option>
                <option>Strict Examiner</option>
              </select>
            </div>

            <div className={`h-[55vh] overflow-y-auto rounded-2xl p-4 space-y-3 border ${darkMode ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`}>
              {messages.length === 0 && (
                <p className="text-sm text-slate-400 text-center mt-16">
                  Ask any question on Science, Math, History, or Coding to begin!
                </p>
              )}
              {messages.map((m, idx) => (
                <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : darkMode ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-800'
                  }`}>
                    {m.text}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1">{m.time}</span>
                </div>
              ))}
              {isGenerating && <p className="text-xs text-indigo-400 animate-pulse">AI Tutor is thinking...</p>}
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask a doubt or paste a problem..."
                className={`flex-1 rounded-xl px-3.5 py-2.5 text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
              />
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-1">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {activeTab === 'exam' && (
          <div className="space-y-4">
            <h2 className="font-bold text-base flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-500" /> AI Exam Simulator
            </h2>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                value={examTopic}
                onChange={(e) => setExamTopic(e.target.value)}
                placeholder="Enter topic (e.g., Quadratic Equations, Photosynthesis)"
                className={`flex-1 min-w-[200px] rounded-xl px-3.5 py-2 text-sm border ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
              />
              <select
                value={examDifficulty}
                onChange={(e) => setExamDifficulty(e.target.value)}
                className={`rounded-xl px-3 py-2 text-sm border ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
              >
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
              <button
                onClick={handleGenerateQuiz}
                disabled={isGeneratingExam}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium"
              >
                {isGeneratingExam ? 'Generating...' : 'Start Quiz'}
              </button>
            </div>

            {examQuestions.map((item, qIdx) => (
              <div key={qIdx} className={`p-4 rounded-2xl border space-y-2 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <p className="font-semibold text-sm">{qIdx + 1}. {item.q}</p>
                <div className="space-y-1.5">
                  {item.options.map((opt, oIdx) => {
                    const selected = examAnswers[qIdx] === oIdx;
                    const isCorrect = item.answer === oIdx;
                    let btnStyle = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200';
                    if (examSubmitted) {
                      if (isCorrect) btnStyle = 'bg-emerald-600 text-white border-emerald-600';
                      else if (selected) btnStyle = 'bg-rose-600 text-white border-rose-600';
                    } else if (selected) {
                      btnStyle = 'bg-indigo-600 text-white border-indigo-600';
                    }
                    return (
                      <button
                        key={oIdx}
                        onClick={() => !examSubmitted && setExamAnswers({ ...examAnswers, [qIdx]: oIdx })}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs border transition ${btnStyle}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {examQuestions.length > 0 && !examSubmitted && (
              <button
                onClick={() => {
                  setExamSubmitted(true);
                  addXP(25, 'Completed Mock Quiz');
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-semibold text-sm"
              >
                Submit Answers
              </button>
            )}
          </div>
        )}

        {activeTab === 'community' && (
          <div className="space-y-4">
            <h2 className="font-bold text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" /> Global Study Lounge
            </h2>
            <div className={`h-[52vh] overflow-y-auto rounded-2xl p-4 space-y-2.5 border ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              {globalMessages.length === 0 && (
                <p className="text-xs text-slate-400 text-center mt-16">No messages yet. Say hello to fellow learners!</p>
              )}
              {globalMessages.map((msg, i) => (
                <div key={msg.id || i} className={`p-2.5 rounded-xl text-xs ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <span className="font-bold text-indigo-400">{msg.name}: </span>
                  <span>{msg.text}</span>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendGlobalChat} className="flex gap-2">
              <input
                type="text"
                value={globalInput}
                onChange={(e) => setGlobalInput(e.target.value)}
                placeholder="Share a study tip or ask peers..."
                className={`flex-1 rounded-xl px-3.5 py-2 text-sm border ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
              />
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium">
                Post
              </button>
            </form>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="space-y-3">
            <h2 className="font-bold text-base flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" /> Top Scholars Leaderboard
            </h2>
            <div className={`rounded-2xl border divide-y ${darkMode ? 'bg-slate-900 border-slate-800 divide-slate-800' : 'bg-white border-slate-200 divide-slate-100'}`}>
              {(leaderboard.length > 0 ? leaderboard : [{ id: '1', name: profile?.name || 'You', xp: profile?.xp || 100 }]).map((entry, idx) => (
                <div key={entry.id || idx} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-indigo-500">#{idx + 1}</span>
                    <span>{entry.name || 'Scholar'}</span>
                  </div>
                  <span className="font-semibold text-amber-500">{entry.xp || 0} XP</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Mobile Navigation */}
      <nav className={`fixed bottom-0 inset-x-0 border-t px-2 py-2 flex justify-around z-30 ${darkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
        {[
          { id: 'tutor', label: 'AI Tutor', icon: Bot },
          { id: 'exam', label: 'Exam', icon: Brain },
          { id: 'community', label: 'Chat', icon: MessageSquare },
          { id: 'leaderboard', label: 'Rank', icon: Trophy }
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl text-xs font-medium ${
                active ? 'text-indigo-500' : 'text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default App;
