import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Send, Brain, Trophy, Sun, Moon, BookOpen,
  Layers, AlertTriangle, CheckCircle2, XCircle, RotateCw,
  Plus, Trash2, Zap, Award, Flame, ChevronRight, ChevronLeft,
  HelpCircle, Lightbulb, FileText, RefreshCw, Users, LogIn,
  LogOut, UserCheck, MessageSquare
} from 'lucide-react';

// দ্রুতগতির ও নির্ভরযোগ্য Gemini API কল ফাংশন (টাইমআউট ও ব্যাকআপসহ)
const callGeminiFast = async (prompt, systemInstruction = "") => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("API Key পাওয়া যায়নি। Vercel Environment Variables চেক করুন।");
  }

  // Google-এর সবচেয়ে স্থিতিশীল ও দ্রুতগতির মডেলসমূহ
  const models = [
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash"
  ];
  let lastError = "";

  for (const model of models) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // সর্বোচ্চ ১২ সেকেন্ড অপেক্ষা করবে

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        ...(systemInstruction && {
          systemInstruction: { parts: [{ text: systemInstruction }] }
        })
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
        return data.candidates[0].content.parts[0].text;
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
  // থিম ও নেভিগেশন স্টেট
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState('tutor');

  // ইউজার অ্যাকাউন্ট (Google Sign-In স্টেট)
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('edunexus_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');

  // ইউজার প্রোগ্রেস
  const [xp, setXp] = useState(() => Number(localStorage.getItem('edunexus_xp')) || 150);
  const [streak] = useState(() => Number(localStorage.getItem('edunexus_streak')) || 3);

  // ১. AI Tutor স্টেট (চ্যাট হিস্ট্রি সেভ থাকবে)
  const [tutorMode, setTutorMode] = useState('Friendly Tutor');
  const defaultWelcomeMsg = [
    {
      id: 1,
      sender: 'ai',
      text: 'স্বাগতম! আমি EduNexus AI। পড়াশোনার যেকোনো প্রশ্ন, অঙ্ক, বিজ্ঞান বা পরীক্ষার প্রস্তুতি নিয়ে আমাকে জিজ্ঞাসা করতে পারো! তোমার সব চ্যাট এখানে সেভ থাকবে।',
      time: 'Now'
    }
  ];
  const [messages, setMessages] = useState(() => {
    const savedChat = localStorage.getItem('edunexus_chat_history');
    return savedChat ? JSON.parse(savedChat) : defaultWelcomeMsg;
  });
  const [inputMsg, setInputMsg] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  // ২. Community Chat (অ্যাপের ব্যবহারকারীদের চ্যাট বক্স)
    const [communityMsgs, setCommunityMsgs] = useState(() => {
    const savedComm = localStorage.getItem('edunexus_community_chat');
    return savedComm ? JSON.parse(savedComm) : [];
  });
  const [commInput, setCommInput] = useState('');
  const commEndRef = useRef(null);
  // ৩. Exam Simulator স্টেট
  const [examTopic, setExamTopic] = useState('');
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);

  // ৪. Flashcards স্টেট
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

  // ৫. Study Notes স্টেট
  const [noteTopic, setNoteTopic] = useState('');
  const [notesList, setNotesList] = useState(() => {
    const saved = localStorage.getItem('edunexus_notes');
    return saved ? JSON.parse(saved) : [];
  });
  const [loadingNote, setLoadingNote] = useState(false);

  // ৬. Mistake Log স্টেট
  const [mistakes, setMistakes] = useState(() => {
    const saved = localStorage.getItem('edunexus_mistakes');
    return saved ? JSON.parse(saved) : [];
  });
  const [explainingId, setExplainingId] = useState(null);

  // LocalStorage সিঙ্ক (সব ডেটা স্থায়ীভাবে সেভ রাখার জন্য)
  useEffect(() => {
    localStorage.setItem('edunexus_xp', xp.toString());
  }, [xp]);

  useEffect(() => {
    localStorage.setItem('edunexus_chat_history', JSON.stringify(messages));
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    localStorage.setItem('edunexus_community_chat', JSON.stringify(communityMsgs));
    commEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [communityMsgs]);

  useEffect(() => {
    localStorage.setItem('edunexus_flashcards', JSON.stringify(flashcards));
  }, [flashcards]);

  useEffect(() => {
    localStorage.setItem('edunexus_notes', JSON.stringify(notesList));
  }, [notesList]);

  useEffect(() => {
    localStorage.setItem('edunexus_mistakes', JSON.stringify(mistakes));
  }, [mistakes]);

  const addXp = (amount) => setXp((prev) => prev + amount);

  // Google Sign-In হ্যান্ডলার
  const handleGoogleLogin = (e) => {
    e.preventDefault();
    if (!loginName.trim() || !loginEmail.trim()) return;
    const userData = {
      name: loginName.trim(),
      email: loginEmail.trim(),
      avatar: loginName.trim().charAt(0).toUpperCase()
    };
    setUser(userData);
    localStorage.setItem('edunexus_user', JSON.stringify(userData));
    setShowAuthModal(false);
    addXp(50);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('edunexus_user');
  };

  // AI Tutor মেসেজ পাঠানো (পূর্বের চ্যাট কনটেক্সটসহ)
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputMsg.trim() || isTyping) return;

    const userText = inputMsg.trim();
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const updatedMessages = [...messages, { id: Date.now(), sender: 'user', text: userText, time: now }];
    setMessages(updatedMessages);
    setInputMsg('');
    setIsTyping(true);

    // শেষ ৪টি মেসেজ কনটেক্সট হিসেবে পাঠানো যাতে AI আগের কথা মনে রাখতে পারে
    const recentHistory = updatedMessages
      .slice(-5)
      .map((m) => `${m.sender === 'user' ? 'Student' : 'Tutor'}: ${m.text}`)
      .join('\n');

    const systemPrompts = {
      'Friendly Tutor': 'তুমি একজন বন্ধুত্বপূর্ণ ও ধৈর্যশীল শিক্ষক। সহজ বাংলায় উদাহরণসহ স্পষ্ট ও সংক্ষিপ্তভাবে উত্তর দাও।',
      'Exam Coach': 'তুমি একজন নিখুঁত বোর্ড পরীক্ষার কোচ। পরীক্ষায় পুরো নম্বর পাওয়ার উপযোগী পয়েন্ট আকারে উত্তর দাও।',
      'Step-by-Step Math': 'তুমি একজন গণিত ও বিজ্ঞান বিশেষজ্ঞ। প্রতিটি অঙ্ক বা সমস্যা ধাপে ধাপে সূত্রসহ সমাধান করো।'
    };

    try {
      const reply = await callGeminiFast(
        `আগের কথোপকথন:\n${recentHistory}\n\nবর্তমান প্রশ্নের উত্তর দাও:`,
        systemPrompts[tutorMode]
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
      addXp(10);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: `⚠️ ${err.message}`,
          time: now
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearChat = () => {
    if (window.confirm('আপনি কি সব চ্যাট হিস্ট্রি মুছে ফেলতে চান?')) {
      setMessages(defaultWelcomeMsg);
      localStorage.removeItem('edunexus_chat_history');
    }
  };

  // Community Chat মেসেজ পাঠানো
  const handleSendCommunityMsg = (e) => {
    e.preventDefault();
    if (!commInput.trim()) return;
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    const newMsg = {
      id: Date.now(),
      user: user.name,
      text: commInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true
    };
    setCommunityMsgs((prev) => [...prev, newMsg]);
    setCommInput('');
    addXp(5);
  };

  // AI Exam কুইজ তৈরি
  const handleGenerateQuiz = async () => {
    if (!examTopic.trim()) return;
    setLoadingQuiz(true);
    setQuizQuestions([]);
    setQuizFinished(false);
    setCurrentQIndex(0);
    setQuizScore(0);
    setSelectedOption(null);

    const prompt = `"${examTopic}" বিষয়ের ওপর ৫টি MCQ প্রশ্ন তৈরি করো বাংলায়। উত্তরটি শুধুমাত্র নিচের JSON ফরম্যাটে দেবে, অন্য কোনো লেখা বা markdown থাকবে না:
[
  {
    "question": "প্রশ্নটি এখানে",
    "options": ["ক", "খ", "গ", "ঘ"],
    "correctIndex": 0,
    "explanation": "কেন এটি সঠিক তার সংক্ষিপ্ত ব্যাখ্যা"
  }
]`;

    try {
      const raw = await callGeminiFast(prompt, "Always respond with valid raw JSON array only.");
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setQuizQuestions(parsed);
      } else {
        throw new Error("প্রশ্ন তৈরি করা যায়নি।");
      }
    } catch (err) {
      alert("কুইজ তৈরিতে সমস্যা হয়েছে: " + err.message);
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
      const newMistake = {
        id: Date.now(),
        topic: examTopic,
        question: currentQ.question,
        yourAnswer: currentQ.options[idx],
        correctAnswer: currentQ.options[currentQ.correctIndex],
        explanation: currentQ.explanation,
        date: new Date().toLocaleDateString('bn-BD')
      };
      setMistakes((prev) => [newMistake, ...prev]);
    }
  };

  const handleNextQuestion = () => {
    if (currentQIndex + 1 < quizQuestions.length) {
      setCurrentQIndex((i) => i + 1);
      setSelectedOption(null);
    } else {
      setQuizFinished(true);
    }
  };

  // AI Flashcards তৈরি
  const handleGenerateFlashcards = async () => {
    if (!flashTopic.trim()) return;
    setLoadingFlash(true);

    const prompt = `"${flashTopic}" অধ্যায় বা বিষয়ের ওপর ৬টি গুরুত্বপূর্ণ ফ্ল্যাশকার্ড তৈরি করো বাংলায়। শুধুমাত্র নিচের JSON ফরম্যাটে উত্তর দেবে:
[
  { "front": "সংক্ষিপ্ত প্রশ্ন বা সূত্রের নাম", "back": "সঠিক উত্তর বা সংজ্ঞা" }
]`;

    try {
      const raw = await callGeminiFast(prompt, "Respond strictly with valid JSON array.");
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

  // AI Smart Study Notes তৈরি
  const handleGenerateNote = async () => {
    if (!noteTopic.trim()) return;
    setLoadingNote(true);

    const prompt = `"${noteTopic}" বিষয়ের ওপর পরীক্ষার উপযোগী একটি গোছানো ও সংক্ষিপ্ত স্টাডি নোট তৈরি করো বাংলায়। এতে মূল ধারণা, গুরুত্বপূর্ণ সূত্র/পয়েন্ট এবং মনে রাখার কৌশল রাখো।`;

    try {
      const content = await callGeminiFast(prompt, "তুমি একজন সেরা নোট প্রস্তুতকারক শিক্ষক। স্পষ্ট পয়েন্ট ও সহজ ভাষায় নোট লেখো।");
      const newNote = {
        id: Date.now(),
        title: noteTopic,
        content,
        date: new Date().toLocaleDateString('bn-BD')
      };
      setNotesList((prev) => [newNote, ...prev]);
      setNoteTopic('');
      addXp(30);
    } catch (err) {
      alert("নোট তৈরিতে সমস্যা: " + err.message);
    } finally {
      setLoadingNote(false);
    }
  };

  // Mistake Log থেকে AI দিয়ে বিস্তারিত ব্যাখ্যা নেওয়া
  const handleExplainMistake = async (mistake) => {
    setExplainingId(mistake.id);
    try {
      const prompt = `আমি একটি পরীক্ষায় এই প্রশ্নটি ভুল করেছি:
প্রশ্ন: ${mistake.question}
আমার উত্তর: ${mistake.yourAnswer}
সঠিক উত্তর: ${mistake.correctAnswer}
দয়া করে সহজ বাংলায় বুঝিয়ে দাও কেন সঠিক উত্তরটি ঠিক এবং আমি কোথায় ভুল করেছি।`;

      const aiExplanation = await callGeminiFast(prompt);
      setMistakes((prev) =>
        prev.map((m) => (m.id === mistake.id ? { ...m, aiDeepDive: aiExplanation } : m))
      );
      addXp(15);
    } catch (err) {
      alert(err.message);
    } finally {
      setExplainingId(null);
    }
  };

  // ডাইনামিক থিম ক্লাস
  const bgMain = darkMode ? 'bg-[#0b0f19] text-slate-100' : 'bg-slate-50 text-slate-900';
  const cardBg = darkMode ? 'bg-[#131a2b] border-slate-800' : 'bg-white border-slate-200 shadow-sm';
  const inputBg = darkMode ? 'bg-[#1a2236] border-slate-700 text-white placeholder-slate-400' : 'bg-slate-100 border-slate-300 text-slate-900';

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${bgMain}`}>
      {/* টপ নেভিগেশন বার */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white px-3.5 py-2.5 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-1.5 rounded-xl backdrop-blur-sm">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h1 className="font-bold text-base sm:text-lg tracking-tight leading-none">EduNexus AI</h1>
              <span className="text-[10px] text-indigo-200 font-medium">Smart Study OS</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-full text-xs font-bold">
              <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
              <span>{xp} XP</span>
            </div>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-1.5 rounded-full bg-white/15 hover:bg-white/25 transition"
              title="থিম পরিবর্তন করুন"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-200" /> : <Moon className="w-4 h-4" />}
            </button>

            {user ? (
              <div className="flex items-center gap-1.5 bg-white/15 pl-1.5 pr-2 py-1 rounded-full">
                <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-900 font-bold text-xs flex items-center justify-center">
                  {user.avatar}
                </div>
                <span className="text-xs font-semibold hidden sm:inline max-w-[80px] truncate">{user.name}</span>
                <button onClick={handleLogout} title="Sign Out" className="text-rose-200 hover:text-white ml-0.5">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="bg-white text-indigo-700 hover:bg-indigo-50 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow transition"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Google Account Sign-In পপ-আপ মডাল */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl border p-5 space-y-4 ${cardBg}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold">
                  G
                </div>
                <div>
                  <h3 className="font-bold text-base">Google অ্যাকাউন্ট দিয়ে Sign In</h3>
                  <p className="text-[11px] text-slate-400">আপনার চ্যাট হিস্ট্রি ও নোট সুরক্ষিত রাখুন</p>
                </div>
              </div>
              <button onClick={() => setShowAuthModal(false)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGoogleLogin} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">আপনার নাম</label>
                <input
                  type="text"
                  required
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  placeholder="যেমন: শিখা দাস"
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 ${inputBg}`}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Gmail ঠিকানা</label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 ${inputBg}`}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition"
              >
                <UserCheck className="w-4 h-4" /> Continue with Google
              </button>
            </form>
          </div>
        </div>
      )}

      {/* মূল কনটেন্ট এরিয়া */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-3 pb-24 flex flex-col">
        
        {/* ট্যাব ১: AI TUTOR (চ্যাট হিস্ট্রিসহ) */}
        {activeTab === 'tutor' && (
          <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-2 px-1 gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Brain className="w-4 h-4" /> AI Tutor
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={tutorMode}
                  onChange={(e) => setTutorMode(e.target.value)}
                  className={`text-xs px-2 py-1.5 rounded-lg border outline-none font-medium ${cardBg}`}
                >
                  <option value="Friendly Tutor">Friendly Tutor</option>
                  <option value="Exam Coach">Exam Coach</option>
                  <option value="Step-by-Step Math">Step-by-Step Math</option>
                </select>
                <button
                  onClick={handleClearChat}
                  title="চ্যাট হিস্ট্রি মুছুন"
                  className={`p-1.5 rounded-lg border text-slate-400 hover:text-rose-400 transition ${cardBg}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* চ্যাট বক্স */}
            <div className={`flex-1 rounded-2xl border p-3 overflow-y-auto space-y-3 min-h-[58vh] max-h-[62vh] ${cardBg}`}>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.sender === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-sm shadow-md'
                        : darkMode
                        ? 'bg-[#1e273d] text-slate-100 rounded-bl-sm border border-slate-700/60'
                        : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.time}</span>
                </div>
              ))}

              {isTyping && (
                <div className="flex items-center gap-2 text-xs text-indigo-400 px-2 py-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Gemini 2.5 উত্তর লিখছে...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* মেসেজ ইনপুট */}
            <form onSubmit={handleSendMessage} className="mt-3 flex gap-2">
              <input
                type="text"
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                placeholder="যেকোনো প্রশ্ন, অঙ্ক বা অধ্যায়ের নাম লিখুন..."
                className={`flex-1 rounded-xl border px-4 py-3 text-sm outline-none focus:border-indigo-500 ${inputBg}`}
              />
              <button
                type="submit"
                disabled={isTyping || !inputMsg.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 rounded-xl flex items-center justify-center shadow-lg transition"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        )}

        {/* ট্যাব ২: STUDENT COMMUNITY CHAT (ব্যবহারকারীদের চ্যাট বক্স) */}
        {activeTab === 'community' && (
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Users className="w-4 h-4" /> Student Study Group Chat
              </span>
              <span className="text-[11px] text-slate-400">
                {user ? `লগইন: ${user.name}` : 'মেসেজ পাঠাতে Sign In করুন'}
              </span>
            </div>

            <div className={`flex-1 rounded-2xl border p-3 overflow-y-auto space-y-3 min-h-[58vh] max-h-[62vh] ${cardBg}`}>
              {communityMsgs.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[11px] font-semibold text-indigo-400 mb-0.5 px-1">
                    {m.isMe ? `${m.user} (আপনি)` : m.user}
                  </span>
                  <div
                    className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      m.isMe
                        ? 'bg-emerald-600 text-white rounded-br-sm'
                        : darkMode
                        ? 'bg-[#1e273d] text-slate-100 rounded-bl-sm border border-slate-700/60'
                        : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                    }`}
                  >
                    {m.text}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 px-1">{m.time}</span>
                </div>
              ))}
              <div ref={commEndRef} />
            </div>

            <form onSubmit={handleSendCommunityMsg} className="mt-3 flex gap-2">
              <input
                type="text"
                value={commInput}
                onChange={(e) => setCommInput(e.target.value)}
                placeholder={user ? "গ্রুপে আপনার প্রশ্ন বা নোট শেয়ার করুন..." : "চ্যাট করতে প্রথমে ওপরে Sign In করুন..."}
                className={`flex-1 rounded-xl border px-4 py-3 text-sm outline-none focus:border-emerald-500 ${inputBg}`}
              />
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 rounded-xl flex items-center justify-center shadow-lg transition"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        )}

        {/* ট্যাব ৩: EXAM SIMULATOR */}
        {activeTab === 'exam' && (
          <div className="space-y-4">
            <div className={`p-4 rounded-2xl border ${cardBg}`}>
              <h2 className="font-bold text-base flex items-center gap-2 mb-1">
                <HelpCircle className="w-5 h-5 text-indigo-400" /> AI Mock Exam Simulator
              </h2>
              <p className="text-xs text-slate-400 mb-3">
                যেকোনো অধ্যায়ের নাম লিখুন—AI ৫টি MCQ প্রশ্ন তৈরি করবে এবং ভুল উত্তরগুলো স্বয়ংক্রিয়ভাবে Mistake Log-এ জমা রাখবে।
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={examTopic}
                  onChange={(e) => setExamTopic(e.target.value)}
                  placeholder="যেমন: দ্বিঘাত সমীকরণ, আলোর প্রতিসরণ..."
                  className={`flex-1 rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 ${inputBg}`}
                />
                <button
                  onClick={handleGenerateQuiz}
                  disabled={loadingQuiz || !examTopic.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition"
                >
                  {loadingQuiz ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>শুরু</span>
                </button>
              </div>
            </div>

            {loadingQuiz && (
              <div className={`p-8 rounded-2xl border text-center space-y-2 ${cardBg}`}>
                <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                <p className="text-sm font-medium">AI আপনার জন্য প্রশ্নপত্র তৈরি করছে...</p>
              </div>
            )}

            {quizQuestions.length > 0 && !quizFinished && (
              <div className={`p-5 rounded-2xl border space-y-4 ${cardBg}`}>
                <div className="flex items-center justify-between text-xs font-semibold text-indigo-400">
                  <span>প্রশ্ন {currentQIndex + 1} / {quizQuestions.length}</span>
                  <span>স্কোর: {quizScore}</span>
                </div>

                <h3 className="font-bold text-base leading-snug">
                  {quizQuestions[currentQIndex].question}
                </h3>

                <div className="space-y-2.5">
                  {quizQuestions[currentQIndex].options.map((opt, idx) => {
                    const isCorrect = idx === quizQuestions[currentQIndex].correctIndex;
                    const isSelected = idx === selectedOption;
                    let btnStyle = darkMode
                      ? 'bg-[#1a2236] border-slate-700 hover:border-indigo-500'
                      : 'bg-slate-50 border-slate-200 hover:border-indigo-500';

                    if (selectedOption !== null) {
                      if (isCorrect) btnStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-semibold';
                      else if (isSelected) btnStyle = 'bg-rose-500/20 border-rose-500 text-rose-300';
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => handleOptionSelect(idx)}
                        disabled={selectedOption !== null}
                        className={`w-full text-left p-3.5 rounded-xl border text-sm flex items-center justify-between transition ${btnStyle}`}
                      >
                        <span>{opt}</span>
                        {selectedOption !== null && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                        {selectedOption !== null && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {selectedOption !== null && (
                  <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs space-y-1">
                    <p className="font-bold text-indigo-300 flex items-center gap-1">
                      <Lightbulb className="w-3.5 h-3.5" /> ব্যাখ্যা:
                    </p>
                    <p className="leading-relaxed text-slate-300">{quizQuestions[currentQIndex].explanation}</p>
                  </div>
                )}

                {selectedOption !== null && (
                  <button
                    onClick={handleNextQuestion}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-1"
                  >
                    <span>{currentQIndex + 1 === quizQuestions.length ? 'ফলাফল দেখুন' : 'পরবর্তী প্রশ্ন'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {quizFinished && (
              <div className={`p-6 rounded-2xl border text-center space-y-3 ${cardBg}`}>
                <Award className="w-12 h-12 text-amber-400 mx-auto" />
                <h3 className="text-xl font-bold">পরীক্ষা সম্পন্ন হয়েছে!</h3>
                <p className="text-sm text-slate-400">
                  আপনার স্কোর: <span className="text-indigo-400 font-bold text-lg">{quizScore} / {quizQuestions.length}</span>
                </p>
                <button
                  onClick={handleGenerateQuiz}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5"
                >
                  <RotateCw className="w-4 h-4" /> আবার পরীক্ষা দিন
                </button>
              </div>
            )}
          </div>
        )}

        {/* ট্যাব ৪: AI FLASHCARDS */}
        {activeTab === 'flashcards' && (
          <div className="space-y-4">
            <div className={`p-4 rounded-2xl border ${cardBg}`}>
              <h2 className="font-bold text-base flex items-center gap-2 mb-1">
                <Layers className="w-5 h-5 text-violet-400" /> AI Smart Flashcards
              </h2>
              <p className="text-xs text-slate-400 mb-3">
                যেকোনো অধ্যায় বা টপিকের নাম দিন—AI গুরুত্বপূর্ণ সূত্র ও সংজ্ঞার ফ্ল্যাশকার্ড তৈরি করে দেবে।
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={flashTopic}
                  onChange={(e) => setFlashTopic(e.target.value)}
                  placeholder="যেমন: ত্রিকোণমিতির সূত্র, রাসায়নিক বিক্রিয়া..."
                  className={`flex-1 rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:border-violet-500 ${inputBg}`}
                />
                <button
                  onClick={handleGenerateFlashcards}
                  disabled={loadingFlash || !flashTopic.trim()}
                  className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5"
                >
                  {loadingFlash ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>তৈরি</span>
                </button>
              </div>
            </div>

            {flashcards.length > 0 && (
              <div className="space-y-3">
                <div
                  onClick={() => setIsFlipped(!isFlipped)}
                  className={`min-h-[220px] p-6 rounded-2xl border-2 cursor-pointer flex flex-col items-center justify-center text-center transition-all select-none ${
                    isFlipped
                      ? 'border-violet-500 bg-violet-600/15'
                      : `${cardBg} hover:border-violet-500/60`
                  }`}
                >
                  <span className="text-[11px] uppercase tracking-wider font-bold text-violet-400 mb-3">
                    {isFlipped ? 'উত্তর / ব্যাখ্যা (ফ্লিপ করতে ট্যাপ করুন)' : `কার্ড ${cardIndex + 1} / ${flashcards.length} • প্রশ্ন (উত্তর দেখতে ট্যাপ করুন)`}
                  </span>
                  <p className="text-base font-semibold leading-relaxed">
                    {isFlipped ? flashcards[cardIndex].back : flashcards[cardIndex].front}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => {
                      setIsFlipped(false);
                      setCardIndex((prev) => (prev === 0 ? flashcards.length - 1 : prev - 1));
                    }}
                    className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1 ${cardBg}`}
                  >
                    <ChevronLeft className="w-4 h-4" /> আগেরটি
                  </button>
                  <button
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="px-4 py-2.5 rounded-xl bg-violet-600/20 text-violet-300 border border-violet-500/30 text-sm font-semibold"
                  >
                    উল্টান
                  </button>
                  <button
                    onClick={() => {
                      setIsFlipped(false);
                      setCardIndex((prev) => (prev + 1) % flashcards.length);
                    }}
                    className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1 ${cardBg}`}
                  >
                    পরেরটি <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ট্যাব ৫: SMART STUDY NOTES */}
        {activeTab === 'notes' && (
          <div className="space-y-4">
            <div className={`p-4 rounded-2xl border ${cardBg}`}>
              <h2 className="font-bold text-base flex items-center gap-2 mb-1">
                <BookOpen className="w-5 h-5 text-emerald-400" /> AI Study Notes Generator
              </h2>
              <p className="text-xs text-slate-400 mb-3">
                পরীক্ষার আগে দ্রুত রিভিশনের জন্য যেকোনো বিষয়ের গোছানো নোট তৈরি ও সেভ করে রাখুন।
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={noteTopic}
                  onChange={(e) => setNoteTopic(e.target.value)}
                  placeholder="যেমন: কোষ বিভাজন, বায়ুমণ্ডলের স্তরবিন্যাস..."
                  className={`flex-1 rounded-xl border px-3.5 py-2.5 text-sm outline-none focus:border-emerald-500 ${inputBg}`}
                />
                <button
                  onClick={handleGenerateNote}
                  disabled={loadingNote || !noteTopic.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5"
                >
                  {loadingNote ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  <span>নোট</span>
                </button>
              </div>
            </div>

            {notesList.length === 0 ? (
              <div className={`p-8 rounded-2xl border text-center text-xs text-slate-400 ${cardBg}`}>
                এখনো কোনো নোট তৈরি করা হয়নি। ওপরে বিষয়ের নাম লিখে প্রথম নোটটি তৈরি করুন!
              </div>
            ) : (
              <div className="space-y-3">
                {notesList.map((note) => (
                  <div key={note.id} className={`p-4 rounded-2xl border space-y-2 ${cardBg}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-base text-emerald-400">{note.title}</h3>
                        <span className="text-[10px] text-slate-400">{note.date}</span>
                      </div>
                      <button
                        onClick={() => setNotesList((prev) => prev.filter((n) => n.id !== note.id))}
                        className="text-slate-400 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap border-t border-slate-700/40 pt-2">
                      {note.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ট্যাব ৬: MISTAKE LOG & DASHBOARD */}
        {activeTab === 'mistakes' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2.5">
              <div className={`p-3 rounded-2xl border text-center ${cardBg}`}>
                <Trophy className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                <div className="text-base font-bold">{xp}</div>
                <div className="text-[10px] text-slate-400">মোট XP</div>
              </div>
              <div className={`p-3 rounded-2xl border text-center ${cardBg}`}>
                <Flame className="w-5 h-5 text-orange-400 mx-auto mb-1" />
                <div className="text-base font-bold">{streak} দিন</div>
                <div className="text-[10px] text-slate-400">স্টাডি স্ট্রিক</div>
              </div>
              <div className={`p-3 rounded-2xl border text-center ${cardBg}`}>
                <AlertTriangle className="w-5 h-5 text-rose-400 mx-auto mb-1" />
                <div className="text-base font-bold">{mistakes.length}</div>
                <div className="text-[10px] text-slate-400">ভুল প্রশ্ন</div>
              </div>
            </div>

            {mistakes.length === 0 ? (
                          <div className={`p-8 rounded-2xl border text-center text-xs text-slate-400 ${cardBg}`}>
                এখনো কোনো ভুল প্রশ্ন জমা নেই। Exam ট্যাবে গিয়ে মক টেস্ট দিলে ভুল উত্তরগুলো এখানে চলে আসবে।
              </div>
            ) : (
              <div className="space-y-3">
                {mistakes.map((m) => (
                  <div key={m.id} className={`p-4 rounded-2xl border space-y-2.5 ${cardBg}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-500/15 text-rose-400">
                        {m.topic}
                      </span>
                      <button
                        onClick={() => setMistakes((prev) => prev.filter((item) => item.id !== m.id))}
                        className="text-slate-400 hover:text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="font-semibold text-sm">{m.question}</p>
                    <div className="text-xs space-y-1">
                      <p className="text-rose-400">❌ আপনার উত্তর: {m.yourAnswer}</p>
                      <p className="text-emerald-400">✅ সঠিক উত্তর: {m.correctAnswer}</p>
                    </div>

                    {m.aiDeepDive ? (
                      <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs leading-relaxed whitespace-pre-wrap">
                        {m.aiDeepDive}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleExplainMistake(m)}
                        disabled={explainingId === m.id}
                        className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium inline-flex items-center gap-1.5"
                      >
                        {explainingId === m.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        <span>AI দিয়ে বিস্তারিত বুঝুন</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* বটম নেভিগেশন বার (৬টি সম্পূর্ণ ফিচার ট্যাব) */}
      <nav className={`fixed bottom-0 inset-x-0 z-30 border-t backdrop-blur-md ${darkMode ? 'bg-[#0f1524]/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
        <div className="max-w-3xl mx-auto grid grid-cols-6 py-1.5">
          {[
            { id: 'tutor', label: 'AI Tutor', icon: Brain },
            { id: 'community', label: 'Chat', icon: MessageSquare },
            { id: 'exam', label: 'Exam', icon: HelpCircle },
            { id: 'flashcards', label: 'Cards', icon: Layers },
            { id: 'notes', label: 'Notes', icon: BookOpen },
            { id: 'mistakes', label: 'Mistakes', icon: AlertTriangle, badge: mistakes.length }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1.5 text-[10px] sm:text-[11px] font-medium transition ${
                  isActive ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 mb-0.5 ${isActive ? 'text-indigo-400 scale-110 transition-transform' : ''}`} />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="absolute top-1 right-2 bg-rose-500 text-white text-[9px] font-bold px-1.5 rounded-full">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
