import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Send, Brain, Trophy, Sun, Moon, BookOpen,
  Layers, CheckCircle2, XCircle, Trash2, Zap, Award,
  Flame, HelpCircle, RefreshCw, Users, LogIn, LogOut,
  MessageSquare, Image as ImageIcon, Shield, UserCheck,
  Bell, BellRing, Video, ClipboardCheck, Edit3, Camera, Lock, Check,
  X, Mic, Volume2, Pin, BarChart2, Clock, Play, Pause, RotateCcw,
  FileCheck, AlertTriangle, Copy, Medal
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
          icon: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png',
          vibrate: [200, 100, 200]
        });
        return;
      }
    }
    new Notification(title, {
      body,
      icon: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png'
    });
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
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)') .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)')
    .replace(/^#{1,6}\s*/gm, '▸ ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
  return text.trim();
};

const compressImageToBase64 = (file, maxWidth = 700, quality = 0.65) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const callGeminiFast = async (prompt, systemInstruction = "", base64Image = null, isJson = false) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("API Key পাওয়া যায়নি। Vercel Environment Variables চেক করুন।");
  }

  const models = ["gemini-3.8-flash", "gemini-2.5-flash"];
  const strictRules = isJson
    ? systemInstruction
    : `${systemInstruction} গুরুত্বপূর্ণ নিয়ম: কোনো উত্তরে Markdown (**, ###) বা LaTeX ($, $$) চিহ্ন ব্যবহার করবে না। গণিতের সূত্র সাধারণ টেক্সট ও ইউনিকোড চিহ্নে (যেমন: a² - b², ×, ÷, √) লিখবে। বাংলা শব্দের বানান শতভাগ শুদ্ধ রাখবে, বাংলার ভেতর ইংরেজি অক্ষর মেশাবে না।`;

  const parts = [{ text: prompt }];
  if (base64Image) {
    const cleanBase64 = base64Image.split(',')[1];
    const mimeType = base64Image.split(';')[0].split(':')[1] || 'image/jpeg';
    parts.push({ inlineData: { mimeType, data: cleanBase64 } });
  }

  let lastError = "";
  for (const model of models) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
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
  const [streak] = useState(() => Number(localStorage.getItem('edunexus_streak')) || 3);
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  const [tutorMode, setTutorMode] = useState('Friendly Tutor');
  const defaultWelcomeMsg = [
    {
      id: 1,
      sender: 'ai',
      text: 'স্বাগতম! আমি EduNexus AI। প্রশ্ন লিখতে পারো, মাইক চেপে মুখে বলতে পারো অথবা অঙ্কের ছবি তুলে পাঠালেই আমি সমাধান করে দেব!',
      time: 'Now'
    }
  ];
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('edunexus_chat_history');
    return saved ? JSON.parse(saved) : defaultWelcomeMsg;
  });
  const [inputMsg, setInputMsg] = useState('');
  const [tutorImage, setTutorImage] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const chatEndRef = useRef(null);

  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('global');
  const [groupSubTab, setGroupSubTab] = useState('chat');

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSubject, setNewGroupSubject] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');

  const [groupMsgs, setGroupMsgs] = useState([]);
  const [commInput, setCommInput] = useState('');
  const [commImage, setCommImage] = useState(null);
  const [sendingComm, setSendingComm] = useState(false);
  const commEndRef = useRef(null);

  const [notices, setNotices] = useState([]);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [polls, setPolls] = useState([]);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOpt1, setPollOpt1] = useState('');
  const [pollOpt2, setPollOpt2] = useState('');

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

  const [examTopic, setExamTopic] = useState('');
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

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

  // নতুন ফিচার স্টেট: AI Notes জেনারেটর ও Mistake Log
  const [noteTopic, setNoteTopic] = useState('');
  const [generatedNote, setGeneratedNote] = useState('');
  const [loadingNote, setLoadingNote] = useState(false);
  const [mistakes, setMistakes] = useState(() => {
    const saved = localStorage.getItem('edunexus_mistakes');
    return saved ? JSON.parse(saved) : [];
  });
  const [explainingMistakeId, setExplainingMistakeId] = useState(null);

  const isHost = user && HOST_EMAILS.includes(user.email?.toLowerCase());
  const currentRole = isHost ? 'host' : (userProfile?.role || 'student');
  const isTeacherOrHost = currentRole === 'host' || currentRole === 'teacher';
  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) {
      alert("আপনার ব্রাউজারে নোটিফিকেশন সমর্থিত নয়। Chrome ব্যবহার করুন বা অ্যাপটি হোম স্ক্রিনে Install করুন।");
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      triggerDeviceNotification('EduNexus AI নোটিফিকেশন চালু হয়েছে!', 'এখন থেকে নতুন ক্লাস নোটিশ এলেই আপনি অ্যালার্ট পাবেন।');
    } else {
      alert("নোটিফিকেশন চালু করতে ব্রাউজার সেটিংস থেকে Allow দিন।");
    }
  };

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          setXp((x) => x + 50);
          triggerDeviceNotification('স্টাডি সেশন সম্পন্ন!', 'আপনি +50 Bonus XP অর্জন করেছেন!');
          return 25 * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

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
      unsubChat(); unsubNotices(); unsubPolls(); unsubHw();
      unsubAtt(); unsubExams(); unsubClasses();
    };
  }, [selectedGroupId]);
  useEffect(() => {
    localStorage.setItem('edunexus_xp', xp.toString());
    if (user) {
      updateDoc(doc(db, 'users', user.uid), { xp }).catch(() => {});
    }
  }, [xp, user]);

  useEffect(() => {
    localStorage.setItem('edunexus_chat_history', JSON.stringify(messages));
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    commEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [groupMsgs]);

  useEffect(() => {
    localStorage.setItem('edunexus_flashcards', JSON.stringify(flashcards));
  }, [flashcards]);

  useEffect(() => {
    localStorage.setItem('edunexus_mistakes', JSON.stringify(mistakes));
  }, [mistakes]);

  const addXp = (amount) => setXp((prev) => prev + amount);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      addXp(50);
    } catch (err) {
      alert("Google Sign-In ত্রুটি: " + err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("আপনার ব্রাউজারে ভয়েস টাইপিং সমর্থিত নয়। Chrome ব্যবহার করুন।");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'bn-BD';
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
    utterance.lang = 'bn-BD';
    window.speechSynthesis.speak(utterance);
  };

  const handleTutorImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageToBase64(file, 800, 0.7);
    setTutorImage(compressed);
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if ((!inputMsg.trim() && !tutorImage) || isTyping) return;

    const userText = inputMsg.trim() || "এই ছবির প্রশ্ন বা অঙ্কটি ধাপে ধাপে সমাধান করে বুঝিয়ে দাও।";
    const imageToSend = tutorImage;
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const updatedMessages = [
      ...messages,
      { id: Date.now(), sender: 'user', text: userText, image: imageToSend, time: now }
    ];
    setMessages(updatedMessages);
    setInputMsg('');
    setTutorImage(null);
    setIsTyping(true);

    const recentHistory = updatedMessages
      .slice(-4)
      .map((m) => `${m.sender === 'user' ? 'Student' : 'Tutor'}: ${m.text}`)
      .join('\n');

    const systemPrompts = {
      'Friendly Tutor': 'তুমি একজন বন্ধুত্বপূর্ণ শিক্ষক। সহজ ও শুদ্ধ বাংলায় উদাহরণসহ স্পষ্টভাবে উত্তর দাও।',
      'Exam Coach': 'তুমি একজন বোর্ড পরীক্ষার কোচ। পরীক্ষায় পুরো নম্বর পাওয়ার উপযোগী পয়েন্ট আকারে শুদ্ধ বাংলায় উত্তর দাও।',
      'Step-by-Step Math': 'তুমি একজন গণিত ও বিজ্ঞান বিশেষজ্ঞ। ছবি বা প্রশ্নের প্রতিটি অঙ্ক ধাপে ধাপে সূত্রসহ সমাধান করো।'
    };

    try {
      const reply = await callGeminiFast(
        `আগের কথোপকথন:\n${recentHistory}\n\nবর্তমান প্রশ্ন: ${userText}`,
        systemPrompts[tutorMode],
        imageToSend,
        false
      );
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      addXp(15);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, sender: 'ai', text: `⚠️ ${err.message}`, time: now }
      ]);
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

  const handleGenerateNotes = async () => {
    if (!noteTopic.trim()) return;
    setLoadingNote(true);
    try {
      const reply = await callGeminiFast(
        `"${noteTopic}" বিষয়ের ওপর পরীক্ষার প্রস্তুতির জন্য একটি গোছানো শর্ট নোট তৈরি করো (মূল সংজ্ঞা, গুরুত্বপূর্ণ সূত্র ও ৩টি সংক্ষিপ্ত প্রশ্নোত্তরসহ)।`,
        "তুমি একজন অভিজ্ঞ শিক্ষক। স্পষ্ট পয়েন্ট আকারে শুদ্ধ বাংলায় শর্ট নোট তৈরি করো।"
      );
      setGeneratedNote(reply);
      addXp(25);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingNote(false);
    }
  };

  const handleExplainMistake = async (m) => {
    setExplainingMistakeId(m.id);
    try {
      const exp = await callGeminiFast(
        `প্রশ্ন: "${m.question}"। শিক্ষার্থী ভুল করে "${m.yourAnswer}" দিয়েছে, সঠিক উত্তর "${m.correctAnswer}"। কেন সঠিক উত্তরটি ঠিক তা ২-৩ লাইনে খুব সহজে বুঝিয়ে দাও।`,
        "সহজ ও বন্ধুত্বপূর্ণ বাংলায় ব্যাখ্যা দাও।"
      );
      setMistakes(prev => prev.map(item => item.id === m.id ? { ...item, explanation: exp } : item));
    } finally {
      setExplainingMistakeId(null);
    }
  };
  const handleRequestTeacher = async () => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), { teacherRequest: true });
    alert("আপনার Teacher হওয়ার আবেদন Host-এর কাছে পাঠানো হয়েছে!");
  };

  const handleToggleUserRole = async (targetUser, newRole) => {
    if (!isHost) return;
    await updateDoc(doc(db, 'users', targetUser.uid), { role: newRole, teacherRequest: false });
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!isTeacherOrHost || !newGroupName.trim()) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const docRef = await addDoc(collection(db, 'study_groups'), {
      name: newGroupName.trim(),
      subject: newGroupSubject.trim() || 'General',
      inviteCode: code,
      teacherId: user.uid,
      teacherName: userProfile?.displayName || user.displayName,
      members: [user.uid],
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, 'users', user.uid), { joinedGroups: arrayUnion(docRef.id) });
    setNewGroupName('');
    setNewGroupSubject('');
    setSelectedGroupId(docRef.id);
    alert(`নতুন গ্রুপ তৈরি হয়েছে! স্টুডেন্টদের জয়েন কোড: ${code}`);
  };

  const handleJoinGroupByCode = async (e) => {
    e.preventDefault();
    if (!user || !joinCodeInput.trim()) return;
    const found = groups.find(g => g.inviteCode === joinCodeInput.trim().toUpperCase());
    if (!found) {
      alert("ভুল ইনভাইট কোড! টিচারের কাছ থেকে সঠিক কোড নিন।");
      return;
    }
    await updateDoc(doc(db, 'study_groups', found.id), { members: arrayUnion(user.uid) });
    await updateDoc(doc(db, 'users', user.uid), { joinedGroups: arrayUnion(found.id) });
    setSelectedGroupId(found.id);
    setJoinCodeInput('');
    alert(`আপনি "${found.name}" গ্রুপে যুক্ত হয়েছেন!`);
  };

  const handleCommImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageToBase64(file, 650, 0.6);
    setCommImage(compressed);
  };

  const handleSendGroupMsg = async (e) => {
    e.preventDefault();
    if ((!commInput.trim() && !commImage) || sendingComm) return;
    if (!user) { handleGoogleSignIn(); return; }
    setSendingComm(true);
    const textToSend = commInput.trim();
    const imgToSend = commImage;
    setCommInput('');
    setCommImage(null);
    try {
      await addDoc(collection(db, 'group_messages'), {
        groupId: selectedGroupId,
        text: textToSend,
        image: imgToSend || '',
        uid: user.uid,
        userName: userProfile?.displayName || user.displayName || 'Student',
        userPhoto: userProfile?.photoURL || user.photoURL || '',
        senderRole: currentRole,
        pinned: false,
        likes: [],
        clientTime: Date.now(),
        timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      addXp(5);
    } finally {
      setSendingComm(false);
    }
  };

  const handleTogglePinMsg = async (msg) => {
    if (!isTeacherOrHost) return;
    await updateDoc(doc(db, 'group_messages', msg.id), { pinned: !msg.pinned });
  };

  const handleLikeMsg = async (msg) => {
    if (!user) return;
    const currentLikes = msg.likes || [];
    const updated = currentLikes.includes(user.uid)
      ? currentLikes.filter(id => id !== user.uid)
      : [...currentLikes, user.uid];
    await updateDoc(doc(db, 'group_messages', msg.id), { likes: updated });
  };

  const handlePostNotice = async (e) => {
    e.preventDefault();
    if (!isTeacherOrHost || !noticeTitle.trim() || !noticeBody.trim()) return;
    await addDoc(collection(db, 'group_notices'), {
      groupId: selectedGroupId,
      title: noticeTitle.trim(),
      body: noticeBody.trim(),
      authorName: userProfile?.displayName || user.displayName,
      authorRole: currentRole,
      clientTime: Date.now(),
      dateStr: new Date().toLocaleDateString('bn-BD')
    });
    setNoticeTitle('');
    setNoticeBody('');
  };

  const handleCreatePoll = async (e) => {
    e.preventDefault();
    if (!isTeacherOrHost || !pollQuestion.trim() || !pollOpt1.trim() || !pollOpt2.trim()) return;
    await addDoc(collection(db, 'group_polls'), {
      groupId: selectedGroupId,
      question: pollQuestion.trim(),
      opt1: pollOpt1.trim(),
      opt2: pollOpt2.trim(),
      votes1: [],
      votes2: [],
      authorName: userProfile?.displayName || user.displayName,
      clientTime: Date.now()
    });
    setPollQuestion(''); setPollOpt1(''); setPollOpt2('');
  };

  const handleVotePoll = async (poll, optionNum) => {
    if (!user) return;
    const v1 = (poll.votes1 || []).filter(id => id !== user.uid);
    const v2 = (poll.votes2 || []).filter(id => id !== user.uid);
    if (optionNum === 1) v1.push(user.uid);
    else v2.push(user.uid);
    await updateDoc(doc(db, 'group_polls', poll.id), { votes1: v1, votes2: v2 });
  };

  const handleAddHomework = async (e) => {
    e.preventDefault();
    if (!isTeacherOrHost || !hwTitle.trim()) return;
    await addDoc(collection(db, 'group_homeworks'), {
      groupId: selectedGroupId,
      title: hwTitle.trim(),
      dueDate: hwDue || 'পরবর্তী ক্লাস',
      teacherName: userProfile?.displayName || user.displayName,
      completedBy: [],
      clientTime: Date.now()
    });
    setHwTitle(''); setHwDue('');
  };

  const handleToggleHomeworkDone = async (hw) => {
    if (!user) return;
    const list = hw.completedBy || [];
    const myName = userProfile?.displayName || user.displayName;
    const exists = list.some(item => item.uid === user.uid);
    const updated = exists
      ? list.filter(item => item.uid !== user.uid)
      : [...list, { uid: user.uid, name: myName }];
    await updateDoc(doc(db, 'group_homeworks', hw.id), { completedBy: updated });
    if (!exists) addXp(20);
  };

  const handleSaveAttendance = async () => {
    if (!isTeacherOrHost) return;
    const recordsArray = Object.entries(attMap).map(([uid, status]) => {
      const st = allUsers.find(u => u.uid === uid);
      return { uid, name: st?.displayName || 'Student', status };
    });
    if (recordsArray.length === 0) {
      alert("অন্তত একজন শিক্ষার্থীর উপস্থিতি বা অনুপস্থিতি নির্বাচন করুন।");
      return;
    }
    await addDoc(collection(db, 'group_attendance'), {
      groupId: selectedGroupId,
      date: attDate,
      takenBy: userProfile?.displayName || user.displayName,
      records: recordsArray
    });
    alert(`${attDate} তারিখের উপস্থিতি সেভ হয়েছে!`);
  };

  const handleSaveClassExam = async (e) => {
    e.preventDefault();
    if (!isTeacherOrHost || !examForm.title.trim()) return;
    const payload = {
      groupId: selectedGroupId,
      title: examForm.title.trim(),
      date: examForm.date,
      syllabus: examForm.syllabus.trim(),
      resultsText: examForm.resultsText.trim(),
      updatedBy: userProfile?.displayName || user.displayName,
      clientTime: Date.now()
    };
    if (editingExamId) {
      await updateDoc(doc(db, 'group_exams', editingExamId), payload);
      setEditingExamId(null);
    } else {
      await addDoc(collection(db, 'group_exams'), payload);
    }
    setExamForm({ title: '', date: '', syllabus: '', resultsText: '' });
  };

  const handleAddRecordedClass = async (e) => {
    e.preventDefault();
    if (!isTeacherOrHost || !classForm.title.trim() || !classForm.videoUrl.trim()) return;
    await addDoc(collection(db, 'recorded_classes'), {
      groupId: selectedGroupId,
      title: classForm.title.trim(),
      videoUrl: classForm.videoUrl.trim(),
      notes: classForm.notes.trim(),
      teacherName: userProfile?.displayName || user.displayName,
      clientTime: Date.now(),
      dateStr: new Date().toLocaleDateString('bn-BD')
    });
    setClassForm({ title: '', videoUrl: '', notes: '' });
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
      alert("আপনার প্রোফাইল আপডেট হয়েছে!");
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
    setSelectedOption(null);

    const prompt = `"${examTopic}" বিষয়ের ওপর ৫টি MCQ প্রশ্ন তৈরি করো শুদ্ধ বাংলায়। শুধুমাত্র JSON ফরম্যাটে উত্তর দেবে:
[{"question": "প্রশ্ন", "options": ["ক", "খ", "গ", "ঘ"], "correctIndex": 0, "explanation": "সংক্ষিপ্ত ব্যাখ্যা"}]`;

    try {
      const raw = await callGeminiFast(prompt, "Always respond with valid raw JSON array only.", null, true);
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) setQuizQuestions(parsed);
    } catch (err) {
      alert("কুইজ তৈরিতে সমস্যা: " + err.message);
    } finally {
      setLoadingQuiz(false);
    }
  };

  const handleOptionSelect = (idx) => {
    if (selectedOption !== null) return;
    setSelectedOption(idx);
    const currentQ = quizQuestions[currentQIndex];
    if (idx === currentQ.correctIndex) {
      setQuizScore((s) => s + 1);
      addXp(20);
    } else {
      setMistakes(prev => [{
        id: Date.now(),
        topic: examTopic,
        question: currentQ.question,
        yourAnswer: currentQ.options[idx],
        correctAnswer: currentQ.options[currentQ.correctIndex],
        explanation: currentQ.explanation
      }, ...prev]);
    }
  };

  const handleGenerateFlashcards = async () => {
    if (!flashTopic.trim()) return;
    setLoadingFlash(true);
    const prompt = `"${flashTopic}" বিষয়ের ওপর ৬টি ফ্ল্যাশকার্ড তৈরি করো শুদ্ধ বাংলায়। শুধুমাত্র JSON ফরম্যাটে উত্তর দেবে:
[{"front": "প্রশ্ন বা সূত্র", "back": "উত্তর বা সংজ্ঞা"}]`;
    try {
      const raw = await callGeminiFast(prompt, "Respond strictly with valid JSON array.", null, true);
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setFlashcards(parsed);
        setCardIndex(0);
        setIsFlipped(false);
        addXp(25);
      }
    } catch (err) {
      alert("ফ্ল্যাশকার্ড তৈরিতে সমস্যা: " + err.message);
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

  // নিজের উপস্থিতির হার (%) হিসাব
  const myTotalClasses = attendanceRecords.filter(rec => (rec.records || []).some(r => r.uid === user?.uid)).length;
  const myPresentClasses = attendanceRecords.filter(rec => (rec.records || []).some(r => r.uid === user?.uid && r.status === 'উপস্থিত')).length;
  const myAttendancePercent = myTotalClasses > 0 ? Math.round((myPresentClasses / myTotalClasses) * 100) : 100;

  const pinnedMessages = groupMsgs.filter(m => m.pinned);
  const formatTime = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

  const bgMain = darkMode ? 'bg-[#0b0f19] text-slate-100' : 'bg-slate-50 text-slate-900';
  const cardBg = darkMode ? 'bg-[#131a2b] border-slate-800' : 'bg-white border-slate-200 shadow-sm';
  const inputBg = darkMode ? 'bg-[#1a2236] border-slate-700 text-white placeholder-slate-400' : 'bg-slate-100 border-slate-300 text-slate-900';

  const roleBadge = () => {
    if (currentRole === 'host') return <span className="bg-amber-400 text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1"><Shield className="w-3 h-3" /> HOST</span>;
    if (currentRole === 'teacher') return <span className="bg-emerald-400 text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1"><UserCheck className="w-3 h-3" /> TEACHER</span>;
    return <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">STUDENT</span>;
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${bgMain}`}>
      <header className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white px-3 py-2.5 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-1.5 rounded-xl">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-base tracking-tight leading-none">EduNexus AI</h1>
                {user && roleBadge()}
              </div>
              <span className="text-[10px] text-indigo-200 font-medium">Smart Classroom OS</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleEnableNotifications}
              title={notifPermission === 'granted' ? 'নোটিফিকেশন চালু আছে' : 'নোটিফিকেশন চালু করুন'}
              className={`p-1.5 rounded-full transition ${
                notifPermission === 'granted'
                  ? 'bg-emerald-400/25 text-emerald-200'
                  : 'bg-amber-400 text-slate-950 animate-bounce'
              }`}
            >
              {notifPermission === 'granted' ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </button>

            <div className="flex items-center gap-1 bg-black/25 px-2 py-1 rounded-full text-[11px] font-mono">
              <Clock className="w-3 h-3 text-emerald-300" />
              <span>{formatTime(timerSeconds)}</span>
              <button onClick={() => setTimerRunning(!timerRunning)} className="text-amber-300 ml-0.5">
                {timerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
              <button onClick={() => { setTimerRunning(false); setTimerSeconds(25 * 60); }} className="text-slate-300">
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>

            <button onClick={() => setDarkMode(!darkMode)} className="p-1.5 rounded-full bg-white/15">
              {darkMode ? <Sun className="w-4 h-4 text-amber-200" /> : <Moon className="w-4 h-4" />}
            </button>

            {!authLoading && (
              user ? (
                <div className="flex items-center gap-1 bg-white/15 pl-1 pr-2 py-1 rounded-full">
                  <img src={userProfile?.photoURL || user.photoURL || 'https://via.placeholder.com/32'} alt="User" className="w-6 h-6 rounded-full object-cover" />
                  <button onClick={handleLogout} title="Sign Out" className="text-rose-200 hover:text-white">
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button onClick={handleGoogleSignIn} className="bg-white text-indigo-700 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                  <LogIn className="w-3.5 h-3.5" /><span>Sign In</span>
                </button>
              )
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-3 pb-24 flex flex-col">
        {activeTab === 'tutor' && (
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2 px-1 gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Brain className="w-4 h-4" /> AI Tutor (Vision & Voice)
              </span>
              <div className="flex items-center gap-2">
                <select value={tutorMode} onChange={(e) => setTutorMode(e.target.value)} className={`text-xs px-2 py-1.5 rounded-lg border outline-none font-medium ${cardBg}`}>
                  <option value="Friendly Tutor">Friendly Tutor</option>
                  <option value="Exam Coach">Exam Coach</option>
                  <option value="Step-by-Step Math">Step-by-Step Math</option>
                </select>
                <button onClick={handleClearChat} className={`p-1.5 rounded-lg border text-slate-400 hover:text-rose-400 ${cardBg}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className={`flex-1 rounded-2xl border p-3 overflow-y-auto space-y-3 min-h-[55vh] max-h-[60vh] ${cardBg}`}>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[86%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.sender === 'user' ? 'bg-indigo-600 text-white rounded-br-sm shadow-md' : darkMode ? 'bg-[#1e273d] text-slate-100 rounded-bl-sm border border-slate-700/60' : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                  }`}>
                    {msg.image && <img src={msg.image} alt="Uploaded" className="max-h-48 rounded-xl mb-2 border border-white/20" />}
                    {msg.text}
                    {msg.sender === 'ai' && (
                      <button onClick={() => handleSpeakText(msg.text)} className="mt-2 flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold">
                        <Volume2 className="w-3.5 h-3.5" /> উত্তরটি শুনুন
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.time}</span>
                </div>
              ))}
              {isTyping && (
                <div className="flex items-center gap-2 text-xs text-indigo-400 px-2 py-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>AI বিশ্লেষণ করে শুদ্ধ বাংলায় উত্তর লিখছে...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {tutorImage && (
              <div className="mt-2 flex items-center gap-2 bg-indigo-500/15 border border-indigo-500/30 p-2 rounded-xl">
                <img src={tutorImage} alt="Preview" className="w-12 h-12 rounded-lg object-cover" />
                <span className="text-xs text-indigo-300 flex-1">প্রশ্নের ছবি সংযুক্ত হয়েছে</span>
                <button onClick={() => setTutorImage(null)} className="text-rose-400 p-1"><X className="w-4 h-4" /></button>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="mt-2.5 flex gap-1.5 items-center">
              <label className={`p-3 rounded-xl border cursor-pointer hover:border-indigo-500 ${cardBg}`} title="ছবি তুলে সমাধান">
                <Camera className="w-5 h-5 text-indigo-400" />
                <input type="file" accept="image/*" onChange={handleTutorImageUpload} className="hidden" />
              </label>
              <button type="button" onClick={handleVoiceInput} className={`p-3 rounded-xl border ${isListening ? 'bg-rose-600 text-white animate-pulse' : cardBg}`} title="মুখে প্রশ্ন বলুন">
                <Mic className="w-5 h-5 text-emerald-400" />
              </button>
              <input type="text" value={inputMsg} onChange={(e) => setInputMsg(e.target.value)} placeholder="প্রশ্ন লিখুন, বলুন বা ছবি দিন..." className={`flex-1 rounded-xl border px-3 py-3 text-sm outline-none focus:border-indigo-500 ${inputBg}`} />
              <button type="submit" disabled={isTyping || (!inputMsg.trim() && !tutorImage)} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-3 rounded-xl shadow-lg">
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        )}
        {activeTab === 'classroom' && (
          <div className="space-y-3">
            <div className={`p-3 rounded-2xl border space-y-2.5 ${cardBg}`}>
              <div className="flex items-center justify-between gap-2">
                <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className={`flex-1 text-xs font-bold px-3 py-2 rounded-xl border outline-none ${inputBg}`}>
                  <option value="global">🌐 কমন স্টুডেন্ট কমিউনিটি (সবার জন্য)</option>
                  {myAccessibleGroups.map(g => (
                    <option key={g.id} value={g.id}>📚 {g.name} ({g.teacherName}) — কোড: {g.inviteCode}</option>
                  ))}
                </select>
                {currentRole === 'student' && !userProfile?.teacherRequest && user && (
                  <button onClick={handleRequestTeacher} className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-2 rounded-xl text-[11px] font-bold shrink-0">
                    Teacher আবেদন
                  </button>
                )}
              </div>

              {user && (
                <form onSubmit={handleJoinGroupByCode} className="flex gap-2">
                  <input type="text" value={joinCodeInput} onChange={(e) => setJoinCodeInput(e.target.value)} placeholder="টিচারের গ্রুপ কোড দিয়ে জয়েন করুন..." className={`flex-1 rounded-xl border px-3 py-1.5 text-xs outline-none ${inputBg}`} />
                  <button type="submit" className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold">Join</button>
                </form>
              )}

              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { id: 'chat', label: 'চ্যাট', icon: MessageSquare },
                  { id: 'notices', label: `নোটিশ ও পোল (${notices.length + polls.length})`, icon: Bell },
                  { id: 'homework', label: `হোমওয়ার্ক (${homeworks.length})`, icon: FileCheck },
                  { id: 'attendance', label: 'উপস্থিতি', icon: ClipboardCheck },
                  { id: 'exams', label: 'পরীক্ষা ও রেজাল্ট', icon: Award },
                  { id: 'classes', label: 'রেকর্ডেড ক্লাস', icon: Video },
                  { id: 'leaderboard', label: 'লিডারবোর্ড', icon: Medal },
                  ...(isTeacherOrHost ? [{ id: 'manage', label: isHost ? 'Host কন্ট্রোল' : 'গ্রুপ তৈরি', icon: Shield }] : [])
                ].map(st => {
                  const Icon = st.icon;
                  return (
                    <button
                      key={st.id}
                      onClick={() => {
                        setGroupSubTab(st.id);
                        if (st.id === 'notices') setUnreadNoticeCount(0);
                      }}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1 transition ${
                        groupSubTab === st.id ? 'bg-indigo-600 text-white' : 'bg-slate-800/40 text-slate-400'
                      }`}
                    >
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

                <div className={`rounded-2xl border p-3 overflow-y-auto space-y-3 min-h-[44vh] max-h-[47vh] ${cardBg}`}>
                  {groupMsgs.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-14">এই গ্রুপে এখনো কোনো মেসেজ নেই।</p>
                  ) : (
                    groupMsgs.map((m) => {
                      const isMe = user && m.uid === user.uid;
                      return (
                        <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className="flex items-center gap-1.5 mb-0.5 px-1">
                            {m.userPhoto && <img src={m.userPhoto} alt="" className="w-4 h-4 rounded-full object-cover" />}
                            <span className="text-[11px] font-semibold text-indigo-400">{m.userName}</span>
                            {m.senderRole === 'host' && <span className="text-[9px] bg-amber-400 text-black px-1.5 rounded font-bold">HOST</span>}
                            {m.senderRole === 'teacher' && <span className="text-[9px] bg-emerald-400 text-black px-1.5 rounded font-bold">TEACHER</span>}
                            {isTeacherOrHost && (
                              <>
                                <button onClick={() => handleTogglePinMsg(m)} className="text-amber-400 ml-1"><Pin className="w-3 h-3" /></button>
                                <button onClick={() => deleteDoc(doc(db, 'group_messages', m.id))} className="text-rose-400"><Trash2 className="w-3 h-3" /></button>
                              </>
                            )}
                          </div>
                          <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm ${
                            isMe ? 'bg-emerald-600 text-white rounded-br-sm' : darkMode ? 'bg-[#1e273d] text-slate-100 rounded-bl-sm' : 'bg-slate-100 text-slate-800'
                          }`}>
                            {m.image && <img src={m.image} alt="Shared" className="max-h-52 rounded-xl mb-1.5" />}
                            {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 px-1">
                            <span className="text-[10px] text-slate-400">{m.timeStr}</span>
                            <button onClick={() => handleLikeMsg(m)} className="text-[11px] text-slate-400 hover:text-amber-400">👍 {(m.likes || []).length}</button>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={commEndRef} />
                </div>

                {commImage && (
                  <div className="mt-2 flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 p-2 rounded-xl">
                    <img src={commImage} alt="Preview" className="w-10 h-10 rounded object-cover" />
                    <span className="text-xs text-emerald-300 flex-1">ছবি পাঠানোর জন্য প্রস্তুত</span>
                    <button onClick={() => setCommImage(null)} className="text-rose-400"><X className="w-4 h-4" /></button>
                  </div>
                )}

                <form onSubmit={handleSendGroupMsg} className="mt-2 flex gap-2 items-center">
                  <label className={`p-3 rounded-xl border cursor-pointer ${cardBg}`} title="চ্যাটে ছবি পাঠান">
                    <ImageIcon className="w-5 h-5 text-emerald-400" />
                    <input type="file" accept="image/*" onChange={handleCommImageSelect} className="hidden" />
                  </label>
                  <input type="text" value={commInput} onChange={(e) => setCommInput(e.target.value)} placeholder={user ? "গ্রুপে মেসেজ বা নোট লিখুন..." : "চ্যাট করতে Sign In করুন"} className={`flex-1 rounded-xl border px-3.5 py-3 text-sm outline-none ${inputBg}`} />
                  <button type="submit" disabled={sendingComm} className="bg-emerald-600 text-white p-3 rounded-xl"><Send className="w-5 h-5" /></button>
                </form>
              </div>
            )}

            {groupSubTab === 'notices' && (
              <div className="space-y-3">
                {notifPermission !== 'granted' && (
                  <button onClick={handleEnableNotifications} className="w-full p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center justify-center gap-2">
                    <BellRing className="w-4 h-4" /> ফোনের নোটিফিকেশন অ্যালার্ট চালু করতে এখানে ট্যাপ করুন
                  </button>
                )}

                {isTeacherOrHost ? (
                  <>
                    <form onSubmit={handlePostNotice} className={`p-4 rounded-2xl border space-y-2 ${cardBg}`}>
                      <h3 className="text-sm font-bold text-amber-400 flex items-center gap-1.5"><Bell className="w-4 h-4" /> নোটিফিকেশন প্রকাশ করুন (Host/Teacher)</h3>
                      <input type="text" value={noticeTitle} onChange={(e) => setNoticeTitle(e.target.value)} placeholder="নোটিশের শিরোনাম" className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                      <textarea rows="2" value={noticeBody} onChange={(e) => setNoticeBody(e.target.value)} placeholder="বিস্তারিত নোটিশ..." className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                      <button type="submit" className="bg-amber-500 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl">নোটিশ পাঠান</button>
                    </form>

                    <form onSubmit={handleCreatePoll} className={`p-4 rounded-2xl border space-y-2 ${cardBg}`}>
                      <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-1.5"><BarChart2 className="w-4 h-4" /> নতুন লাইভ পোল তৈরি করুন</h3>
                      <input type="text" value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="প্রশ্ন" className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={pollOpt1} onChange={(e) => setPollOpt1(e.target.value)} placeholder="অপশন ১" className={`rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                        <input type="text" value={pollOpt2} onChange={(e) => setPollOpt2(e.target.value)} placeholder="অপশন ২" className={`rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                      </div>
                      <button type="submit" className="bg-indigo-600 text-white font-bold text-xs px-4 py-2 rounded-xl">পোল প্রকাশ করুন</button>
                    </form>
                  </>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-800/40 text-xs text-slate-400 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400" /> কেবল Teacher এবং Host নোটিফিকেশন ও পোল দিতে পারবেন।
                  </div>
                )}

                {polls.map(p => (
                  <div key={p.id} className={`p-4 rounded-2xl border space-y-2 ${cardBg}`}>
                    <div className="flex justify-between">
                      <h4 className="font-bold text-sm text-indigo-300">📊 {p.question}</h4>
                      {isTeacherOrHost && <button onClick={() => deleteDoc(doc(db, 'group_polls', p.id))} className="text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button onClick={() => handleVotePoll(p, 1)} className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex justify-between font-bold">
                        <span>{p.opt1}</span><span>{(p.votes1 || []).length} ভোট</span>
                      </button>
                      <button onClick={() => handleVotePoll(p, 2)} className="p-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex justify-between font-bold">
                        <span>{p.opt2}</span><span>{(p.votes2 || []).length} ভোট</span>
                      </button>
                    </div>
                  </div>
                ))}

                {notices.map(n => (
                  <div key={n.id} className={`p-4 rounded-2xl border space-y-1 ${cardBg}`}>
                    <div className="flex justify-between">
                      <h4 className="font-bold text-sm text-amber-300">🔔 {n.title}</h4>
                      {isTeacherOrHost && <button onClick={() => deleteDoc(doc(db, 'group_notices', n.id))} className="text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </div>
                    <p className="text-xs whitespace-pre-wrap">{n.body}</p>
                    <span className="text-[10px] text-slate-400 block pt-1">প্রকাশক: {n.authorName} ({n.authorRole?.toUpperCase()}) • {n.dateStr}</span>
                  </div>
                ))}
              </div>
            )}

            {groupSubTab === 'homework' && (
              <div className="space-y-3">
                {isTeacherOrHost && (
                  <form onSubmit={handleAddHomework} className={`p-4 rounded-2xl border space-y-2 ${cardBg}`}>
                    <h3 className="text-sm font-bold text-emerald-400">নতুন হোমওয়ার্ক দিন</h3>
                    <input type="text" value={hwTitle} onChange={(e) => setHwTitle(e.target.value)} placeholder="হোমওয়ার্কের বিবরণ" className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                    <input type="text" value={hwDue} onChange={(e) => setHwDue(e.target.value)} placeholder="জমা দেওয়ার শেষ তারিখ" className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                    <button type="submit" className="bg-emerald-600 text-white font-bold text-xs px-4 py-2 rounded-xl">হোমওয়ার্ক প্রকাশ করুন</button>
                  </form>
                )}

                {homeworks.map(hw => {
                  const isDone = user && (hw.completedBy || []).some(item => item.uid === user.uid);
                  return (
                    <div key={hw.id} className={`p-4 rounded-2xl border space-y-2 ${cardBg}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-sm">{hw.title}</h4>
                          <span className="text-[11px] text-amber-400">শেষ সময়: {hw.dueDate} • শিক্ষক: {hw.teacherName}</span>
                        </div>
                        {isTeacherOrHost && <button onClick={() => deleteDoc(doc(db, 'group_homeworks', hw.id))} className="text-rose-400"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <button onClick={() => handleToggleHomeworkDone(hw)} className={`px-3 py-1.5 rounded-xl text-xs font-bold ${isDone ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                          {isDone ? '✅ সম্পন্ন হয়েছে' : 'জমা দিন (Mark Done)'}
                        </button>
                        <span className="text-[11px] text-slate-400">জমা দিয়েছে: {(hw.completedBy || []).length} জন</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {groupSubTab === 'attendance' && (
              <div className="space-y-3">
                {isTeacherOrHost && (
                  <div className={`p-4 rounded-2xl border space-y-3 ${cardBg}`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-emerald-400">উপস্থিতি ও অনুপস্থিতি নিন</h3>
                      <input type="date" value={attDate} onChange={(e) => setAttDate(e.target.value)} className={`text-xs px-2.5 py-1.5 rounded-lg border ${inputBg}`} />
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {groupMembers.filter(m => m.role === 'student').map(st => (
                        <div key={st.uid} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-800/30">
                          <span>{st.displayName}</span>
                          <div className="flex gap-1.5">
                            <button type="button" onClick={() => setAttMap(p => ({ ...p, [st.uid]: 'উপস্থিত' }))} className={`px-2.5 py-1 rounded-lg font-bold ${attMap[st.uid] === 'উপস্থিত' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'}`}>উপস্থিত</button>
                            <button type="button" onClick={() => setAttMap(p => ({ ...p, [st.uid]: 'অনুপস্থিত' }))} className={`px-2.5 py-1 rounded-lg font-bold ${attMap[st.uid] === 'অনুপস্থিত' ? 'bg-rose-600 text-white' : 'bg-slate-700 text-slate-300'}`}>অনুপস্থিত</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={handleSaveAttendance} className="w-full bg-emerald-600 text-white py-2 rounded-xl text-xs font-bold">উপস্থিতি সেভ করুন</button>
                  </div>
                )}

                {attendanceRecords.map(rec => (
                  <div key={rec.id} className={`p-3.5 rounded-2xl border space-y-2 ${cardBg}`}>
                    <div className="flex justify-between items-center text-xs font-bold text-indigo-400">
                      <span>তারিখ: {rec.date}</span>
                      <div className="flex items-center gap-2">
                        <span>শিক্ষক: {rec.takenBy}</span>
                        {isTeacherOrHost && (
                          <button
                            onClick={() => {
                              if (window.confirm(`${rec.date} তারিখের উপস্থিতি মুছে ফেলতে চান?`)) {
                                deleteDoc(doc(db, 'group_attendance', rec.id));
                              }
                            }}
                            className="text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(rec.records || []).map((r, i) => (
                        <span key={i} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${r.status === 'উপস্থিত' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                          {r.name}: {r.status}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {groupSubTab === 'exams' && (
              <div className="space-y-3">
                {isTeacherOrHost ? (
                  <form onSubmit={handleSaveClassExam} className={`p-4 rounded-2xl border space-y-2.5 ${cardBg}`}>
                    <h3 className="text-sm font-bold text-indigo-400">{editingExamId ? 'পরীক্ষার তথ্য Edit করুন' : 'নতুন পরীক্ষার তথ্য ও রেজাল্ট যোগ করুন'}</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={examForm.title} onChange={(e) => setExamForm({ ...examForm, title: e.target.value })} placeholder="পরীক্ষার নাম" className={`rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                      <input type="date" value={examForm.date} onChange={(e) => setExamForm({ ...examForm, date: e.target.value })} className={`rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                    </div>
                    <input type="text" value={examForm.syllabus} onChange={(e) => setExamForm({ ...examForm, syllabus: e.target.value })} placeholder="সিলেবাস ও পূর্ণমান" className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                    <textarea rows="3" value={examForm.resultsText} onChange={(e) => setExamForm({ ...examForm, resultsText: e.target.value })} placeholder="শিক্ষার্থীদের প্রাপ্ত নম্বর / ফলাফল লিখুন..." className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                    <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold">{editingExamId ? 'আপডেট সেভ করুন' : 'পরীক্ষার তথ্য প্রকাশ করুন'}</button>
                  </form>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-800/40 text-xs text-slate-400 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-400" /> পরীক্ষার তথ্য কেবল Teacher এবং Host Edit করতে পারবেন।
                  </div>
                )}

                {classExams.map(ex => (
                  <div key={ex.id} className={`p-4 rounded-2xl border space-y-2 ${cardBg}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-indigo-300">{ex.title}</h4>
                        <span className="text-[11px] text-slate-400">তারিখ: {ex.date || 'নির্ধারিত নয়'} • {ex.syllabus}</span>
                      </div>
                      {isTeacherOrHost && (
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingExamId(ex.id); setExamForm({ title: ex.title, date: ex.date, syllabus: ex.syllabus, resultsText: ex.resultsText }); }} className="text-amber-400"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => deleteDoc(doc(db, 'group_exams', ex.id))} className="text-rose-400"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                    {ex.resultsText && (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs whitespace-pre-wrap">
                        <strong className="text-emerald-300 block mb-1">ফলাফল ও নম্বর তালিকা:</strong>{ex.resultsText}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {groupSubTab === 'classes' && (
              <div className="space-y-3">
                {isTeacherOrHost && (
                  <form onSubmit={handleAddRecordedClass} className={`p-4 rounded-2xl border space-y-2.5 ${cardBg}`}>
                    <h3 className="text-sm font-bold text-violet-400 flex items-center gap-1.5"><Video className="w-4 h-4" /> নতুন রেকর্ডেড ক্লাস আপলোড করুন</h3>
                    <input type="text" value={classForm.title} onChange={(e) => setClassForm({ ...classForm, title: e.target.value })} placeholder="ক্লাসের শিরোনাম" className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                    <input type="url" value={classForm.videoUrl} onChange={(e) => setClassForm({ ...classForm, videoUrl: e.target.value })} placeholder="ভিডিও লিংক (YouTube বা Google Drive)" className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                    <input type="text" value={classForm.notes} onChange={(e) => setClassForm({ ...classForm, notes: e.target.value })} placeholder="ক্লাসের সংক্ষিপ্ত বিবরণ..." className={`w-full rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                    <button type="submit" className="bg-violet-600 text-white px-4 py-2 rounded-xl text-xs font-bold">রেকর্ডেড ক্লাস যুক্ত করুন</button>
                  </form>
                )}

                {recordedClasses.map(rc => (
                  <div key={rc.id} className={`p-4 rounded-2xl border space-y-2 ${cardBg}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-violet-300">{rc.title}</h4>
                        <span className="text-[10px] text-slate-400">শিক্ষক: {rc.teacherName} • {rc.dateStr}</span>
                      </div>
                      {isTeacherOrHost && <button onClick={() => deleteDoc(doc(db, 'recorded_classes', rc.id))} className="text-rose-400"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                    {rc.notes && <p className="text-xs text-slate-300">{rc.notes}</p>}
                    <a href={rc.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 bg-violet-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl">
                      <Video className="w-3.5 h-3.5" /> ক্লাস ভিডিও দেখুন
                    </a>
                  </div>
                ))}
              </div>
            )}

            {groupSubTab === 'leaderboard' && (
              <div className={`p-4 rounded-2xl border space-y-2.5 ${cardBg}`}>
                <h3 className="text-sm font-bold text-amber-400 flex items-center gap-1.5"><Medal className="w-4 h-4" /> টপ লার্নার্স লিডারবোর্ড (XP র‍্যাংকিং)</h3>
                {[...groupMembers].sort((a, b) => (b.xp || 0) - (a.xp || 0)).map((member, index) => (
                  <div key={member.uid} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center font-extrabold ${
                        index === 0 ? 'bg-amber-400 text-black' : index === 1 ? 'bg-slate-300 text-black' : index === 2 ? 'bg-amber-700 text-white' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {index + 1}
                      </span>
                      <span className="font-bold">{member.displayName}</span>
                    </div>
                    <span className="font-bold text-amber-300">{member.xp || 150} XP</span>
                  </div>
                ))}
              </div>
            )}

            {groupSubTab === 'manage' && isTeacherOrHost && (
              <div className="space-y-4">
                <form onSubmit={handleCreateGroup} className={`p-4 rounded-2xl border space-y-2.5 ${cardBg}`}>
                  <h3 className="text-sm font-bold text-emerald-400">নতুন স্টুডেন্ট ব্যাচ / গ্রুপ তৈরি করুন</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="গ্রুপের নাম" className={`rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                    <input type="text" value={newGroupSubject} onChange={(e) => setNewGroupSubject(e.target.value)} placeholder="বিষয়" className={`rounded-xl border px-3 py-2 text-xs ${inputBg}`} />
                  </div>
                  <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold">গ্রুপ তৈরি ও কোড পান</button>
                </form>

                {isHost && (
                  <div className={`p-4 rounded-2xl border space-y-3 ${cardBg}`}>
                    <h3 className="text-sm font-bold text-amber-400 flex items-center gap-1.5"><Shield className="w-4 h-4" /> Host Control: সকল ইউজার ও Teacher অনুমোদন</h3>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {allUsers.map(u => {
                        const isTargetHost = HOST_EMAILS.includes(u.email?.toLowerCase());
                        return (
                          <div key={u.uid} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-800/40 text-xs">
                            <div className="min-w-0">
                              <p className="font-bold truncate flex items-center gap-1.5">
                                <span>{u.displayName}</span>
                                {u.teacherRequest && <span className="bg-amber-500 text-black text-[9px] px-1.5 rounded font-bold">Teacher আবেদন</span>}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                            </div>
                            {isTargetHost ? (
                              <span className="text-[10px] font-bold text-amber-400 shrink-0">SUPER HOST</span>
                            ) : (
                              <div className="flex gap-1.5 shrink-0">
                                {u.role !== 'teacher' ? (
                                  <button onClick={() => handleToggleUserRole(u, 'teacher')} className="bg-emerald-600 text-white px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1"><Check className="w-3 h-3" /> Teacher বানান</button>
                                ) : (
                                  <button onClick={() => handleToggleUserRole(u, 'student')} className="bg-rose-600 text-white px-2.5 py-1 rounded-lg font-bold text-[11px]">Student করুন</button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'exam' && (
          <div className="space-y-4">
            <div className={`p-4 rounded-2xl border ${cardBg}`}>
              <h2 className="font-bold text-base flex items-center gap-2 mb-3"><HelpCircle className="w-5 h-5 text-indigo-400" /> AI Practice Quiz</h2>
              <div className="flex gap-2">
                <input type="text" value={examTopic} onChange={(e) => setExamTopic(e.target.value)} placeholder="অধ্যায়ের নাম লিখুন..." className={`flex-1 rounded-xl border px-3.5 py-2.5 text-sm outline-none ${inputBg}`} />
                <button onClick={handleGenerateQuiz} disabled={loadingQuiz || !examTopic.trim()} className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">{loadingQuiz ? '...' : 'শুরু'}</button>
              </div>
            </div>

            {quizQuestions.length > 0 && !quizFinished && (
              <div className={`p-5 rounded-2xl border space-y-4 ${cardBg}`}>
                <div className="flex justify-between text-xs font-semibold text-indigo-400">
                  <span>প্রশ্ন {currentQIndex + 1} / {quizQuestions.length}</span><span>স্কোর: {quizScore}</span>
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
                    <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs">
                      <strong className="text-indigo-300">ব্যাখ্যা: </strong>{cleanAiOutput(quizQuestions[currentQIndex].explanation)}
                    </div>
                    <button onClick={() => currentQIndex + 1 < quizQuestions.length ? (setCurrentQIndex(i => i + 1), setSelectedOption(null)) : setQuizFinished(true)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm">
                      {currentQIndex + 1 === quizQuestions.length ? 'ফলাফল দেখুন' : 'পরবর্তী প্রশ্ন'}
                    </button>
                  </>
                )}
              </div>
            )}

            {quizFinished && (
              <div className={`p-6 rounded-2xl border text-center space-y-3 ${cardBg}`}>
                <Award className="w-12 h-12 text-amber-400 mx-auto" />
                <h3 className="text-xl font-bold">স্কোর: {quizScore} / {quizQuestions.length}</h3>
                <button onClick={handleGenerateQuiz} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">আবার পরীক্ষা দিন</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'flashcards' && (
          <div className="space-y-4">
            <div className={`p-4 rounded-2xl border ${cardBg}`}>
              <h2 className="font-bold text-base flex items-center gap-2 mb-3"><Layers className="w-5 h-5 text-violet-400" /> AI Smart Flashcards</h2>
              <div className="flex gap-2">
                <input type="text" value={flashTopic} onChange={(e) => setFlashTopic(e.target.value)} placeholder="বিষয়ের নাম লিখুন..." className={`flex-1 rounded-xl border px-3.5 py-2.5 text-sm outline-none ${inputBg}`} />
                <button onClick={handleGenerateFlashcards} disabled={loadingFlash} className="bg-violet-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold">{loadingFlash ? '...' : 'তৈরি'}</button>
              </div>
            </div>
            {flashcards.length > 0 && (
              <div className="space-y-3">
                <div onClick={() => setIsFlipped(!isFlipped)} className={`min-h-[180px] p-6 rounded-2xl border-2 cursor-pointer flex flex-col items-center justify-center text-center ${isFlipped ? 'border-violet-500 bg-violet-600/15' : cardBg}`}>
                  <span className="text-[11px] font-bold text-violet-400 mb-2">{isFlipped ? 'উত্তর' : `কার্ড ${cardIndex + 1} / ${flashcards.length} (ট্যাপ করুন)`}</span>
                  <p className="text-base font-semibold">{cleanAiOutput(isFlipped ? flashcards[cardIndex].back : flashcards[cardIndex].front)}</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setIsFlipped(false); setCardIndex(p => p === 0 ? flashcards.length - 1 : p - 1); }} className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold ${cardBg}`}>আগেরটি</button>
                  <button onClick={() => { setIsFlipped(false); setCardIndex(p => (p + 1) % flashcards.length); }} className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold ${cardBg}`}>পরেরটি</button>
                </div>
              </div>
            )}

            {/* AI শর্ট নোট জেনারেটর */}
            <div className={`p-4 rounded-2xl border space-y-3 ${cardBg}`}>
              <h2 className="font-bold text-base flex items-center gap-2"><BookOpen className="w-5 h-5 text-emerald-400" /> AI Short Notes জেনারেটর</h2>
              <div className="flex gap-2">
                <input type="text" value={noteTopic} onChange={(e) => setNoteTopic(e.target.value)} placeholder="যেকোনো অধ্যায় লিখুন (যেমন: আলোর প্রতিফলন)" className={`flex-1 rounded-xl border px-3 py-2 text-xs outline-none ${inputBg}`} />
                <button onClick={handleGenerateNotes} disabled={loadingNote} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold">{loadingNote ? '...' : 'নোট তৈরি'}</button>
              </div>
              {generatedNote && (
                <div className="p-3 rounded-xl bg-slate-800/40 text-xs whitespace-pre-wrap space-y-2">
                  <p>{generatedNote}</p>
                  <button onClick={() => { navigator.clipboard.writeText(generatedNote); alert("নোট কপি হয়েছে!"); }} className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                    <Copy className="w-3.5 h-3.5" /> নোট কপি করুন
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2.5">
              <div className={`p-3 rounded-2xl border text-center ${cardBg}`}><Trophy className="w-5 h-5 text-amber-400 mx-auto mb-1" /><div className="text-base font-bold">{xp}</div><div className="text-[10px] text-slate-400">মোট XP</div></div>
              <div className={`p-3 rounded-2xl border text-center ${cardBg}`}><ClipboardCheck className="w-5 h-5 text-emerald-400 mx-auto mb-1" /><div className="text-base font-bold">{myAttendancePercent}%</div><div className="text-[10px] text-slate-400">উপস্থিতি হার</div></div>
              <div className={`p-3 rounded-2xl border text-center ${cardBg}`}><Shield className="w-5 h-5 text-indigo-400 mx-auto mb-1" /><div className="text-sm font-bold uppercase">{currentRole}</div><div className="text-[10px] text-slate-400">বর্তমান মোড</div></div>
            </div>

            {user ? (
              <form onSubmit={handleSaveProfile} className={`p-4 rounded-2xl border space-y-3 ${cardBg}`}>
                <h2 className="font-bold text-base flex items-center gap-2"><Edit3 className="w-4 h-4 text-indigo-400" /> আপনার আইডি ও প্রোফাইল ছবি Edit করুন</h2>
                <div className="flex items-center gap-4">
                  <img src={editPhoto || 'https://via.placeholder.com/80'} alt="Profile" className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500" />
                  <label className="bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer">
                    নতুন ছবি আপলোড করুন
                    <input type="file" accept="image/*" onChange={handleProfilePhotoChange} className="hidden" />
                  </label>
                </div>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="আপনার নাম" className={`w-full rounded-xl border px-3 py-2 text-sm ${inputBg}`} />
                <input type="text" value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="পরিচিতি / শ্রেণি (Bio)" className={`w-full rounded-xl border px-3 py-2 text-sm ${inputBg}`} />
                                <button type="submit" disabled={savingProfile} className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-bold">{savingProfile ? 'সেভ হচ্ছে...' : 'প্রোফাইল সেভ করুন'}</button>
              </form>
            ) : (
              <div className={`p-6 rounded-2xl border text-center space-y-3 ${cardBg}`}>
                <p className="text-sm">প্রোফাইল ও ক্লাসরুম ব্যবহার করতে প্রথমে Google Sign In করুন।</p>
                <button onClick={handleGoogleSignIn} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold">Google Sign In</button>
              </div>
            )}

            {/* ভুল প্রশ্নের খাতা (Mistake Log) */}
            {mistakes.length > 0 && (
              <div className={`p-4 rounded-2xl border space-y-2.5 ${cardBg}`}>
                <h3 className="text-sm font-bold text-rose-400 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> ভুল প্রশ্নের খাতা ({mistakes.length}টি)</h3>
                {mistakes.map(m => (
                  <div key={m.id} className="p-3 rounded-xl bg-slate-800/40 text-xs space-y-1">
                    <p className="font-bold">{m.question}</p>
                    <p className="text-rose-400">আপনার উত্তর: {m.yourAnswer}</p>
                    <p className="text-emerald-400">সঠিক উত্তর: {m.correctAnswer}</p>
                    {m.explanation && <p className="text-slate-300 pt-1">{cleanAiOutput(m.explanation)}</p>}
                    <button onClick={() => handleExplainMistake(m)} className="text-indigo-400 font-bold pt-1">
                      {explainingMistakeId === m.id ? 'AI বুঝিয়ে লিখছে...' : '✨ AI দিয়ে আরও সহজে বুঝুন'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <nav className={`fixed bottom-0 inset-x-0 z-30 border-t backdrop-blur-md ${darkMode ? 'bg-[#0f1524]/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
        <div className="max-w-3xl mx-auto grid grid-cols-5 py-1.5">
          {[
            { id: 'tutor', label: 'AI Tutor', icon: Brain },
            { id: 'classroom', label: 'Classroom', icon: Users, badge: unreadNoticeCount },
            { id: 'exam', label: 'AI Quiz', icon: HelpCircle },
            { id: 'flashcards', label: 'Notes & Cards', icon: Layers },
            { id: 'profile', label: 'My ID', icon: Edit3 }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'classroom') setUnreadNoticeCount(0);
                }}
                className={`relative flex flex-col items-center justify-center py-1.5 text-[11px] font-medium ${isActive ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}
              >
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-indigo-400' : ''}`} />
                {tab.badge > 0 && (
                  <span className="absolute top-1 right-5 bg-rose-500 text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
