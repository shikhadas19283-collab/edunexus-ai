import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Send, Brain, Trophy, Sun, Moon, BookOpen,
  Layers, CheckCircle2, XCircle, Trash2, Zap, Award,
  HelpCircle, RefreshCw, Users, LogIn, LogOut,
  MessageSquare, Image as ImageIcon, Shield, UserCheck,
  Bell, BellRing, Video, ClipboardCheck, Edit3, Camera, Lock, Check,
  X, Mic, Volume2, Pin, BarChart2, Clock, Play, Pause, RotateCcw,
  FileCheck, AlertTriangle, Copy, Medal, Calendar, Reply, Plus,
  CheckSquare, FolderOpen, Target, ExternalLink, Calculator,
  Headphones, Swords, Shuffle, Eye, EyeOff, Bookmark, PenTool,
  GraduationCap, Scale, FileText, Languages
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  signOut, onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore, collection, addDoc, setDoc, updateDoc, deleteDoc,
  doc, query, onSnapshot, serverTimestamp, where, arrayUnion
} from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const HOST_EMAILS = [
  'shifasarker825@gmail.com',
  'shifasarker528@gmail.com'
];

const firebaseConfig = {
  apiKey: "AIzaSyAXpE49b0F_yVMvSojIOJIqo4dIumYe_cU",
  authDomain: "edunexus-ai-48076.firebaseapp.com",
  projectId: "edunexus-ai-48076",
  storageBucket: "edunexus-ai-48076.firebasestorage.app",
  messagingSenderId: "228682156285",
  appId: "1:228682156285:web:e98d179b8b08a88f2d9694",
  measurementId: "G-T9XZFBJD26"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const googleProvider = new GoogleAuthProvider();
let messaging = null;
try {
  messaging = getMessaging(firebaseApp);
} catch {}

const playNotificationTone = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch {}
};

const triggerDeviceNotification = async (title, body) => {
  playNotificationTone();
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: '/logo.png',
          badge: '/logo.png',
          vibrate: [200, 100, 200]
        });
        return;
      }
    }
    new Notification(title, { body, icon: '/logo.png' });
  } catch {}
};

const cleanAiOutput = (rawText) => {
  if (!rawText) return '';
  let text = rawText;
  const supMap = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', 'n': 'ⁿ'
  };
  text = text.replace(/\^([0-9+\-n]+)/g, (_, exp) =>
    exp.split('').map(ch => supMap[ch] || ch).join('')
  );
  text = text
    .replace(/\$\$/g, '')
    .replace(/\$/g, '')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)')
    .replace(/^#{1,6}\s*/gm, '▸ ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
  return text.trim();
};

const compressImageToBase64 = (file, maxWidth = 650, quality = 0.65) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const img = new Image();
        img.src = event.target.result;
        if (img.decode) {
          await img.decode();
        } else {
          await new Promise((res, rej) => {
            img.onload = res;
            img.onerror = rej;
          });
        }
        const canvas = document.createElement('canvas');
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

