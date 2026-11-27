import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { Bot, Brain, MessageSquare, Trophy, Sparkles, Sun, Moon, Send, Users } from 'lucide-react';

// Safe Firebase Initialization (Won't crash if keys are not set yet)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:000:web:000"
};

let auth = null;
let db = null;
try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase running in offline/demo mode");
}

export default function App() {
  const [user, setUser] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState('tutor');
  const [xp, setXp] = useState(120);
  const [toast, setToast] = useState(null);

  // AI Tutor State
  const [selectedPersona, setSelectedPersona] = useState('Friendly Tutor');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: 'স্বাগতম! আমি EduNexus AI। পড়াশোনার যেকোনো প্রশ্ন, অঙ্ক বা বিজ্ঞানের বিষয় আমাকে জিজ্ঞাসা করতে পারো!',
      time: 'Now'
    }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Exam Simulator State
  const [examTopic, setExamTopic] = useState('');
  const [examDifficulty, setExamDifficulty] = useState('Medium');
  const [examQuestions, setExamQuestions] = useState([]);
  const [examAnswers, setExamAnswers] = useState({});
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [isGeneratingExam, setIsGeneratingExam] = useState(false);

  // Community Chat State
  const [globalMessages, setGlobalMessages] = useState([
    { id: '1', name: 'EduNexus Bot', text: 'Welcome to the Global Study Lounge! Share your study goals here.' }
  ]);
  const [globalInput, setGlobalInput] = useState('');

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        signInAnonymously(auth).catch(() => {});
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!db || firebaseConfig.apiKey === "demo-key") return;
    try {
      const q = query(collection(db, 'global_chat'), orderBy('createdAt', 'asc'), limit(30));
      const unsub = onSnapshot(q, (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (list.length > 0) setGlobalMessages(list);
      });
      return () => unsub();
    } catch (e) {}
  }, []);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || isGenerating) return;
    const promptText = chatInput.trim();
    setChatInput('');
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [...prev, { role: 'user', text: promptText, time: timeNow }]);
    setIsGenerating(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
      const personaPrompt = selectedPersona === 'Socratic Mentor'
        ? 'You are a Socratic Mentor. Guide the student with questions.'
        : selectedPersona === 'Strict Examiner'
        ? 'You are a Strict Examiner. Be concise and rigorous.'
        : 'You are EduNexus AI, a friendly personal study tutor.';

      if (!apiKey) {
        await new Promise((r) => setTimeout(r, 600));
        setMessages((prev) => [
          ...prev,
          {
            role: 'ai',
            text: `(${selectedPersona} - Demo Mode)\n\nতোমার প্রশ্ন: "${promptText}"\n\nউত্তর: এটি একটি চমৎকার বিষয়! মূল ধারণাটি ধাপে ধাপে বুঝে নিলে এবং সূত্রগুলো অনুশীলন করলে সহজেই আয়ত্ত করতে পারবে। (আসল AI উত্তর পেতে Vercel-এ VITE_GEMINI_API_KEY যুক্ত করো।)`,
            time: timeNow
          }
        ]);
      } else {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${personaPrompt}\n\nStudent Question: ${promptText}` }] }]
          })
        });
        const data = await res.json();
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || `Google Error: ${data?.error?.message || JSON.stringify(data)}`;
setMessages((prev) => [...prev, { role: 'ai', text: reply, time: timeNow }]);
      }
      setXp((prev) => prev + 10);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'ai', text: 'নেটওয়ার্ক সমস্যা হয়েছে, আবার চেষ্টা করুন।', time: timeNow }]);
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
        await new Promise((r) => setTimeout(r, 600));
        setExamQuestions([
          {
            q: `${examTopic} সম্পর্কে নিচের কোনটি সবচেয়ে গুরুত্বপূর্ণ?`,
            options: ['মৌলিক সূত্র ও ধারণা বোঝা', 'না বুঝে মুখস্থ করা', 'অনুশীলন না করা', 'কোনোটিই নয়'],
            answer: 0
          },
          {
            q: `${examTopic}-এর সমস্যা সমাধানের সঠিক ধাপ কোনটি?`,
            options: ['সরাসরি উত্তর অনুমান করা', 'ধাপে ধাপে বিশ্লেষণ করা', 'একক বাদ দেওয়া', 'সবগুলো'],
            answer: 1
          }
        ]);
      } else {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Generate 3 multiple-choice questions on "${examTopic}" (Difficulty: ${examDifficulty}). Return ONLY valid JSON array: [{"q":"question","options":["A","B","C","D"],"answer":0}]`
              }]
            }]
          })
        });
        const data = await res.json();
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
        if (Array.isArray(parsed) && parsed.length > 0) setExamQuestions(parsed);
      }
    } catch (e) {
      notify('কুইজ তৈরি করা যায়নি, অন্য টপিক দিয়ে চেষ্টা করুন।');
    } finally {
      setIsGeneratingExam(false);
    }
  };

  const handleSendGlobalChat = async (e) => {
    e?.preventDefault();
    if (!globalInput.trim()) return;
    const text = globalInput.trim();
    setGlobalInput('');
    setGlobalMessages((prev) => [...prev, { id: Date.now().toString(), name: user?.displayName || 'You', text }]);
    setXp((prev) => prev + 5);

    if (db && firebaseConfig.apiKey !== "demo-key") {
      try {
        await addDoc(collection(db, 'global_chat'), {
          text,
          uid: user?.uid || 'guest',
          name: user?.displayName || 'Scholar',
          createdAt: Date.now()
        });
      } catch (e) {}
    }
  };

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} transition-colors`}>
      <header className="sticky top-0 z-30 backdrop-blur-md bg-indigo-600 text-white px-4 py-3 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-amber-300" />
          <span className="font-bold text-lg tracking-tight">EduNexus AI</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-full">⚡ {xp} XP</span>
          <button onClick={() => setDarkMode(!darkMode)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {user && !user.isAnonymous ? (
            <button onClick={() => signOut(auth)} className="text-xs bg-rose-500 px-2.5 py-1 rounded-lg font-medium">Logout</button>
          ) : (
            <button
              onClick={() => auth && signInWithPopup(auth, new GoogleAuthProvider()).catch(() => notify('Demo mode active'))}
              className="text-xs bg-white text-indigo-700 font-semibold px-3 py-1 rounded-lg shadow"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {toast && (
        <div className="fixed top-16 right-4 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg border border-indigo-500/40">
          {toast}
        </div>
      )}

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

            <div className={`h-[56vh] overflow-y-auto rounded-2xl p-4 space-y-3 border ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'}`}>
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
              {isGenerating && <p className="text-xs text-indigo-400 animate-pulse">AI Tutor উত্তর লিখছে...</p>}
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="যেকোনো প্রশ্ন লিখুন..."
                className={`flex-1 rounded-xl px-3.5 py-2.5 text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
              />
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm flex items-center">
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
                placeholder="বিষয়ের নাম লিখুন (যেমন: ত্রিকোণমিতি, কোষ বিভাজন)"
                className={`flex-1 min-w-[180px] rounded-xl px-3.5 py-2 text-sm border ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
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
                {isGeneratingExam ? 'তৈরি হচ্ছে...' : 'Start Quiz'}
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
                  setXp((prev) => prev + 25);
                  notify('+25 XP অর্জন করেছো!');
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
                placeholder="সবার সাথে মেসেজ শেয়ার করুন..."
                className={`flex-1 rounded-xl px-3.5 py-2 text-sm border ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
              />
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium">Post</button>
            </form>
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="space-y-3">
            <h2 className="font-bold text-base flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" /> Top Scholars Leaderboard
            </h2>
            <div className={`rounded-2xl border divide-y ${darkMode ? 'bg-slate-900 border-slate-800 divide-slate-800' : 'bg-white border-slate-200 divide-slate-100'}`}>
              {[
                { name: user?.displayName || 'You (Active)', xp },
                { name: 'Aarav Sharma', xp: 450 },
                { name: 'Ananya Das', xp: 390 }
              ]
                .sort((a, b) => b.xp - a.xp)
                .map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-indigo-500">#{idx + 1}</span>
                      <span>{entry.name}</span>
                    </div>
                    <span className="font-semibold text-amber-500">{entry.xp} XP</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </main>

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
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl text-xs font-medium ${active ? 'text-indigo-500' : 'text-slate-400'}`}
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