const callGeminiFast = async (prompt, systemInstruction = "", base64Image = null, isJson = false) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("API Key পাওয়া যায়নি। Vercel Environment Variables চেক করুন।");
  }

  const models = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
  const strictRules = isJson
    ? systemInstruction
    : `${systemInstruction} গুরুত্বপূর্ণ নিয়ম: কোনো উত্তরে Markdown (**, ###) বা LaTeX ($, $$) চিহ্ন ব্যবহার করবে না। গণিতের সূত্র সাধারণ টেক্সট ও ইউনিকোড চিহ্নে (যেমন: a² - b², ×, ÷, √) লিখবে। বাংলা শব্দের বানান শতভাগ শুদ্ধ রাখবে।`;

  const parts = [{ text: prompt }];
  const imageList = Array.isArray(base64Image)
    ? base64Image
    : base64Image
    ? [base64Image]
    : [];

  imageList.forEach((imgStr) => {
    if (imgStr && imgStr.includes(',')) {
      const cleanBase64 = imgStr.split(',')[1];
      const mimeType = imgStr.split(';')[0].split(':')[1] || 'image/jpeg';
      parts.push({ inlineData: { mimeType, data: cleanBase64 } });
    }
  });

  let lastError = "";
  for (const model of models) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ role: "user", parts }],
        systemInstruction: { parts: [{ text: strictRules }] }
      };
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await response.json();
      if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        const raw = data.candidates[0].content.parts[0].text;
        return isJson ? raw : cleanAiOutput(raw);
      }
      lastError = data?.error?.message || `Model ${model} unavailable`;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err.name === 'AbortError' ? 'সার্ভার রেসপন্স করতে দেরি করেছে' : err.message;
    }
  }
  throw new Error(`AI সংযোগ ব্যর্থ: ${lastError}`);
};
export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState('tutor');
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [unreadNoticeCount, setUnreadNoticeCount] = useState(0);
  const lastSeenNoticeTimeRef = useRef(Date.now());

  const [xp, setXp] = useState(() => Number(localStorage.getItem('edunexus_xp')) || 150);
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  // AI Tutor & Specialized AI Modes
  const [tutorMode, setTutorMode] = useState('Friendly Tutor');
  const defaultWelcomeMsg = [
    {
      id: 1,
      sender: 'ai',
      text: 'স্বাগতম! আমি EduNexus AI। এখন থেকে খাতার উত্তর মূল্যায়ন (Answer Sheet Evaluator), বইয়ের পাতার অনুবাদ/সারাংশ, Spoken English, Teach the AI এবং AI ডিবেট—সবই এখানে পাবে!',
      time: 'Now'
    }
  ];
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('edunexus_chat_history');
    return saved ? JSON.parse(saved) : defaultWelcomeMsg;
  });
  const [inputMsg, setInputMsg] = useState('');
  const [tutorImages, setTutorImages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const chatEndRef = useRef(null);

  // Saved Answers Vault
  const [savedAnswers, setSavedAnswers] = useState(() => {
    const saved = localStorage.getItem('edunexus_saved_answers');
    return saved ? JSON.parse(saved) : [];
  });

  // Classroom & Group States
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('global');
  const [groupSubTab, setGroupSubTab] = useState('chat');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSubject, setNewGroupSubject] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');

  const [groupMsgs, setGroupMsgs] = useState([]);
  const [commInput, setCommInput] = useState('');
  const [commImages, setCommImages] = useState([]);
  const [replyToMsg, setReplyToMsg] = useState(null);
  const [isAnonymousMsg, setIsAnonymousMsg] = useState(false); // Anonymous Doubt Box
  const [sendingComm, setSendingComm] = useState(false);
  const [pickedStudent, setPickedStudent] = useState(null); // Random Student Picker
  const commEndRef = useRef(null);

  const [notices, setNotices] = useState([]);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [polls, setPolls] = useState([]);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOpt1, setPollOpt1] = useState('');
  const [pollOpt2, setPollOpt2] = useState('');

  const [routines, setRoutines] = useState([]);
  const [routineForm, setRoutineForm] = useState({ day: 'শনিবার', time: '', subject: '', liveLink: '' });
  const [resources, setResources] = useState([]);
  const [resForm, setResForm] = useState({ title: '', subject: '', url: '' });
  const [homeworks, setHomeworks] = useState([]);
  const [hwTitle, setHwTitle] = useState('');
  const [hwDue, setHwDue] = useState('');
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attDate, setAttDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [attMap, setAttMap] = useState({});
  const [classExams, setClassExams] = useState([]);
  const [editingExamId, setEditingExamId] = useState(null);
  const [examForm, setExamForm] = useState({ title: '', date: '', syllabus: '', resultsText: '' });
  const [recordedClasses, setRecordedClasses] = useState([]);
  const [classForm, setClassForm] = useState({ title: '', videoUrl: '', notes: '' });

  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Quiz, 1v1 Battle & Anti-Cheating Exam Mode
  const [examTopic, setExamTopic] = useState('');
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [rivalScore, setRivalScore] = useState(0);
  const [battleMode, setBattleMode] = useState(false);
  const [antiCheatMode, setAntiCheatMode] = useState(false);
  const [cheatWarnings, setCheatWarnings] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  // Flashcards, Audio Podcast, Mind-Map, Mnemonics, Lecture-to-Notes, Suggestion, Assignment
  const [flashTopic, setFlashTopic] = useState('');
  const [flashcards, setFlashcards] = useState(() => {
    const saved = localStorage.getItem('edunexus_flashcards');
    return saved ? JSON.parse(saved) : [
      { front: 'নিউটনের দ্বিতীয় গতিসূত্র কী?', back: 'কোনো বস্তুর ভরবেগের পরিবর্তনের হার প্রযুক্ত বলের সমানুপাতিক (F = ma)।' },
      { front: 'সালোকসংশ্লেষের প্রধান উপাদান কী কী?', back: 'সূর্যালোক, ক্লোরোফিল, কার্বন ডাই-অক্সাইড (CO₂) এবং জল (H₂O)।' }
    ];
  });
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loadingFlash, setLoadingFlash] = useState(false);

  const [noteTopic, setNoteTopic] = useState('');
  const [noteType, setNoteType] = useState('short_note');
  const [generatedNote, setGeneratedNote] = useState('');
  const [loadingNote, setLoadingNote] = useState(false);

  // Scientific Calculator & Smart Whiteboard
  const [calcInput, setCalcInput] = useState('');
  const [calcResult, setCalcResult] = useState('0');
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);

  // Syllabus Progress & Spaced Revision Reminder
  const [syllabusItems, setSyllabusItems] = useState(() => {
    const saved = localStorage.getItem('edunexus_syllabus');
    return saved ? JSON.parse(saved) : [
      { id: 1, title: 'অধ্যায় ১: মৌলিক ধারণা ও সূত্রাবলি', done: true, nextRevision: '৩ দিন পর' },
      { id: 2, title: 'অধ্যায় ২: গাণিতিক সমস্যা ও সমাধান', done: false, nextRevision: 'আগামীকাল' }
    ];
  });
  const [syllabusInput, setSyllabusInput] = useState('');

  const [mistakes, setMistakes] = useState(() => {
    const saved = localStorage.getItem('edunexus_mistakes');
    return saved ? JSON.parse(saved) : [];
  });
  const [explainingMistakeId, setExplainingMistakeId] = useState(null);

  const [todos, setTodos] = useState(() => {
    const saved = localStorage.getItem('edunexus_todos');
    return saved ? JSON.parse(saved) : [{ id: 1, text: 'আজকের ক্লাস নোট রিভিশন করা', done: false }];
  });
  const [todoInput, setTodoInput] = useState('');

  const [targetExam, setTargetExam] = useState(() => {
    const saved = localStorage.getItem('edunexus_target_exam');
    return saved ? JSON.parse(saved) : { name: 'বোর্ড পরীক্ষা', date: '2027-11-27' };
  });
  const [studyPlan, setStudyPlan] = useState('');
  const [loadingPlan, setLoadingPlan] = useState(false);

  const isHost = user && HOST_EMAILS.includes(user.email?.toLowerCase());
  const currentRole = isHost ? 'host' : (userProfile?.role || 'student');
  const isTeacherOrHost = currentRole === 'host' || currentRole === 'teacher';

  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) {
      showToast("এই ব্রাউজারে নোটিফিকেশন সমর্থিত নয়।");
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      try {
        if (messaging && import.meta.env.VITE_FIREBASE_VAPID_KEY) {
          const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          const token = await getToken(messaging, {
            vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
            serviceWorkerRegistration: swReg
          });
          if (token && user) {
            await updateDoc(doc(db, 'users', user.uid), { fcmToken: token });
          }
        }
      } catch {}
      triggerDeviceNotification('EduNexus AI নোটিফিকেশন চালু!', 'এখন থেকে লক স্ক্রিন ও হোম স্ক্রিনে নতুন নোটিশ আসবে।');
      showToast("🔔 নোটিফিকেশন সফলভাবে চালু হয়েছে!");
    } else {
      showToast("নোটিফিকেশন চালু করতে ব্রাউজার সেটিংস থেকে Allow দিন।");
    }
  };

  useEffect(() => {
    if (!messaging) return;
    try {
      return onMessage(messaging, (payload) => {
        const title = payload.notification?.title || 'EduNexus AI নোটিশ';
        const body = payload.notification?.body || 'নতুন আপডেট এসেছে!';
        triggerDeviceNotification(title, body);
        showToast(`🔔 ${title}`);
      });
    } catch {}
  }, []);

  // Study Together (Pomodoro Timer)
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          setXp((x) => x + 50);
          triggerDeviceNotification('Study Together সম্পন্ন!', 'আপনি +50 Bonus XP অর্জন করেছেন!');
          return 25 * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  // Anti-Cheating Exam Mode Monitor
  useEffect(() => {
    if (!antiCheatMode || quizQuestions.length === 0 || quizFinished) return;
    const handleVisibility = () => {
      if (document.hidden) {
        setCheatWarnings((w) => {
          const next = w + 1;
          showToast(`⚠️ অ্যান্টি-চিটিং সতর্কতা #${next}: পরীক্ষা চলাকালীন ট্যাব পরিবর্তন নিষিদ্ধ!`);
          return next;
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [antiCheatMode, quizQuestions.length, quizFinished]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        const autoRole = HOST_EMAILS.includes(currentUser.email?.toLowerCase()) ? 'host' : 'student';
        onSnapshot(userRef, async (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (autoRole === 'host' && data.role !== 'host') {
              await updateDoc(userRef, { role: 'host' });
            }
            setUserProfile(data);
            setEditName(data.displayName || currentUser.displayName || '');
            setEditBio(data.bio || '');
            setEditPhoto(data.photoURL || currentUser.photoURL || '');
          } else {
            const newProfile = {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || 'Student',
              photoURL: currentUser.photoURL || '',
              bio: 'EduNexus AI শিক্ষার্থী',
              role: autoRole,
              xp: 150,
              teacherRequest: false,
              joinedGroups: ['global'],
              createdAt: serverTimestamp()
            };
            await setDoc(userRef, newProfile);
            setUserProfile(newProfile);
            setEditName(newProfile.displayName);
            setEditBio(newProfile.bio);
            setEditPhoto(newProfile.photoURL);
          }
          setAuthLoading(false);
        });
      } else {
        setUserProfile(null);
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [user]);

  useEffect(() => {
    return onSnapshot(collection(db, 'study_groups'), (snap) => {
      setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  useEffect(() => {
    const gid = selectedGroupId || 'global';
    const unsubChat = onSnapshot(query(collection(db, 'group_messages'), where('groupId', '==', gid)), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.clientTime || 0) - (b.clientTime || 0));
      setGroupMsgs(list);
    });
    const unsubNotices = onSnapshot(query(collection(db, 'group_notices'), where('groupId', '==', gid)), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.clientTime || 0) - (a.clientTime || 0));
      setNotices(list);
      if (list.length > 0 && list[0].clientTime > lastSeenNoticeTimeRef.current) {
        lastSeenNoticeTimeRef.current = list[0].clientTime;
        setUnreadNoticeCount((c) => c + 1);
        triggerDeviceNotification(`📢 ${list[0].title}`, list[0].body);
      }
    });
    const unsubPolls = onSnapshot(query(collection(db, 'group_polls'), where('groupId', '==', gid)), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.clientTime || 0) - (a.clientTime || 0));
      setPolls(list);
    });
    const unsubRoutines = onSnapshot(query(collection(db, 'group_routines'), where('groupId', '==', gid)), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.clientTime || 0) - (b.clientTime || 0));
      setRoutines(list);
    });
    const unsubResources = onSnapshot(query(collection(db, 'group_resources'), where('groupId', '==', gid)), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.clientTime || 0) - (a.clientTime || 0));
      setResources(list);
    });
    const unsubHw = onSnapshot(query(collection(db, 'group_homeworks'), where('groupId', '==', gid)), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.clientTime || 0) - (a.clientTime || 0));
      setHomeworks(list);
    });
    const unsubAtt = onSnapshot(query(collection(db, 'group_attendance'), where('groupId', '==', gid)), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => b.date.localeCompare(a.date));
      setAttendanceRecords(list);
    });
    const unsubExams = onSnapshot(query(collection(db, 'group_exams'), where('groupId', '==', gid)), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.clientTime || 0) - (a.clientTime || 0));
      setClassExams(list);
    });
    const unsubClasses = onSnapshot(query(collection(db, 'recorded_classes'), where('groupId', '==', gid)), (s) => {
      const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.clientTime || 0) - (a.clientTime || 0));
      setRecordedClasses(list);
    });
    return () => {
      unsubChat(); unsubNotices(); unsubPolls(); unsubRoutines(); unsubResources();
      unsubHw(); unsubAtt(); unsubExams(); unsubClasses();
    };
  }, [selectedGroupId]);
  useEffect(() => {
    localStorage.setItem('edunexus_xp', xp.toString());
    if (user) updateDoc(doc(db, 'users', user.uid), { xp }).catch(() => {});
  }, [xp, user]);

  useEffect(() => {
    localStorage.setItem('edunexus_chat_history', JSON.stringify(messages));
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => { commEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [groupMsgs]);
  useEffect(() => { localStorage.setItem('edunexus_flashcards', JSON.stringify(flashcards)); }, [flashcards]);
  useEffect(() => { localStorage.setItem('edunexus_mistakes', JSON.stringify(mistakes)); }, [mistakes]);
  useEffect(() => { localStorage.setItem('edunexus_todos', JSON.stringify(todos)); }, [todos]);
  useEffect(() => { localStorage.setItem('edunexus_target_exam', JSON.stringify(targetExam)); }, [targetExam]);
  useEffect(() => { localStorage.setItem('edunexus_saved_answers', JSON.stringify(savedAnswers)); }, [savedAnswers]);
  useEffect(() => { localStorage.setItem('edunexus_syllabus', JSON.stringify(syllabusItems)); }, [syllabusItems]);

  const addXp = (amount) => setXp((prev) => prev + amount);

  const handleSaveAnswer = (title, text) => {
    setSavedAnswers((prev) => [{ id: Date.now(), title, text, date: new Date().toLocaleDateString('bn-BD') }, ...prev]);
    addXp(10);
    showToast("⭐ Saved Answers-এ সংরক্ষণ হয়েছে!");
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      addXp(50);
      showToast("সফলভাবে লগইন হয়েছে! +50 XP");
    } catch (err) {
      showToast("Sign-In ত্রুটি: " + err.message);
    }
  };

  const handleLogout = async () => { await signOut(auth); showToast("সাইন আউট সম্পন্ন হয়েছে।"); };

  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { showToast("ভয়েস টাইপিংয়ের জন্য Chrome ব্যবহার করুন।"); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = tutorMode === 'Spoken English Partner' ? 'en-US' : 'bn-BD';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => {
      const spoken = event.results[0][0].transcript;
      setInputMsg((prev) => (prev ? `${prev} ${spoken}` : spoken));
    };
    recognition.start();
  };

  const handleSpeakText = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = tutorMode === 'Spoken English Partner' ? 'en-US' : 'bn-BD';
    window.speechSynthesis.speak(utterance);
  };

  const handleTutorImageUpload = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 4);
    if (files.length === 0) return;
    const compressedList = await Promise.all(files.map((f) => compressImageToBase64(f, 700, 0.65)));
    setTutorImages((prev) => [...prev, ...compressedList].slice(0, 4));
    e.target.value = '';
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if ((!inputMsg.trim() && tutorImages.length === 0) || isTyping) return;

    const userText = inputMsg.trim() || "এই ছবিটি বিশ্লেষণ করে সমাধান ও ব্যাখ্যা দাও।";
    const imagesToSend = [...tutorImages];
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const updatedMessages = [
      ...messages,
      { id: Date.now(), sender: 'user', text: userText, images: imagesToSend, time: now }
    ];
    setMessages(updatedMessages);
    setInputMsg('');
    setTutorImages([]);
    setIsTyping(true);

    const recentHistory = updatedMessages.slice(-4).map((m) => `${m.sender === 'user' ? 'Student' : 'Tutor'}: ${m.text}`).join('\n');
    const systemPrompts = {
      'Friendly Tutor': 'তুমি একজন বন্ধুত্বপূর্ণ শিক্ষক। সহজ ও শুদ্ধ বাংলায় উদাহরণসহ স্পষ্টভাবে উত্তর দাও।',
      'Answer Sheet Evaluator': 'তুমি একজন কঠোর ও অভিজ্ঞ পরীক্ষক। শিক্ষার্থীর খাতার ছবির উত্তর যাচাই করে ১০-এ নম্বর দাও, ভুল-ত্রুটি চিহ্নিত করো এবং আদর্শ উত্তর লিখে দাও।',
      'Book Page Summary & Translate': 'তুমি একজন অনুবাদক ও পাঠ্যবই বিশেষজ্ঞ। বইয়ের পাতার ছবি বা টেক্সট থেকে সহজ বাংলায় অনুবাদ এবং মূলভাবের সারসংক্ষেপ পয়েন্ট আকারে দাও।',
      'Spoken English Partner': 'Act as a friendly Spoken English and Grammar Coach. Reply in clear conversational English, gently correct any grammar mistakes in the user message, and ask 1 short follow-up question.',
      'Teach the AI': 'তুমি এখন একজন কৌতূহলী ছাত্র এবং ব্যবহারকারী তোমার শিক্ষক। সে যা বোঝাবে তা মন দিয়ে শুনে বলো তুমি কতটা বুঝলে, ১টি পাল্টা প্রশ্ন করো এবং কোনো ভুল থাকলে বিনয়ের সাথে ধরিয়ে দাও।',
      'AI Debate Arena': 'তুমি AI ডিবেট অ্যারেনার বিপক্ষ দলের তার্কিক। ব্যবহারকারীর যুক্তির বিপরীতে শক্তিশালী ও যৌক্তিক পাল্টা যুক্তি দাও এবং শেষে ১০-এ যুক্তির স্কোর দাও।',
      'Step-by-Step Math': 'তুমি একজন গণিত ও বিজ্ঞান বিশেষজ্ঞ। প্রতিটি অঙ্ক ধাপে ধাপে সূত্রসহ সমাধান করো।'
    };

    try {
      const reply = await callGeminiFast(
        `আগের কথোপকথন:\n${recentHistory}\n\nবর্তমান ইনপুট: ${userText}`,
        systemPrompts[tutorMode] || systemPrompts['Friendly Tutor'],
        imagesToSend,
        false
      );
      setMessages((prev) => [...prev, { id: Date.now() + 1, sender: 'ai', text: reply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      addXp(15);
    } catch (err) {
      setMessages((prev) => [...prev, { id: Date.now() + 1, sender: 'ai', text: `⚠️ ${err.message}`, time: now }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearChat = () => {
    if (window.confirm('আপনি কি AI Tutor-এর সব চ্যাট মুছে ফেলতে চান?')) {
      setMessages(defaultWelcomeMsg);
      localStorage.removeItem('edunexus_chat_history');
    }
  };

  // Notes, Mind-Map, Mnemonics, Lecture-to-Notes, Suggestion, Assignment, Audio Podcast
  const handleGenerateNotes = async () => {
    if (!noteTopic.trim()) return;
    setLoadingNote(true);
    const promptMap = {
      short_note: `"${noteTopic}" বিষয়ের ওপর পরীক্ষার প্রস্তুতির জন্য একটি গোছানো শর্ট নোট তৈরি করো।`,
      mind_map: `"${noteTopic}" অধ্যায়ের একটি শাখাভিত্তিক টেক্সট মাইন্ড-ম্যাপ (Mind-Map) তৈরি করো যাতে পুরো অধ্যায় এক নজরে মনে থাকে।`,
      mnemonics: `"${noteTopic}" মনে রাখার জন্য মজার বাংলা ছন্দ, শর্টকাট ফর্মুলা ও Mnemonics তৈরি করে দাও।`,
      lecture_notes: `নিচের লেকচার বা পয়েন্টগুলো থেকে হেডিং, সংজ্ঞা ও গুরুত্বপূর্ণ প্রশ্নসহ গোছানো ক্লাস নোট তৈরি করো:\n${noteTopic}`,
      exam_suggestion: `"${noteTopic}" অধ্যায় থেকে আসন্ন পরীক্ষার জন্য সবচেয়ে গুরুত্বপূর্ণ জ্ঞানমূলক, অনুধাবনমূলক ও সৃজনশীল সাজেশন দাও।`,
      assignment_guide: `"${noteTopic}" বিষয়ের ওপর একটি পূর্ণাঙ্গ অ্যাসাইনমেন্ট বা প্রজেক্ট গাইড তৈরি করো (ভূমিকা, মূল আলোচনা ও উপসংহারসহ)।`,
      audio_podcast: `"${noteTopic}" নিয়ে দুজন বন্ধুর কথোপকথনের মতো একটি ১ মিনিটের অডিও পডকাস্ট রিভিশন স্ক্রিপ্ট বাংলায় লেখো।`,
      formula_sheet: `"${noteTopic}" অধ্যায়ের সব গুরুত্বপূর্ণ গাণিতিক বা বৈজ্ঞানিক সূত্র তালিকা আকারে লেখো।`
    };
    try {
      const reply = await callGeminiFast(promptMap[noteType], "তুমি একজন অভিজ্ঞ শিক্ষক। স্পষ্ট পয়েন্ট আকারে শুদ্ধ বাংলায় উত্তর তৈরি করো।");
      setGeneratedNote(reply);
      if (noteType === 'audio_podcast') handleSpeakText(reply);
      addXp(25);
    } catch (err) { showToast(err.message); } finally { setLoadingNote(false); }
  };

  const handleEvalCalculator = () => {
    try {
      const normalized = calcInput
        .replace(/sin\(/g, 'Math.sin(')
        .replace(/cos\(/g, 'Math.cos(')
        .replace(/tan\(/g, 'Math.tan(')
        .replace(/sqrt\(/g, 'Math.sqrt(')
        .replace(/log\(/g, 'Math.log10(')
        .replace(/pi/gi, 'Math.PI')
        .replace(/\^/g, '**');
      // eslint-disable-next-line no-new-func
      const val = Function(`"use strict"; return (${normalized})`)();
      setCalcResult(Number.isFinite(val) ? String(Number(val.toFixed(6))) : 'Error');
    } catch {
      setCalcResult('Error');
    }
  };

  const handleGenerateStudyPlan = async () => {
    if (!targetExam.name.trim()) return;
    setLoadingPlan(true);
    const daysLeft = targetExam.date ? Math.max(1, Math.ceil((new Date(targetExam.date) - new Date()) / (1000 * 60 * 60 * 24))) : 30;
    try {
      const plan = await callGeminiFast(
        `আমার "${targetExam.name}" পরীক্ষার আর মাত্র ${daysLeft} দিন বাকি। আমাকে একটি বাস্তবসম্মত দৈনিক স্টাডি রুটিন ও প্রস্তুতি গাইডলাইন তৈরি করে দাও।`,
        "তুমি একজন দক্ষ স্টাডি কোচ। সংক্ষেপে ও স্পষ্ট পয়েন্ট আকারে শুদ্ধ বাংলায় গাইডলাইন দাও।"
      );
      setStudyPlan(plan);
      addXp(20);
    } catch (err) { showToast(err.message); } finally { setLoadingPlan(false); }
  };

  const handleExplainMistake = async (m) => {
    setExplainingMistakeId(m.id);
    try {
      const exp = await callGeminiFast(
        `প্রশ্ন: "${m.question}"। ভুল উত্তর "${m.yourAnswer}", সঠিক উত্তর "${m.correctAnswer}"। কেন সঠিক উত্তরটি ঠিক তা ২-৩ লাইনে সহজে বুঝিয়ে দাও।`,
        "সহজ ও বন্ধুত্বপূর্ণ বাংলায় ব্যাখ্যা দাও।"
      );
      setMistakes(prev => prev.map(item => item.id === m.id ? { ...item, explanation: exp } : item));
    } finally { setExplainingMistakeId(null); }
  };

  const handleAddTodo = (e) => {
    e.preventDefault();
    if (!todoInput.trim()) return;
    setTodos(prev => [{ id: Date.now(), text: todoInput.trim(), done: false }, ...prev]);
    setTodoInput('');
  };

  const handleToggleTodo = (id) => {
    setTodos(prev => prev.map(t => {
      if (t.id === id) {
        if (!t.done) { addXp(15); showToast("টার্গেট সম্পন্ন! +15 XP"); }
        return { ...t, done: !t.done };
      }
      return t;
    }));
  };

  const handleRequestTeacher = async () => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), { teacherRequest: true });
    showToast("Teacher আবেদন Host-এর কাছে পাঠানো হয়েছে!");
  };

  const handleToggleUserRole = async (targetUser, newRole) => {
    if (!isHost) return;
    await updateDoc(doc(db, 'users', targetUser.uid), { role: newRole, teacherRequest: false });
    showToast(`${targetUser.displayName}-কে ${newRole.toUpperCase()} করা হয়েছে!`);
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!isTeacherOrHost || !newGroupName.trim()) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const docRef = await addDoc(collection(db, 'study_groups'), {
      name: newGroupName.trim(), subject: newGroupSubject.trim() || 'General',
      inviteCode: code, teacherId: user.uid, teacherName: userProfile?.displayName || user.displayName,
      members: [user.uid], createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, 'users', user.uid), { joinedGroups: arrayUnion(docRef.id) });
    setNewGroupName(''); setNewGroupSubject(''); setSelectedGroupId(docRef.id);
    showToast(`নতুন গ্রুপ তৈরি হয়েছে! কোড: ${code}`);
  };

  const handleJoinGroupByCode = async (e) => {
    e.preventDefault();
    if (!user || !joinCodeInput.trim()) return;
    const found = groups.find(g => g.inviteCode === joinCodeInput.trim().toUpperCase());
    if (!found) { showToast("ভুল ইনভাইট কোড!"); return; }
    await updateDoc(doc(db, 'study_groups', found.id), { members: arrayUnion(user.uid) });
    await updateDoc(doc(db, 'users', user.uid), { joinedGroups: arrayUnion(found.id) });
    setSelectedGroupId(found.id); setJoinCodeInput('');
    showToast(`"${found.name}" গ্রুপে যুক্ত হয়েছেন!`);
  };

  const handleCommImageSelect = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 4);
    if (files.length === 0) return;
    const compressedList = await Promise.all(files.map((f) => compressImageToBase64(f, 550, 0.5)));
    setCommImages((prev) => [...prev, ...compressedList].slice(0, 4));
    e.target.value = '';
  };

  const handleSendGroupMsg = async (e) => {
    e.preventDefault();
    if ((!commInput.trim() && commImages.length === 0) || sendingComm) return;
    if (!user) { handleGoogleSignIn(); return; }
    setSendingComm(true);
    const textToSend = commInput.trim();
    const imgsToSend = [...commImages];
    const replyData = replyToMsg ? { name: replyToMsg.userName, text: replyToMsg.text || '📷 ছবি' } : null;
    setCommInput(''); setCommImages([]); setReplyToMsg(null);
    try {
      await addDoc(collection(db, 'group_messages'), {
        groupId: selectedGroupId, text: textToSend, images: imgsToSend, image: imgsToSend[0] || '',
        replyTo: replyData, uid: user.uid,
        userName: isAnonymousMsg ? '🕵️ Anonymous Doubt' : (userProfile?.displayName || user.displayName || 'Student'),
        userPhoto: isAnonymousMsg ? '' : (userProfile?.photoURL || user.photoURL || ''),
        senderRole: isAnonymousMsg ? 'student' : currentRole,
        isAnonymous: isAnonymousMsg,
        pinned: false, likes: [], seenBy: [userProfile?.displayName || user.displayName || 'Student'],
        clientTime: Date.now(),
        timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      addXp(5);
    } catch { showToast("ছবি বড় হওয়ায় পাঠানো যায়নি।"); } finally { setSendingComm(false); }
  };

  const handleMarkMessageSeen = async (msg) => {
    if (!user) return;
    const myName = userProfile?.displayName || user.displayName || 'Student';
    if ((msg.seenBy || []).includes(myName)) return;
    await updateDoc(doc(db, 'group_messages', msg.id), { seenBy: arrayUnion(myName) });
  };

  const handleTogglePinMsg = async (msg) => { if (isTeacherOrHost) await updateDoc(doc(db, 'group_messages', msg.id), { pinned: !msg.pinned }); };
  const handleLikeMsg = async (msg) => {
    if (!user) return;
    const currentLikes = msg.likes || [];
    const updated = currentLikes.includes(user.uid) ? currentLikes.filter(id => id !== user.uid) : [...currentLikes, user.uid];
    await updateDoc(doc(db, 'group_messages', msg.id), { likes: updated });
    if (!currentLikes.includes(user.uid)) addXp(5); // Peer-to-Peer Help Reward
  };

  const handlePostNotice = async (e) => {
    e.preventDefault();
    if (!isTeacherOrHost || !noticeTitle.trim() || !noticeBody.trim()) return;
    const titleStr = noticeTitle.trim();
    const bodyStr = noticeBody.trim();
    await addDoc(collection(db, 'group_notices'), {
      groupId: selectedGroupId, title: titleStr, body: bodyStr,
      authorName: userProfile?.displayName || user.displayName, authorRole: currentRole,
      seenBy: [userProfile?.displayName || user.displayName],
      clientTime: Date.now(), dateStr: new Date().toLocaleDateString('bn-BD')
    });
    setNoticeTitle(''); setNoticeBody('');
    showToast("📢 নোটিশ প্রকাশিত হয়েছে!");
  };

  const handleCreatePoll = async (e) => {
    e.preventDefault();
    if (!isTeacherOrHost || !pollQuestion.trim() || !pollOpt1.trim() || !pollOpt2.trim()) return;
    await addDoc(collection(db, 'group_polls'), {
      groupId: selectedGroupId, question: pollQuestion.trim(), opt1: pollOpt1.trim(), opt2: pollOpt2.trim(),
      votes1: [], votes2: [], authorName: userProfile?.displayName || user.displayName, clientTime: Date.now()
    });
    setPollQuestion(''); setPollOpt1(''); setPollOpt2('');
    showToast("📊 লাইভ পোল চালু হয়েছে!");
  };

  const handleVotePoll = async (poll, optionNum) => {
    if (!user) return;
    const v1 = (poll.votes1 || []).filter(id => id !== user.uid);
    const v2 = (poll.votes2 || []).filter(id => id !== user.uid);
    if (optionNum === 1) v1.push(user.uid); else v2.push(user.uid);
    await updateDoc(doc(db, 'group_polls', poll.id), { votes1: v1, votes2: v2 });
  };

  const handleAddRoutine = async (e) => {
    e.preventDefault();
    if (!isTeacherOrHost || !routineForm.time.trim() || !routineForm.subject.trim()) return;
    await addDoc(collection(db, 'group_routines'), {
      groupId: selectedGroupId, day: routineForm.day, time: routineForm.time.trim(),
      subject: routineForm.subject.trim(), liveLink: routineForm.liveLink.trim(),
      teacherName: userProfile?.displayName || user.displayName, clientTime: Date.now()
    });
    setRoutineForm({ day: 'শনিবার', time: '', subject: '', liveLink: '' });
    showToast("ক্লাস রুটিন যুক্ত হয়েছে!");
  };

  const handleAddResource = async (e) => {
    e.preventDefault();
    if (!isTeacherOrHost || !resForm.title.trim() || !resForm.url.trim()) return;
    await addDoc(collection(db, 'group_resources'), {
      groupId: selectedGroupId, title: resForm.title.trim(), subject: resForm.subject.trim() || 'General',
      url: resForm.url.trim(), teacherName: userProfile?.displayName || user.displayName, clientTime: Date.now()
    });
    setResForm({ title: '', subject: '', url: '' });
    showToast("📚 লাইব্রেরিতে ফাইল যুক্ত হয়েছে!");
  };

  const handleAddHomework = async (e) => {
    e.preventDefault();
    if (!isTeacherOrHost || !hwTitle.trim()) return;
    await addDoc(collection(db, 'group_homeworks'), {
      groupId: selectedGroupId, title: hwTitle.trim(), dueDate: hwDue || 'পরবর্তী ক্লাস',
      teacherName: userProfile?.displayName || user.displayName, completedBy: [], clientTime: Date.now()
    });
    setHwTitle(''); setHwDue('');
  };

  const handleToggleHomeworkDone = async (hw) => {
    if (!user) return;
    const list = hw.completedBy || [];
    const exists = list.some(item => item.uid === user.uid);
    const updated = exists ? list.filter(item => item.uid !== user.uid) : [...list, { uid: user.uid, name: userProfile?.displayName || user.displayName }];
    await updateDoc(doc(db, 'group_homeworks', hw.id), { completedBy: updated });
    if (!exists) { addXp(20); showToast("হোমওয়ার্ক জমা হয়েছে! +20 XP"); }
  };

  const handleSaveAttendance = async () => {
    if (!isTeacherOrHost) return;
    const recordsArray = Object.entries(attMap).map(([uid, status]) => {
      const st = allUsers.find(u => u.uid === uid);
      return { uid, name: st?.displayName || 'Student', status };
    });
    if (recordsArray.length === 0) { showToast("অন্তত একজন শিক্ষার্থীর উপস্থিতি দিন।"); return; }
    await addDoc(collection(db, 'group_attendance'), {
      groupId: selectedGroupId, date: attDate, takenBy: userProfile?.displayName || user.displayName, records: recordsArray
    });
    showToast(`${attDate} তারিখের উপস্থিতি সেভ হয়েছে!`);
  };

  const handleSaveClassExam = async (e) => {
    e.preventDefault();
    if (!isTeacherOrHost || !examForm.title.trim()) return;
    const payload = {
      groupId: selectedGroupId, title: examForm.title.trim(), date: examForm.date,
      syllabus: examForm.syllabus.trim(), resultsText: examForm.resultsText.trim(),
      updatedBy: userProfile?.displayName || user.displayName, clientTime: Date.now()
    };
    if (editingExamId) { await updateDoc(doc(db, 'group_exams', editingExamId), payload); setEditingExamId(null); }
    else { await addDoc(collection(db, 'group_exams'), payload); }
    setExamForm({ title: '', date: '', syllabus: '', resultsText: '' });
    showToast("পরীক্ষার তথ্য সেভ হয়েছে!");
  };

  const handleAddRecordedClass = async (e) => {
    e.preventDefault();
    if (!isTeacherOrHost || !classForm.title.trim() || !classForm.videoUrl.trim()) return;
    await addDoc(collection(db, 'recorded_classes'), {
      groupId: selectedGroupId, title: classForm.title.trim(), videoUrl: classForm.videoUrl.trim(),
      notes: classForm.notes.trim(), teacherName: userProfile?.displayName || user.displayName,
      clientTime: Date.now(), dateStr: new Date().toLocaleDateString('bn-BD')
    });
    setClassForm({ title: '', videoUrl: '', notes: '' });
    showToast("রেকর্ডেড ক্লাস যুক্ত হয়েছে!");
  };

  const handleProfilePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageToBase64(file, 300, 0.7);
    setEditPhoto(compressed);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: editName.trim() || user.displayName,
        bio: editBio.trim(),
        photoURL: editPhoto
      });
      showToast("প্রোফাইল আপডেট হয়েছে!");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!examTopic.trim()) return;
    setLoadingQuiz(true);
    setQuizQuestions([]);
    setQuizFinished(false);
    setCurrentQIndex(0);
    setQuizScore(0);
    setRivalScore(0);
    setCheatWarnings(0);
    setSelectedOption(null);
    const prompt = `"${examTopic}" বিষয়ের ওপর ৫টি MCQ প্রশ্ন তৈরি করো শুদ্ধ বাংলায়। শুধুমাত্র JSON ফরম্যাটে উত্তর দেবে:
[{"question": "প্রশ্ন", "options": ["ক", "খ", "গ", "ঘ"], "correctIndex": 0, "explanation": "সংক্ষিপ্ত ব্যাখ্যা"}]`;
    try {
      const raw = await callGeminiFast(prompt, "Always respond with valid raw JSON array only.", null, true);
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      if (Array.isArray(parsed) && parsed.length > 0) setQuizQuestions(parsed);
    } catch (err) {
      showToast("কুইজ তৈরিতে সমস্যা: " + err.message);
    } finally {
      setLoadingQuiz(false);
    }
  };

  const handleOptionSelect = (idx) => {
    if (selectedOption !== null) return;
    setSelectedOption(idx);
    const currentQ = quizQuestions[currentQIndex];
    if (battleMode && Math.random() > 0.4) setRivalScore((r) => r + 1);
    if (idx === currentQ.correctIndex) {
      setQuizScore((s) => s + 1);
      addXp(20);
    } else {
      setMistakes(prev => [
        {
          id: Date.now(),
          topic: examTopic,
          question: currentQ.question,
          yourAnswer: currentQ.options[idx],
          correctAnswer: currentQ.options[currentQ.correctIndex],
          explanation: currentQ.explanation
        },
        ...prev
      ]);
    }
  };

  const handleGenerateFlashcards = async () => {
    if (!flashTopic.trim()) return;
    setLoadingFlash(true);
    const prompt = `"${flashTopic}" বিষয়ের ওপর ৬টি ফ্ল্যাশকার্ড তৈরি করো শুদ্ধ বাংলায়। শুধুমাত্র JSON ফরম্যাটে উত্তর দেবে: [{"front": "প্রশ্ন বা সূত্র", "back": "উত্তর বা সংজ্ঞা"}]`;
    try {
      const raw = await callGeminiFast(prompt, "Respond strictly with valid JSON array.", null, true);
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      if (Array.isArray(parsed) && parsed.length > 0) {
        setFlashcards(parsed);
        setCardIndex(0);
        setIsFlipped(false);
        addXp(25);
      }
    } catch (err) {
      showToast("ফ্ল্যাশকার্ড তৈরিতে সমস্যা: " + err.message);
    } finally {
      setLoadingFlash(false);
    }
  };

  const activeGroupObj = groups.find(g => g.id === selectedGroupId);
  const myAccessibleGroups = isHost
    ? groups
    : groups.filter(g => g.teacherId === user?.uid || (g.members || []).includes(user?.uid));
  const groupMembers = selectedGroupId === 'global'
    ? allUsers
    : allUsers.filter(u => (activeGroupObj?.members || []).includes(u.uid));

  const myTotalClasses = attendanceRecords.filter(rec => (rec.records || []).some(r => r.uid === user?.uid)).length;
  const myPresentClasses = attendanceRecords.filter(rec => (rec.records || []).some(r => r.uid === user?.uid && r.status === 'উপস্থিত')).length;
  const myAttendancePercent = myTotalClasses > 0 ? Math.round((myPresentClasses / myTotalClasses) * 100) : 100;
  const myDoneHwCount = homeworks.filter(hw => (hw.completedBy || []).some(item => item.uid === user?.uid)).length;
  const daysToTargetExam = targetExam.date ? Math.max(0, Math.ceil((new Date(targetExam.date) - new Date()) / (1000 * 60 * 60 * 24))) : null;
  const syllabusProgressPct = syllabusItems.length ? Math.round((syllabusItems.filter(s => s.done).length / syllabusItems.length) * 100) : 0;

  const pinnedMessages = groupMsgs.filter(m => m.pinned);
  const formatTime = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

  const bgMain = darkMode ? 'bg-[#070b14] text-slate-100' : 'bg-slate-50 text-slate-900';
  const cardBg = darkMode ? 'bg-[#111827]/90 border-slate-800/80 backdrop-blur-md shadow-xl' : 'bg-white border-slate-200 shadow-sm';
  const inputBg = darkMode ? 'bg-[#1a2236] border-slate-700/80 text-white placeholder-slate-400' : 'bg-slate-100 border-slate-300 text-slate-900';

  const roleBadge = () => {
    if (currentRole === 'host') return <span className="bg-amber-400 text-slate-950 text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-0.5"><Shield className="w-2.5 h-2.5" /> HOST</span>;
    if (currentRole === 'teacher') return <span className="bg-emerald-400 text-slate-950 text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-0.5"><UserCheck className="w-2.5 h-2.5" /> TEACHER</span>;
    return <span className="bg-white/20 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">STUDENT</span>;
  };
  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${bgMain}`}>
      {toastMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-2xl border border-indigo-400/50 animate-bounce">
          {toastMsg}
        </div>
      )}

      {/* প্রিমিয়াম গ্লাসমরফিজম হেডার */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white px-3 py-2.5 shadow-xl">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-1.5 rounded-xl shadow-inner"><Sparkles className="w-5 h-5 text-amber-300" /></div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-base tracking-tight leading-none">EduNexus AI</h1>
                {user && roleBadge()}
              </div>
              <span className="text-[10px] text-indigo-100/80 font-medium">Smart Classroom OS • {xp} XP</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button onClick={handleEnableNotifications} className={`p-1.5 rounded-full transition ${notifPermission === 'granted' ? 'bg-emerald-400/25 text-emerald-200' : 'bg-amber-400 text-slate-950 animate-pulse'}`}>
              {notifPermission === 'granted' ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </button>

            <div className="flex items-center gap-1 bg-black/25 px-2 py-1 rounded-full text-[11px] font-mono" title="Study Together Timer">
              <Clock className="w-3 h-3 text-emerald-300" /><span>{formatTime(timerSeconds)}</span>
              <button onClick={() => setTimerRunning(!timerRunning)} className="text-amber-300">{timerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}</button>
              <button onClick={() => { setTimerRunning(false); setTimerSeconds(25 * 60); }} className="text-slate-300"><RotateCcw className="w-3 h-3" /></button>
            </div>

            <button onClick={() => setDarkMode(!darkMode)} className="p-1.5 rounded-full bg-white/15">
              {darkMode ? <Sun className="w-4 h-4 text-amber-200" /> : <Moon className="w-4 h-4" />}
            </button>

            {!authLoading && (
              user ? (
                <div className="flex items-center gap-1 bg-white/15 pl-1 pr-2 py-1 rounded-full">
                  <img src={userProfile?.photoURL || user.photoURL || '/logo.png'} alt="User" className="w-6 h-6 rounded-full object-cover bg-white" />
                  <button onClick={handleLogout} className="text-rose-200 hover:text-white"><LogOut className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <button onClick={handleGoogleSignIn} className="bg-white text-indigo-700 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow">
                  <LogIn className="w-3.5 h-3.5" /><span>Sign In</span>
                </button>
              )
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-3 pb-24 flex flex-col">
        {/* ট্যাব ১: AI STUDIO */}
        {activeTab === 'tutor' && (
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2 px-1 gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5"><Brain className="w-4 h-4" /> AI Studio</span>
              <div className="flex items-center gap-2">
                <select value={tutorMode} onChange={(e) => setTutorMode(e.target.value)} className={`text-xs px-2.5 py-1.5 rounded-xl border outline-none font-semibold ${cardBg}`}>
                  <option value="Friendly Tutor">🤖 Friendly Tutor</option>
                  <option value="Answer Sheet Evaluator">📝 Answer Sheet Evaluator</option>
                  <option value="Book Page Summary & Translate">📖 বইয়ের পাতা সারাংশ ও অনুবাদ</option>
                  <option value="Spoken English Partner">🗣️ Spoken English ও গ্রামার</option>
                  <option value="Teach the AI">🎓 Teach the AI (উল্টো টিউটর)</option>
                  <option value="AI Debate Arena">⚔️ AI ডিবেট অ্যারেনা</option>
                  <option value="Step-by-Step Math">🧮 Step-by-Step Math</option>
                </select>
                <button onClick={handleClearChat} className={`p-1.5 rounded-xl border text-slate-400 hover:text-rose-400 ${cardBg}`}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>

            <div className={`flex-1 rounded-2xl border p-3 overflow-y-auto space-y-3 min-h-[55vh] max-h-[60vh] ${cardBg}`}>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[86%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.sender === 'user' ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-br-sm shadow-md' : darkMode ? 'bg-[#1a2236] text-slate-100 rounded-bl-sm border border-slate-700/60' : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                  }`}>
                    {(msg.images?.length > 0 ? msg.images : msg.image ? [msg.image] : []).map((src, i) => (
                      <img key={i} src={src} alt="Uploaded" className="max-h-48 rounded-xl mb-2 border border-white/20 bg-white" />
                    ))}
                    {msg.text}
                    {msg.sender === 'ai' && (
                      <div className="mt-2 flex items-center gap-3 pt-1 border-t border-white/10">
                        <button onClick={() => handleSpeakText(msg.text)} className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold">
                          <Volume2 className="w-3.5 h-3.5" /> শুনুন
                        </button>
                        <button onClick={() => handleSaveAnswer(tutorMode, msg.text)} className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-semibold">
                          <Bookmark className="w-3.5 h-3.5" /> Save Answer
                        </button>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.time}</span>
                </div>
              ))}
              {isTyping && (
                <div className="flex items-center gap-2 text-xs text-indigo-400 px-2 py-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>AI বিশ্লেষণ করে উত্তর লিখছে...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {tutorImages.length > 0 && (
              <div className="mt-2 flex items-center gap-2 bg-indigo-500/15 border border-indigo-500/30 p-2 rounded-xl overflow-x-auto">
                {tutorImages.map((imgSrc, idx) => (
                  <div key={idx} className="relative shrink-0">
                    <img src={imgSrc} alt="Preview" className="w-12 h-12 rounded-lg object-cover bg-white" />
                    <button type="button" onClick={() => setTutorImages((prev) => prev.filter((_, i) => i !== idx))} className="absolute -top-1 -right-1 bg-rose-600 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSendMessage} className="mt-2.5 flex gap-1.5 items-center">
              <label className={`p-3 rounded-xl border cursor-pointer hover:border-indigo-500 ${cardBg}`} title="খাতার ছবি বা বইয়ের পাতা দিন">
                <Camera className="w-5 h-5 text-indigo-400" />
                <input type="file" accept="image/*" multiple onChange={handleTutorImageUpload} className="hidden" />
              </label>
              <button type="button" onClick={handleVoiceInput} className={`p-3 rounded-xl border ${isListening ? 'bg-rose-600 text-white animate-pulse' : cardBg}`}>
                <Mic className="w-5 h-5 text-emerald-400" />
              </button>
              <input type="text" value={inputMsg} onChange={(e) => setInputMsg(e.target.value)} placeholder="প্রশ্ন, খাতার ছবি, ইংরেজি বা বিতর্কের যুক্তি দিন..." className={`flex-1 rounded-xl border px-3 py-3 text-sm outline-none focus:border-indigo-500 ${inputBg}`} />
              <button type="submit" disabled={isTyping || (!inputMsg.trim() && tutorImages.length === 0)} className="bg-gradient-to-r from-indigo-600 to-violet-600 disabled:opacity-50 text-white p-3 rounded-xl shadow-lg">
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        )}

        {/* ট্যাব ২: CLASSROOM */}
        {activeTab === 'classroom' && (
          <div className="space-y-3">
            <div className={`p-3 rounded-2xl border space-y-2.5 ${cardBg}`}>
              <div className="flex items-center justify-between gap-2">
                <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className={`flex-1 text-xs font-bold px-3 py-2 rounded-xl border outline-none ${inputBg}`}>
                  <option value="global">🌐 কমন স্টুডেন্ট কমিউনিটি (সবার জন্য)</option>
                  {myAccessibleGroups.map(g => <option key={g.id} value={g.id}>📚 {g.name} ({g.teacherName}) — কোড: {g.inviteCode}</option>)}
                </select>
                <button
                  onClick={() => {
                    const pool = groupMembers.length > 0 ? groupMembers.map(m => m.displayName) : ['আরিফ', 'সুমাইয়া', 'তানভীর', 'নুসরাত'];
                    const chosen = pool[Math.floor(Math.random() * pool.length)];
                    setPickedStudent(chosen);
                    showToast(`🎲 Random Student Picker: ${chosen}`);
                  }}
                  className="bg-violet-600/25 text-violet-300 border border-violet-500/40 px-2.5 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1 shrink-0"
                >
                  <Shuffle className="w-3.5 h-3.5" /> Pick
                </button>
              </div>

              {pickedStudent && (
                <div className="p-2 rounded-xl bg-violet-500/15 border border-violet-500/30 text-xs flex justify-between items-center">
                  <span>🎲 নির্বাচিত শিক্ষার্থী: <strong className="text-violet-300">{pickedStudent}</strong></span>
                  <button onClick={() => setPickedStudent(null)} className="text-slate-400"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}

              {user && (
                <form onSubmit={handleJoinGroupByCode} className="flex gap-2">
                  <input type="text" value={joinCodeInput} onChange={(e) => setJoinCodeInput(e.target.value)} placeholder="টিচারের গ্রুপ কোড দিয়ে জয়েন করুন..." className={`flex-1 rounded-xl border px-3 py-1.5 text-xs outline-none ${inputBg}`} />
                  <button type="submit" className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold">Join</button>
                </form>
              )}

              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { id: 'chat', label: 'Peer Help ও ডাউট', icon: MessageSquare },
                  { id: 'notices', label: `নোটিশ ও Poll (${notices.length + polls.length})`, icon: Bell },
                  { id: 'routine', label: 'রুটিন', icon: Calendar },
                  { id: 'library', label: 'লাইব্রেরি', icon: FolderOpen },
                  { id: 'homework', label: `হোমওয়ার্ক (${homeworks.length})`, icon: FileCheck },
                  { id: 'attendance', label: 'উপস্থিতি', icon: ClipboardCheck },
                  { id: 'exams', label: 'পরীক্ষা', icon: Award },
                  { id: 'classes', label: 'ভিডিও', icon: Video },
                  { id: 'leaderboard', label: 'র‍্যাংকিং', icon: Medal },
                  ...(isTeacherOrHost ? [{ id: 'manage', label: isHost ? 'Host কন্ট্রোল' : 'গ্রুপ তৈরি', icon: Shield }] : [])
                ].map(st => {
                  const Icon = st.icon;
                  return (
                    <button key={st.id} onClick={() => { setGroupSubTab(st.id); if (st.id === 'notices') setUnreadNoticeCount(0); }} className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1 transition ${groupSubTab === st.id ? 'bg-indigo-600 text-white shadow' : 'bg-slate-800/40 text-slate-400'}`}>
                      <Icon className="w-3.5 h-3.5" /><span>{st.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {groupSubTab === 'chat' && (
              <div className="flex flex-col">
                {pinnedMessages.length > 0 && (
                  <div className="mb-2 p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs flex items-center gap-2">
                    <Pin className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="truncate flex-1 font-medium text-amber-200">পিন করা: {pinnedMessages[pinnedMessages.length - 1].text}</span>
                  </div>
                )}

                <div className={`rounded-2xl border p-3 overflow-y-auto space-y-3 min-h-[43vh] max-h-[46vh] ${cardBg}`}>
                  {groupMsgs.length === 0 ? <p className="text-center text-xs text-slate-400 py-14">Peer-to-Peer Help বা Anonymous Doubt পোস্ট করুন।</p> : groupMsgs.map((m) => {
                    const isMe = user && m.uid === user.uid;
                    return (
                      <div key={m.id} onClick={() => handleMarkMessageSeen(m)} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-1.5 mb-0.5 px-1">
                          {m.userPhoto && <img src={m.userPhoto} alt="" className="w-4 h-4 rounded-full object-cover" />}
                          <span className="text-[11px] font-semibold text-indigo-400">{m.userName}</span>
                          {m.senderRole === 'host' && <span className="text-[9px] bg-amber-400 text-black px-1.5 rounded font-bold">HOST</span>}
                          {m.senderRole === 'teacher' && <span className="text-[9px] bg-emerald-400 text-black px-1.5 rounded font-bold">TEACHER</span>}
                          <button onClick={() => setReplyToMsg(m)} className="text-slate-400 hover:text-indigo-400 ml-1"><Reply className="w-3 h-3" /></button>
                          {isTeacherOrHost && (<><button onClick={() => handleTogglePinMsg(m)} className="text-amber-400"><Pin className="w-3 h-3" /></button><button onClick={() => deleteDoc(doc(db, 'group_messages', m.id))} className="text-rose-400"><Trash2 className="w-3 h-3" /></button></>)}
                        </div>
                        <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm ${isMe ? 'bg-emerald-600 text-white rounded-br-sm' : darkMode ? 'bg-[#1a2236] text-slate-100 rounded-bl-sm' : 'bg-slate-100 text-slate-800'}`}>
                          {m.replyTo && <div className="text-[11px] bg-black/20 border-l-2 border-amber-400 px-2 py-1 rounded mb-1.5 truncate"><strong>{m.replyTo.name}:</strong> {m.replyTo.text}</div>}
                          {(m.images?.length > 0 ? m.images : m.image ? [m.image] : []).map((src, i) => <img key={i} src={src} alt="Shared" className="max-h-52 rounded-xl mb-1.5 bg-white" />)}
                          {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 px-1">
                          <span className="text-[10px] text-slate-400">{m.timeStr}</span>
                          <button onClick={() => handleLikeMsg(m)} className="text-[11px] text-slate-400 hover:text-amber-400">🤝 Help {(m.likes || []).length}</button>
                          <span className="text-[10px] text-slate-400 flex items-center gap-0.5" title={(m.seenBy || []).join(', ')}>
                            <Eye className="w-3 h-3" /> {(m.seenBy || []).length}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={commEndRef} />
                </div>

                <div className="mt-2 flex items-center justify-between px-1">
                  <button
                    type="button"
                    onClick={() => setIsAnonymousMsg(!isAnonymousMsg)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${isAnonymousMsg ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800/40 text-slate-400'}`}
                  >
                    {isAnonymousMsg ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {isAnonymousMsg ? 'Anonymous Doubt চালু (নাম গোপন)' : 'Anonymous Doubt মোড'}
                  </button>
                  {replyToMsg && (
                    <button onClick={() => setReplyToMsg(null)} className="text-[11px] text-rose-400 flex items-center gap-1">
                      রিপ্লাই বাতিল <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <form onSubmit={handleSendGroupMsg} className="mt-2 flex gap-2 items-center">
                  <label className={`p-3 rounded-xl border cursor-pointer ${cardBg}`}><ImageIcon className="w-5 h-5 text-emerald-400" /><input type="file" accept="image/*" multiple onChange={handleCommImageSelect} className="hidden" /></label>
                  <input type="text" value={commInput} onChange={(e) => setCommInput(e.target.value)} placeholder={isAnonymousMsg ? "নাম গোপন রেখে প্রশ্ন লিখুন..." : "ডাউট বা সহপাঠীর সাহায্য লিখুন..."} className={`flex-1 rounded-xl border px-3.5 py-3 text-sm outline-none ${inputBg}`} />
                  <button type="submit" disabled={sendingComm} className="bg-emerald-600 text-white p-3 rounded-xl"><Send className="w-5 h-5" /></button>
                </form>
              </div>
            )}

            {groupSubTab === 'notices' && (
              <div className="space-y-3">
                {isTeacherOrHost && (
                  <>
                    <form onSubmit={handlePostNotice} className={`p-4 rounded-2xl border space-y-2 ${cardBg}`}>
                      <h3 className="text-sm font-bold text-amber-400 flex items-center gap-1.5"><Bell className="w-4 h-4" /> নোটিশ প্রকাশ করুন</h3>
                      <input type="text" value={noticeTitle} onChange={(e) => setNoticeTitle(e.target.value)} placeholder="নোটিশের শিরোনাম" className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                      <textarea rows="2" value={noticeBody} onChange={(e) => setNoticeBody(e.target.value)} placeholder="বিস্তারিত নোটিশ..." className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                      <button type="submit" className="bg-amber-500 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl">নোটিশ পাঠান</button>
                    </form>
                    <form onSubmit={handleCreatePoll} className={`p-4 rounded-2xl border space-y-2 ${cardBg}`}>
                      <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-1.5"><BarChart2 className="w-4 h-4" /> Live Poll তৈরি করুন</h3>
                      <input type="text" value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="পোলের প্রশ্ন" className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                              <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={pollOpt1} onChange={(e) => setPollOpt1(e.target.value)} placeholder="অপশন ১" className={`rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                        <input type="text" value={pollOpt2} onChange={(e) => setPollOpt2(e.target.value)} placeholder="অপশন ২" className={`rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                      </div>
                      <button type="submit" className="bg-indigo-600 text-white font-bold text-xs px-4 py-2 rounded-xl">পোল প্রকাশ করুন</button>
                    </form>
                  </>
                )}

                {polls.map(p => (
                  <div key={p.id} className={`p-4 rounded-2xl border space-y-2 ${cardBg}`}>
                    <div className="flex justify-between"><h4 className="font-bold text-sm text-indigo-300">📊 {p.question}</h4>{isTeacherOrHost && <button onClick={() => deleteDoc(doc(db, 'group_polls', p.id))} className="text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button onClick={() => handleVotePoll(p, 1)} className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex justify-between font-bold"><span>{p.opt1}</span><span>{(p.votes1 || []).length} ভোট</span></button>
                      <button onClick={() => handleVotePoll(p, 2)} className="p-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex justify-between font-bold"><span>{p.opt2}</span><span>{(p.votes2 || []).length} ভোট</span></button>
                    </div>
                  </div>
                ))}

                {notices.map(n => (
                  <div key={n.id} className={`p-4 rounded-2xl border space-y-1 ${cardBg}`}>
                    <div className="flex justify-between"><h4 className="font-bold text-sm text-amber-300">🔔 {n.title}</h4>{isTeacherOrHost && <button onClick={() => deleteDoc(doc(db, 'group_notices', n.id))} className="text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>}</div>
                    <p className="text-xs whitespace-pre-wrap">{n.body}</p>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                      <span>প্রকাশক: {n.authorName} • {n.dateStr}</span>
                      <span>👁️ Seen: {(n.seenBy || []).length} জন</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {groupSubTab === 'routine' && (
              <div className="space-y-3">
                {isTeacherOrHost && (
                  <form onSubmit={handleAddRoutine} className={`p-4 rounded-2xl border space-y-2 ${cardBg}`}>
                    <h3 className="text-sm font-bold text-indigo-400">নতুন ক্লাস রুটিন</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={routineForm.day} onChange={(e) => setRoutineForm({ ...routineForm, day: e.target.value })} className={`rounded-xl border px-3 py-2 text-xs ${inputBg}`}>
                        {['শনিবার', 'রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার'].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <input type="text" value={routineForm.time} onChange={(e) => setRoutineForm({ ...routineForm, time: e.target.value })} placeholder="সময় (রাত ৮:০০)" className={`rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                    </div>
                    <input type="text" value={routineForm.subject} onChange={(e) => setRoutineForm({ ...routineForm, subject: e.target.value })} placeholder="বিষয়" className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                    <input type="url" value={routineForm.liveLink} onChange={(e) => setRoutineForm({ ...routineForm, liveLink: e.target.value })} placeholder="লাইভ লিংক (ঐচ্ছিক)" className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                    <button type="submit" className="bg-indigo-600 text-white font-bold text-xs px-4 py-2 rounded-xl">রুটিন যোগ করুন</button>
                  </form>
                )}
                {routines.map(rt => (
                  <div key={rt.id} className={`p-3.5 rounded-2xl border flex items-center justify-between gap-2 ${cardBg}`}>
                    <div><span className="text-[11px] font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">{rt.day} • {rt.time}</span><h4 className="font-bold text-sm mt-1">{rt.subject}</h4></div>
                    {rt.liveLink && <a href={rt.liveLink} target="_blank" rel="noreferrer" className="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl">Join Live</a>}
                  </div>
                ))}
              </div>
            )}

            {groupSubTab === 'library' && (
              <div className="space-y-3">
                {isTeacherOrHost && (
                  <form onSubmit={handleAddResource} className={`p-4 rounded-2xl border space-y-2 ${cardBg}`}>
                    <h3 className="text-sm font-bold text-sky-400">PDF ও নোট লাইব্রেরি</h3>
                    <input type="text" value={resForm.title} onChange={(e) => setResForm({ ...resForm, title: e.target.value })} placeholder="ফাইলের নাম" className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                    <input type="url" value={resForm.url} onChange={(e) => setResForm({ ...resForm, url: e.target.value })} placeholder="PDF / Drive লিংক" className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                    <button type="submit" className="bg-sky-600 text-white font-bold text-xs px-4 py-2 rounded-xl">যুক্ত করুন</button>
                  </form>
                )}
                {resources.map(res => (
                  <div key={res.id} className={`p-3.5 rounded-2xl border flex items-center justify-between ${cardBg}`}>
                    <h4 className="font-bold text-sm">{res.title}</h4>
                    <a href={res.url} target="_blank" rel="noreferrer" className="bg-sky-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl">খুলুন</a>
                  </div>
                ))}
              </div>
            )}

            {groupSubTab === 'homework' && (
              <div className="space-y-3">
                {isTeacherOrHost && (
                  <form onSubmit={handleAddHomework} className={`p-4 rounded-2xl border space-y-2 ${cardBg}`}>
                    <input type="text" value={hwTitle} onChange={(e) => setHwTitle(e.target.value)} placeholder="হোমওয়ার্কের বিবরণ" className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                    <input type="text" value={hwDue} onChange={(e) => setHwDue(e.target.value)} placeholder="শেষ তারিখ" className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                    <button type="submit" className="bg-emerald-600 text-white font-bold text-xs px-4 py-2 rounded-xl">হোমওয়ার্ক দিন</button>
                  </form>
                )}
                {homeworks.map(hw => {
                  const isDone = user && (hw.completedBy || []).some(item => item.uid === user.uid);
                  return (
                    <div key={hw.id} className={`p-4 rounded-2xl border space-y-2 ${cardBg}`}>
                      <h4 className="font-bold text-sm">{hw.title}</h4>
                      <button onClick={() => handleToggleHomeworkDone(hw)} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${isDone ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-200'}`}>{isDone ? '✅ সম্পন্ন' : 'জমা দিন'}</button>
                    </div>
                  );
                })}
              </div>
            )}

            {groupSubTab === 'attendance' && (
              <div className="space-y-3">
                {isTeacherOrHost && (
                  <div className={`p-4 rounded-2xl border space-y-3 ${cardBg}`}>
                    <div className="flex justify-between"><span className="text-sm font-bold text-emerald-400">উপস্থিতি নিন</span><input type="date" value={attDate} onChange={(e) => setAttDate(e.target.value)} className={`text-xs px-2 py-1 rounded border ${inputBg}`} /></div>
                    {groupMembers.filter(m => m.role === 'student').map(st => (
                      <div key={st.uid} className="flex justify-between text-xs p-2 rounded bg-slate-800/30">
                        <span>{st.displayName}</span>
                        <div className="flex gap-1">
                          <button onClick={() => setAttMap(p => ({ ...p, [st.uid]: 'উপস্থিত' }))} className={`px-2 py-0.5 rounded ${attMap[st.uid] === 'উপস্থিত' ? 'bg-emerald-600 text-white' : 'bg-slate-700'}`}>উপস্থিত</button>
                          <button onClick={() => setAttMap(p => ({ ...p, [st.uid]: 'অনুপস্থিত' }))} className={`px-2 py-0.5 rounded ${attMap[st.uid] === 'অনুপস্থিত' ? 'bg-rose-600 text-white' : 'bg-slate-700'}`}>অনুপস্থিত</button>
                        </div>
                      </div>
                    ))}
                    <button onClick={handleSaveAttendance} className="w-full bg-emerald-600 text-white py-2 rounded-xl text-xs font-bold">সেভ করুন</button>
                  </div>
                )}
                {attendanceRecords.map(rec => (
                  <div key={rec.id} className={`p-3 rounded-2xl border text-xs ${cardBg}`}>
                    <div className="font-bold text-indigo-400 mb-1">তারিখ: {rec.date}</div>
                    <div className="flex flex-wrap gap-1">{(rec.records || []).map((r, i) => <span key={i} className="px-2 py-0.5 rounded-full bg-slate-800">{r.name}: {r.status}</span>)}</div>
                  </div>
                ))}
              </div>
            )}

            {groupSubTab === 'exams' && (
              <div className="space-y-3">
                {isTeacherOrHost && (
                  <form onSubmit={handleSaveClassExam} className={`p-4 rounded-2xl border space-y-2 ${cardBg}`}>
                    <input type="text" value={examForm.title} onChange={(e) => setExamForm({ ...examForm, title: e.target.value })} placeholder="পরীক্ষার নাম" className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                    <textarea rows="2" value={examForm.resultsText} onChange={(e) => setExamForm({ ...examForm, resultsText: e.target.value })} placeholder="ফলাফল..." className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                    <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold">প্রকাশ করুন</button>
                  </form>
                )}
                {classExams.map(ex => (
                  <div key={ex.id} className={`p-4 rounded-2xl border ${cardBg}`}>
                    <h4 className="font-bold text-sm text-indigo-300">{ex.title}</h4>
                    <p className="text-xs whitespace-pre-wrap mt-1">{ex.resultsText}</p>
                  </div>
                ))}
              </div>
            )}

            {groupSubTab === 'classes' && (
              <div className="space-y-3">
                {isTeacherOrHost && (
                  <form onSubmit={handleAddRecordedClass} className={`p-4 rounded-2xl border space-y-2 ${cardBg}`}>
                    <input type="text" value={classForm.title} onChange={(e) => setClassForm({ ...classForm, title: e.target.value })} placeholder="ভিডিওর শিরোনাম" className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                    <input type="url" value={classForm.videoUrl} onChange={(e) => setClassForm({ ...classForm, videoUrl: e.target.value })} placeholder="YouTube / Drive লিংক" className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                    <button type="submit" className="bg-violet-600 text-white px-4 py-2 rounded-xl text-xs font-bold">যুক্ত করুন</button>
                  </form>
                )}
                {recordedClasses.map(rc => (
                  <div key={rc.id} className={`p-4 rounded-2xl border flex justify-between items-center ${cardBg}`}>
                    <h4 className="font-bold text-sm">{rc.title}</h4>
                    <a href={rc.videoUrl} target="_blank" rel="noreferrer" className="bg-violet-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl">ভিডিও দেখুন</a>
                  </div>
                ))}
              </div>
            )}

            {groupSubTab === 'leaderboard' && (
              <div className={`p-4 rounded-2xl border space-y-2 ${cardBg}`}>
                <h3 className="text-sm font-bold text-amber-400">🏆 লিডারবোর্ড</h3>
                {[...groupMembers].sort((a, b) => (b.xp || 0) - (a.xp || 0)).map((m, i) => (
                  <div key={m.uid} className="flex justify-between p-2 rounded-xl bg-slate-800/40 text-xs">
                    <span>#{i + 1} {m.displayName}</span>
                    <span className="font-bold text-amber-300">{m.xp || 150} XP</span>
                  </div>
                ))}
              </div>
            )}

            {groupSubTab === 'manage' && isTeacherOrHost && (
              <div className="space-y-3">
                <form onSubmit={handleCreateGroup} className={`p-4 rounded-2xl border space-y-2 ${cardBg}`}>
                  <h3 className="text-sm font-bold text-emerald-400">নতুন গ্রুপ তৈরি</h3>
                  <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="গ্রুপের নাম" className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                  <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold">তৈরি করুন</button>
                </form>
                {isHost && allUsers.map(u => (
                  <div key={u.uid} className={`p-3 rounded-xl border flex justify-between items-center text-xs ${cardBg}`}>
                    <span>{u.displayName} ({u.role})</span>
                    {!HOST_EMAILS.includes(u.email?.toLowerCase()) && (
                      <button onClick={() => handleToggleUserRole(u, u.role === 'teacher' ? 'student' : 'teacher')} className="bg-indigo-600 text-white px-2.5 py-1 rounded-lg font-bold">
                        {u.role === 'teacher' ? 'Student করুন' : 'Teacher বানান'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* ট্যাব ৩: AI QUIZ, 1v1 QUIZ BATTLE & ANTI-CHEATING EXAM MODE */}
        {activeTab === 'exam' && (
          <div className="space-y-4">
            <div className={`p-4 rounded-2xl border space-y-3 ${cardBg}`}>
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-base flex items-center gap-2"><HelpCircle className="w-5 h-5 text-indigo-400" /> AI Practice Quiz ও 1v1 Battle</h2>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setBattleMode(!battleMode)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 ${battleMode ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-300'}`}
                  >
                    <Swords className="w-3.5 h-3.5" /> 1v1 Battle
                  </button>
                  <button
                    onClick={() => setAntiCheatMode(!antiCheatMode)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 ${antiCheatMode ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                  >
                    <Shield className="w-3.5 h-3.5" /> Anti-Cheat
                  </button>
                </div>
              </div>

              {antiCheatMode && (
                <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 flex justify-between">
                  <span>🛡️ অ্যান্টি-চিটিং এক্সাম মোড সক্রিয়</span>
                  <strong>সতর্কতা: {cheatWarnings}</strong>
                </div>
              )}

              <div className="flex gap-2">
                <input type="text" value={examTopic} onChange={(e) => setExamTopic(e.target.value)} placeholder="অধ্যায়ের নাম লিখুন..." className={`flex-1 rounded-xl border px-3.5 py-2.5 text-sm outline-none ${inputBg}`} />
                <button onClick={handleGenerateQuiz} disabled={loadingQuiz || !examTopic.trim()} className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">{loadingQuiz ? '...' : 'শুরু'}</button>
              </div>
            </div>

            {quizQuestions.length > 0 && !quizFinished && (
              <div className={`p-5 rounded-2xl border space-y-4 ${cardBg}`}>
                <div className="flex justify-between text-xs font-semibold text-indigo-400">
                  <span>প্রশ্ন {currentQIndex + 1} / {quizQuestions.length}</span>
                  <span>{battleMode ? `⚔️ আপনি: ${quizScore} | প্রতিদ্বন্দ্বী: ${rivalScore}` : `স্কোর: ${quizScore}`}</span>
                </div>
                <h3 className="font-bold text-base">{quizQuestions[currentQIndex].question}</h3>
                <div className="space-y-2">
                  {quizQuestions[currentQIndex].options.map((opt, idx) => {
                    const isCorrect = idx === quizQuestions[currentQIndex].correctIndex;
                    const isSelected = idx === selectedOption;
                    let btnStyle = darkMode ? 'bg-[#1a2236] border-slate-700' : 'bg-slate-50 border-slate-200';
                    if (selectedOption !== null) {
                      if (isCorrect) btnStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-semibold';
                      else if (isSelected) btnStyle = 'bg-rose-500/20 border-rose-500 text-rose-300';
                    }
                    return (
                      <button key={idx} onClick={() => handleOptionSelect(idx)} disabled={selectedOption !== null} className={`w-full text-left p-3.5 rounded-xl border text-sm flex justify-between ${btnStyle}`}>
                        <span>{opt}</span>
                        {selectedOption !== null && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        {selectedOption !== null && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-rose-400" />}
                      </button>
                    );
                  })}
                </div>
                {selectedOption !== null && (
                  <>
                    <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs"><strong className="text-indigo-300">ব্যাখ্যা: </strong>{cleanAiOutput(quizQuestions[currentQIndex].explanation)}</div>
                    <button onClick={() => currentQIndex + 1 < quizQuestions.length ? (setCurrentQIndex(i => i + 1), setSelectedOption(null)) : setQuizFinished(true)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm">{currentQIndex + 1 === quizQuestions.length ? 'ফলাফল দেখুন' : 'পরবর্তী প্রশ্ন'}</button>
                  </>
                )}
              </div>
            )}

            {quizFinished && (
              <div className={`p-6 rounded-2xl border text-center space-y-3 ${cardBg}`}>
                <Award className="w-12 h-12 text-amber-400 mx-auto" />
                <h3 className="text-xl font-bold">
                  {battleMode ? (quizScore >= rivalScore ? `🏆 আপনি জয়ী! (${quizScore} - ${rivalScore})` : `⚔️ প্রতিদ্বন্দ্বী জয়ী (${quizScore} - ${rivalScore})`) : `স্কোর: ${quizScore} / ${quizQuestions.length}`}
                </h3>
                <button onClick={handleGenerateQuiz} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">আবার খেলুন</button>
              </div>
            )}
          </div>
        )}

        {/* ট্যাব ৪: TOOLS */}
        {activeTab === 'flashcards' && (
          <div className="space-y-4">
            <div className={`p-4 rounded-2xl border space-y-3 ${cardBg}`}>
              <h2 className="font-bold text-base flex items-center gap-2"><BookOpen className="w-5 h-5 text-emerald-400" /> AI স্টাডি জেনারেটর ও অডিও পডকাস্ট</h2>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'short_note', label: 'শর্ট নোট' },
                  { id: 'mind_map', label: 'Mind-Map' },
                  { id: 'mnemonics', label: 'Mnemonics' },
                  { id: 'lecture_notes', label: 'Lecture to Notes' },
                  { id: 'exam_suggestion', label: 'Exam Suggestion' },
                  { id: 'assignment_guide', label: 'Assignment Guide' },
                  { id: 'audio_podcast', label: '🎧 অডিও পডকাস্ট' },
                  { id: 'formula_sheet', label: 'সূত্র শিট' }
                ].map(t => (
                  <button key={t.id} onClick={() => setNoteType(t.id)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${noteType === t.id ? 'bg-emerald-600 text-white' : 'bg-slate-800/40 text-slate-400'}`}>{t.label}</button>
                ))}
              </div>
              <textarea rows="2" value={noteTopic} onChange={(e) => setNoteTopic(e.target.value)} placeholder="অধ্যায়ের নাম, লেকচার বা অ্যাসাইনমেন্টের বিষয় লিখুন..." className={`w-full rounded-xl border px-3 py-2 text-xs outline-none ${inputBg}`} />
              <button onClick={handleGenerateNotes} disabled={loadingNote} className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-bold">{loadingNote ? 'AI তৈরি করছে...' : '✨ তৈরি করুন'}</button>
              {generatedNote && (
                <div className="p-3 rounded-xl bg-slate-800/40 text-xs whitespace-pre-wrap space-y-2">
                  <p>{generatedNote}</p>
                  <div className="flex gap-3 pt-1">
                    <button onClick={() => handleSpeakText(generatedNote)} className="inline-flex items-center gap-1 text-indigo-400 font-bold"><Headphones className="w-3.5 h-3.5" /> শুনুন</button>
                    <button onClick={() => handleSaveAnswer(noteTopic || noteType, generatedNote)} className="inline-flex items-center gap-1 text-amber-400 font-bold"><Bookmark className="w-3.5 h-3.5" /> Save</button>
                    <button onClick={() => { navigator.clipboard.writeText(generatedNote); showToast("কপি হয়েছে!"); }} className="inline-flex items-center gap-1 text-emerald-400 font-bold"><Copy className="w-3.5 h-3.5" /> কপি</button>
                  </div>
                </div>
              )}
            </div>

            <div className={`p-4 rounded-2xl border space-y-2.5 ${cardBg}`}>
              <h3 className="text-sm font-bold text-sky-400 flex items-center gap-1.5"><Calculator className="w-4 h-4" /> সায়েন্টিফিক ক্যালকুলেটর ও ফর্মুলা শিট</h3>
              <div className="text-[11px] text-slate-400 bg-slate-800/40 p-2 rounded-xl">
                সূত্র: (a+b)² = a²+2ab+b² • sin²θ+cos²θ = 1 • v = u+at • E = mc²
              </div>
              <div className="flex gap-2">
                <input type="text" value={calcInput} onChange={(e) => setCalcInput(e.target.value)} placeholder="যেমন: sin(0.5) + sqrt(144) + 2^3" className={`flex-1 rounded-xl border px-3 py-2 text-xs outline-none ${inputBg}`} />
                <button onClick={handleEvalCalculator} className="bg-sky-600 text-white px-4 py-2 rounded-xl text-xs font-bold">=</button>
              </div>
              <div className="text-sm font-extrabold text-sky-300">ফলাফল: {calcResult}</div>
            </div>

            <div className={`p-4 rounded-2xl border space-y-2.5 ${cardBg}`}>
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-violet-400 flex items-center gap-1.5"><PenTool className="w-4 h-4" /> স্মার্ট হোয়াইটবোর্ড (রাফ খাতা)</h3>
                <button onClick={() => setShowWhiteboard(!showWhiteboard)} className="text-xs bg-violet-600/20 text-violet-300 px-2.5 py-1 rounded-lg font-bold">
                  {showWhiteboard ? 'লুকান' : 'বোর্ড খুলুন'}
                </button>
              </div>
              {showWhiteboard && (
                <div className="space-y-2">
                  <canvas
                    ref={canvasRef}
                    width={320}
                    height={170}
                    style={{ touchAction: 'none' }}
                    className="w-full bg-slate-950 rounded-xl border border-slate-700"
                    onMouseDown={(e) => { isDrawingRef.current = true; const r = canvasRef.current.getBoundingClientRect(); const ctx = canvasRef.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(e.clientX - r.left, e.clientY - r.top); }}
                    onMouseMove={(e) => { if (!isDrawingRef.current) return; const r = canvasRef.current.getBoundingClientRect(); const ctx = canvasRef.current.getContext('2d'); ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2.5; ctx.lineTo(e.clientX - r.left, e.clientY - r.top); ctx.stroke(); }}
                    onMouseUp={() => { isDrawingRef.current = false; }}
                    onTouchStart={(e) => { isDrawingRef.current = true; const r = canvasRef.current.getBoundingClientRect(); const t = e.touches[0]; const ctx = canvasRef.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(t.clientX - r.left, t.clientY - r.top); }}
                    onTouchMove={(e) => { if (!isDrawingRef.current) return; const r = canvasRef.current.getBoundingClientRect(); const t = e.touches[0]; const ctx = canvasRef.current.getContext('2d'); ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2.5; ctx.lineTo(t.clientX - r.left, t.clientY - r.top); ctx.stroke(); }}
                    onTouchEnd={() => { isDrawingRef.current = false; }}
                  />
                  <button onClick={() => canvasRef.current?.getContext('2d').clearRect(0, 0, 320, 170)} className="text-xs text-rose-400 font-bold">বোর্ড পরিষ্কার করুন</button>
                </div>
              )}
            </div>

            <div className={`p-4 rounded-2xl border ${cardBg}`}>
              <h2 className="font-bold text-base flex items-center gap-2 mb-3"><Layers className="w-5 h-5 text-violet-400" /> AI Smart Flashcards</h2>
              <div className="flex gap-2 mb-3">
                <input type="text" value={flashTopic} onChange={(e) => setFlashTopic(e.target.value)} placeholder="বিষয়ের নাম লিখুন..." className={`flex-1 rounded-xl border px-3.5 py-2 text-xs outline-none ${inputBg}`} />
                <button onClick={handleGenerateFlashcards} disabled={loadingFlash} className="bg-violet-600 text-white px-4 py-2 rounded-xl text-xs font-semibold">{loadingFlash ? '...' : 'তৈরি'}</button>
              </div>
              {flashcards.length > 0 && (
                <div className="space-y-2">
                  <div onClick={() => setIsFlipped(!isFlipped)} className={`min-h-[130px] p-5 rounded-2xl border-2 cursor-pointer flex flex-col items-center justify-center text-center ${isFlipped ? 'border-violet-500 bg-violet-600/15' : cardBg}`}>
                    <span className="text-[11px] font-bold text-violet-400 mb-1">{isFlipped ? 'উত্তর' : `কার্ড ${cardIndex + 1} / ${flashcards.length} (ট্যাপ করুন)`}</span>
                    <p className="text-sm font-semibold">{cleanAiOutput(isFlipped ? flashcards[cardIndex].back : flashcards[cardIndex].front)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setIsFlipped(false); setCardIndex(p => p === 0 ? flashcards.length - 1 : p - 1); }} className={`flex-1 py-2 rounded-xl border text-xs font-semibold ${cardBg}`}>আগেরটি</button>
                    <button onClick={() => { setIsFlipped(false); setCardIndex(p => (p + 1) % flashcards.length); }} className={`flex-1 py-2 rounded-xl border text-xs font-semibold ${cardBg}`}>পরেরটি</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* ট্যাব ৫: MY ID */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              <div className={`p-2.5 rounded-2xl border text-center ${cardBg}`}><Trophy className="w-4 h-4 text-amber-400 mx-auto mb-1" /><div className="text-sm font-bold">{xp}</div><div className="text-[9px] text-slate-400">মোট XP</div></div>
              <div className={`p-2.5 rounded-2xl border text-center ${cardBg}`}><ClipboardCheck className="w-4 h-4 text-emerald-400 mx-auto mb-1" /><div className="text-sm font-bold">{myAttendancePercent}%</div><div className="text-[9px] text-slate-400">উপস্থিতি</div></div>
              <div className={`p-2.5 rounded-2xl border text-center ${cardBg}`}><GraduationCap className="w-4 h-4 text-sky-400 mx-auto mb-1" /><div className="text-sm font-bold">{syllabusProgressPct}%</div><div className="text-[9px] text-slate-400">সিলেবাস</div></div>
              <div className={`p-2.5 rounded-2xl border text-center ${cardBg}`}><Shield className="w-4 h-4 text-indigo-400 mx-auto mb-1" /><div className="text-xs font-bold uppercase">{currentRole}</div><div className="text-[9px] text-slate-400">মোড</div></div>
            </div>

            <div className={`p-4 rounded-2xl border space-y-2.5 ${cardBg}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-1.5"><Target className="w-4 h-4" /> Exam Countdown ও AI প্ল্যানার</h3>
                {daysToTargetExam !== null && <span className="bg-rose-500/20 text-rose-300 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">বাকি {daysToTargetExam} দিন</span>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={targetExam.name} onChange={(e) => setTargetExam({ ...targetExam, name: e.target.value })} placeholder="পরীক্ষার নাম" className={`rounded-xl border px-3 py-1.5 text-xs ${inputBg}`} />
                <input type="date" value={targetExam.date} onChange={(e) => setTargetExam({ ...targetExam, date: e.target.value })} className={`rounded-xl border px-3 py-1.5 text-xs ${inputBg}`} />
              </div>
              <button onClick={handleGenerateStudyPlan} disabled={loadingPlan} className="w-full bg-indigo-600 text-white py-2 rounded-xl text-xs font-bold">
                {loadingPlan ? 'AI রুটিন তৈরি করছে...' : '✨ AI দিয়ে প্রস্তুতির রুটিন বানান'}
              </button>
              {studyPlan && <div className="p-3 rounded-xl bg-slate-800/40 text-xs whitespace-pre-wrap">{studyPlan}</div>}
            </div>

            <div className={`p-4 rounded-2xl border space-y-2.5 ${cardBg}`}>
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-sky-400">📚 Syllabus Progress ও স্পেসড রিভিশন</h3>
                <span className="text-xs font-bold text-sky-300">{syllabusProgressPct}%</span>
              </div>
              <div className="flex gap-2">
                <input type="text" value={syllabusInput} onChange={(e) => setSyllabusInput(e.target.value)} placeholder="নতুন অধ্যায় যোগ করুন..." className={`flex-1 rounded-xl border px-3 py-1.5 text-xs outline-none ${inputBg}`} />
                <button
                  onClick={() => {
                    if (!syllabusInput.trim()) return;
                    setSyllabusItems([...syllabusItems, { id: Date.now(), title: syllabusInput.trim(), done: false, nextRevision: '৩ ও ৭ দিন পর' }]);
                    setSyllabusInput('');
                  }}
                  className="bg-sky-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold"
                >
                  + যোগ
                </button>
              </div>
              {syllabusItems.map(item => (
                <div key={item.id} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-800/30">
                  <button
                    onClick={() => {
                      setSyllabusItems(syllabusItems.map(s => s.id === item.id ? { ...s, done: !s.done, nextRevision: !s.done ? '৭ দিন পর রিভিশন' : 'আগামীকাল' } : s));
                      if (!item.done) addXp(15);
                    }}
                    className={`flex items-center gap-2 text-left flex-1 ${item.done ? 'line-through text-slate-400' : ''}`}
                  >
                    <CheckCircle2 className={`w-4 h-4 shrink-0 ${item.done ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span>{item.title}</span>
                  </button>
                  <span className="text-[10px] text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full">⏰ {item.nextRevision}</span>
                </div>
              ))}
            </div>

            <div className={`p-4 rounded-2xl border space-y-2.5 ${cardBg}`}>
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-1.5"><Bookmark className="w-4 h-4" /> Saved Answers ({savedAnswers.length}টি)</h3>
              {savedAnswers.length === 0 ? <p className="text-xs text-slate-400">AI-এর যেকোনো গুরুত্বপূর্ণ উত্তরে Save চাপলে এখানে জমা থাকবে।</p> : savedAnswers.map(sa => (
                <div key={sa.id} className="p-3 rounded-xl bg-slate-800/40 text-xs space-y-1">
                  <div className="flex justify-between font-bold text-amber-300">
                    <span>{sa.title} ({sa.date})</span>
                    <button onClick={() => setSavedAnswers(savedAnswers.filter(x => x.id !== sa.id))} className="text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <p className="whitespace-pre-wrap text-slate-200">{sa.text}</p>
                </div>
              ))}
            </div>

            <div className={`p-4 rounded-2xl border space-y-2.5 ${cardBg}`}>
              <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5"><CheckSquare className="w-4 h-4" /> আজকের পড়ার লক্ষ্য (+15 XP)</h3>
              <form onSubmit={handleAddTodo} className="flex gap-2">
                <input type="text" value={todoInput} onChange={(e) => setTodoInput(e.target.value)} placeholder="নতুন টার্গেট লিখুন..." className={`flex-1 rounded-xl border px-3 py-1.5 text-xs outline-none ${inputBg}`} />
                <button type="submit" className="bg-emerald-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold"><Plus className="w-4 h-4" /></button>
              </form>
              <div className="space-y-1.5">
                {todos.map(t => (
                  <div key={t.id} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-800/30">
                    <button onClick={() => handleToggleTodo(t.id)} className={`flex items-center gap-2 text-left flex-1 ${t.done ? 'line-through text-slate-500' : ''}`}><CheckCircle2 className={`w-4 h-4 shrink-0 ${t.done ? 'text-emerald-400' : 'text-slate-500'}`} /><span>{t.text}</span></button>
                    <button onClick={() => setTodos(prev => prev.filter(item => item.id !== t.id))} className="text-rose-400 ml-2"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>

            {user ? (
              <form onSubmit={handleSaveProfile} className={`p-4 rounded-2xl border space-y-3 ${cardBg}`}>
                <h2 className="font-bold text-base flex items-center gap-2"><Edit3 className="w-4 h-4 text-indigo-400" /> প্রোফাইল ও ছবি Edit করুন</h2>
                <div className="flex items-center gap-4">
                  <img src={editPhoto || '/logo.png'} alt="Profile" className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500 bg-white" />
                  <label className="bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer">নতুন ছবি দিন<input type="file" accept="image/*" onChange={handleProfilePhotoChange} className="hidden" /></label>
                </div>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="আপনার নাম" className={`w-full rounded-xl border px-3 py-2 text-sm ${inputBg}`} />
                <input type="text" value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="পরিচিতি / শ্রেণি (Bio)" className={`w-full rounded-xl border px-3 py-2 text-sm ${inputBg}`} />
                <button type="submit" disabled={savingProfile} className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-bold">{savingProfile ? 'সেভ হচ্ছে...' : 'প্রোফাইল সেভ করুন'}</button>
              </form>
            ) : (
              <div className={`p-6 rounded-2xl border text-center space-y-3 ${cardBg}`}><p className="text-sm">প্রোফাইল ও ক্লাসরুম ব্যবহার করতে Google Sign In করুন।</p><button onClick={handleGoogleSignIn} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold">Google Sign In</button></div>
            )}

            {mistakes.length > 0 && (
              <div className={`p-4 rounded-2xl border space-y-2.5 ${cardBg}`}>
                <h3 className="text-sm font-bold text-rose-400 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> ভুল প্রশ্নের খাতা ({mistakes.length}টি)</h3>
                {mistakes.map(m => (
                  <div key={m.id} className="p-3 rounded-xl bg-slate-800/40 text-xs space-y-1">
                    <p className="font-bold">{m.question}</p><p className="text-rose-400">আপনার উত্তর: {m.yourAnswer}</p><p className="text-emerald-400">সঠিক উত্তর: {m.correctAnswer}</p>
                    {m.explanation && <p className="text-slate-300 pt-1">{cleanAiOutput(m.explanation)}</p>}
                    <button onClick={() => handleExplainMistake(m)} className="text-indigo-400 font-bold pt-1">{explainingMistakeId === m.id ? 'AI লিখছে...' : '✨ AI দিয়ে সহজে বুঝুন'}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* বটম নেভিগেশন বার */}
      <nav className={`fixed bottom-0 inset-x-0 z-30 border-t backdrop-blur-xl ${darkMode ? 'bg-[#0b0f19]/90 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
        <div className="max-w-3xl mx-auto grid grid-cols-5 py-1.5">
          {[
            { id: 'tutor', label: 'AI Studio', icon: Brain },
            { id: 'classroom', label: 'Classroom', icon: Users, badge: unreadNoticeCount },
            { id: 'exam', label: 'Quiz & 1v1', icon: HelpCircle },
            { id: 'flashcards', label: 'Tools', icon: Layers },
            { id: 'profile', label: 'My ID', icon: Edit3 }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === 'classroom') setUnreadNoticeCount(0); }} className={`relative flex flex-col items-center justify-center py-1.5 text-[11px] font-medium ${isActive ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}>
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-indigo-400' : ''}`} />
                {tab.badge > 0 && <span className="absolute top-1 right-5 bg-rose-500 text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">{tab.badge}</span>}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
