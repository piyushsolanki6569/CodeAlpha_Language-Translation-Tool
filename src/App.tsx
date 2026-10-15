import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeftRight,
  Copy,
  Check,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  History,
  Star,
  Mic,
  MicOff,
  Languages,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  Search,
  Trash2,
  Info,
  BookOpen,
} from 'lucide-react';
import {
  LANGUAGES,
  POPULAR_LANG_CODES,
  AUTO_DETECT,
  Language,
  getLanguageByCode,
  getLanguageByName,
} from './languages.ts';

interface TranslationResult {
  translatedText: string;
  detectedLanguage: string;
  detectedLanguageCode?: string;
  phoneticTranscription?: string;
  alternativeTranslations?: string[];
  linguisticNotes?: string;
  sourceText: string;
  targetLanguage: string;
  timestamp: string;
}

interface HistoryItem {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLangName: string;
  targetLangName: string;
  sourceLangCode: string;
  targetLangCode: string;
  timestamp: string;
  isFavorite: boolean;
}

const TONES = [
  { id: 'natural', label: 'Natural', desc: 'Everyday fluent phrasing' },
  { id: 'formal', label: 'Formal', desc: 'Polite, respectful register' },
  { id: 'casual', label: 'Casual', desc: 'Informal, friendly dialogue' },
  { id: 'business', label: 'Business', desc: 'Professional workplace communication' },
  { id: 'academic', label: 'Academic', desc: 'Scholarly, precise vocabulary' },
];

export default function App() {
  // Languages state
  const [sourceCode, setSourceCode] = useState<string>('auto');
  const [targetCode, setTargetCode] = useState<string>('es');

  // Input & Output
  const [sourceText, setSourceText] = useState<string>('');
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);

  // Status & loading
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<{ hasApiKey: boolean; checked: boolean }>({
    hasApiKey: false,
    checked: false,
  });

  // UI state
  const [selectedTone, setSelectedTone] = useState<string>('natural');
  const [copiedTarget, setCopiedTarget] = useState<boolean>(false);
  const [copiedSource, setCopiedSource] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechActive, setSpeechActive] = useState<'source' | 'target' | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<'source' | 'target' | null>(null);
  const [langSearch, setLangSearch] = useState<string>('');

  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('translation_history_v1');
      if (saved) {
        setHistoryItems(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Failed to load history:', e);
    }
  }, []);

  // Save history to localStorage
  const saveHistory = useCallback((items: HistoryItem[]) => {
    setHistoryItems(items);
    try {
      localStorage.setItem('translation_history_v1', JSON.stringify(items));
    } catch (e) {
      console.warn('Failed to persist history:', e);
    }
  }, []);

  // Check backend server status
  const checkServerStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data = await res.json();
        setApiStatus({ hasApiKey: Boolean(data.hasApiKey), checked: true });
      } else {
        setApiStatus({ hasApiKey: false, checked: true });
      }
    } catch {
      setApiStatus({ hasApiKey: false, checked: true });
    }
  }, []);

  useEffect(() => {
    checkServerStatus();
  }, [checkServerStatus]);

  // Handle Translate
  const handleTranslate = async () => {
    const trimmed = sourceText.trim();
    if (!trimmed) {
      setErrorMessage('Please type or paste text to translate.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const sourceLangObj = getLanguageByCode(sourceCode);
    const targetLangObj = getLanguageByCode(targetCode);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: trimmed,
          sourceLang: sourceCode === 'auto' ? 'auto' : sourceLangObj.name,
          targetLang: targetLangObj.name,
          tone: selectedTone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete translation.');
      }

      const result: TranslationResult = {
        translatedText: data.translatedText,
        detectedLanguage: data.detectedLanguage,
        detectedLanguageCode: data.detectedLanguageCode,
        phoneticTranscription: data.phoneticTranscription,
        alternativeTranslations: data.alternativeTranslations,
        linguisticNotes: data.linguisticNotes,
        sourceText: trimmed,
        targetLanguage: targetLangObj.name,
        timestamp: data.timestamp || new Date().toISOString(),
      };

      setTranslationResult(result);

      // Add to history
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        sourceText: trimmed,
        translatedText: data.translatedText,
        sourceLangName: sourceCode === 'auto' ? (data.detectedLanguage || 'Auto') : sourceLangObj.name,
        targetLangName: targetLangObj.name,
        sourceLangCode: sourceCode,
        targetLangCode: targetCode,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isFavorite: false,
      };

      saveHistory([newHistoryItem, ...historyItems.slice(0, 49)]);
    } catch (err: any) {
      console.error('Translation error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred during translation.');
    } finally {
      setIsLoading(false);
    }
  };

  // Keyboard shortcut: Ctrl+Enter or Cmd+Enter to translate
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleTranslate();
    }
  };

  // Clear button action
  const handleClear = () => {
    setSourceText('');
    setTranslationResult(null);
    setErrorMessage(null);
    if (speechActive) stopSpeech();
    textareaRef.current?.focus();
  };

  // Swap Languages action
  const handleSwap = () => {
    if (speechActive) stopSpeech();

    // Determine target of swap
    let newSourceCode = targetCode;
    let newTargetCode = sourceCode;

    // If source was 'auto', swap to detected language if available, or keep English
    if (sourceCode === 'auto') {
      if (translationResult?.detectedLanguageCode) {
        newTargetCode = translationResult.detectedLanguageCode;
      } else if (translationResult?.detectedLanguage) {
        const found = getLanguageByName(translationResult.detectedLanguage);
        newTargetCode = found ? found.code : 'en';
      } else {
        newTargetCode = 'en';
      }
    }

    setSourceCode(newSourceCode);
    setTargetCode(newTargetCode);

    // Swap texts if translation exists
    if (translationResult?.translatedText) {
      const prevTranslated = translationResult.translatedText;
      setSourceText(prevTranslated);
      setTranslationResult({
        ...translationResult,
        translatedText: sourceText,
        sourceText: prevTranslated,
      });
    }
  };

  // Copy to clipboard
  const handleCopy = async (text: string, isSource: boolean) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      if (isSource) {
        setCopiedSource(true);
        setTimeout(() => setCopiedSource(false), 2000);
      } else {
        setCopiedTarget(true);
        setTimeout(() => setCopiedTarget(false), 2000);
      }
    } catch (e) {
      console.error('Failed to copy text:', e);
    }
  };

  // Stop currently playing speech
  const stopSpeech = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeechActive(null);
  };

  // Text to Speech action: uses Gemini TTS backend with browser fallback
  const handleSpeak = async (text: string, langCode: string, type: 'source' | 'target') => {
    if (!text.trim()) return;

    if (speechActive === type) {
      stopSpeech();
      return;
    }

    stopSpeech();
    setSpeechActive(type);

    try {
      // 1. Attempt Gemini TTS from server
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.slice(0, 500),
          lang: langCode,
          voiceName: 'Kore',
        }),
      });

      const data = await response.json();

      if (response.ok && data.audioBase64) {
        const audioSrc = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
        const audio = new Audio(audioSrc);
        currentAudioRef.current = audio;

        audio.onended = () => {
          setSpeechActive(null);
          currentAudioRef.current = null;
        };

        audio.onerror = () => {
          fallbackBrowserTTS(text, langCode);
        };

        await audio.play();
        return;
      }

      // If server TTS was unavailable or indicated fallback
      fallbackBrowserTTS(text, langCode);
    } catch (e) {
      console.warn('Backend TTS failed, using browser speech synthesis:', e);
      fallbackBrowserTTS(text, langCode);
    }
  };

  // Fallback Web Speech Synthesis
  const fallbackBrowserTTS = (text: string, langCode: string) => {
    if (!('speechSynthesis' in window)) {
      setSpeechActive(null);
      return;
    }

    const langObj = getLanguageByCode(langCode);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langObj.speechCode || 'en-US';
    utterance.rate = 0.95;

    utterance.onend = () => {
      setSpeechActive(null);
    };

    utterance.onerror = () => {
      setSpeechActive(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Speech-to-Text / Microphone input
  const toggleVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage('Voice input is not supported in this browser. Please type your text.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;

      const sourceLangObj = getLanguageByCode(sourceCode);
      recognition.lang = sourceCode !== 'auto' ? sourceLangObj.speechCode : navigator.language || 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((r: any) => r[0].transcript)
          .join('');
        setSourceText(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  };

  const toggleFavoriteHistory = (id: string) => {
    const updated = historyItems.map((item) =>
      item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
    );
    saveHistory(updated);
  };

  const deleteHistoryItem = (id: string) => {
    const updated = historyItems.filter((item) => item.id !== id);
    saveHistory(updated);
  };

  const clearAllHistory = () => {
    saveHistory([]);
  };

  const loadFromHistory = (item: HistoryItem) => {
    setSourceCode(item.sourceLangCode);
    setTargetCode(item.targetLangCode);
    setSourceText(item.sourceText);
    setTranslationResult({
      translatedText: item.translatedText,
      detectedLanguage: item.sourceLangName,
      sourceText: item.sourceText,
      targetLanguage: item.targetLangName,
      timestamp: item.timestamp,
    });
    setShowHistory(false);
  };

  const currentSourceLang = getLanguageByCode(sourceCode);
  const currentTargetLang = getLanguageByCode(targetCode);

  const filteredHistory = historyItems.filter((item) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    return (
      item.sourceText.toLowerCase().includes(q) ||
      item.translatedText.toLowerCase().includes(q) ||
      item.sourceLangName.toLowerCase().includes(q) ||
      item.targetLangName.toLowerCase().includes(q)
    );
  });

  const filteredLanguages = LANGUAGES.filter((l) => {
    if (!langSearch.trim()) return true;
    const q = langSearch.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      l.nativeName.toLowerCase().includes(q) ||
      l.code.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Languages className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Language Translation Tool
                <span className="text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  AI Powered
                </span>
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                High-fidelity translation, speech synthesis, & linguistic context
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Server Connection status */}
            <div className="flex items-center">
              {apiStatus.checked && (
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                    apiStatus.hasApiKey
                      ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                      : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                  }`}
                  title={apiStatus.hasApiKey ? 'Gemini API is connected' : 'GEMINI_API_KEY is not detected'}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      apiStatus.hasApiKey ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  <span className="hidden md:inline">
                    {apiStatus.hasApiKey ? 'API Ready' : 'API Key Required'}
                  </span>
                </div>
              )}
            </div>

            {/* History Toggle Button */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-lg border transition-colors flex items-center gap-1.5 text-xs font-medium ${
                showHistory
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              title="Translation History"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
              {historyItems.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                  {historyItems.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* API Key notice banner if missing */}
      {apiStatus.checked && !apiStatus.hasApiKey && (
        <div className="bg-amber-950/40 border-b border-amber-800/50 px-4 py-3 text-xs sm:text-sm text-amber-200">
          <div className="max-w-6xl mx-auto flex items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="font-semibold text-amber-300">Configuration Notice: </span>
                <span>
                  The server requires <code className="bg-amber-900/60 px-1 py-0.5 rounded text-amber-100 font-mono">GEMINI_API_KEY</code> to perform live translations and speech synthesis. Please configure it in your server environment or Settings &gt; Secrets.
                </span>
              </div>
            </div>
            <button
              onClick={checkServerStatus}
              className="shrink-0 px-2.5 py-1 rounded bg-amber-800/60 hover:bg-amber-700/60 text-amber-100 text-xs font-medium transition-colors"
            >
              Re-check
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 w-full">
        {/* Tone Selector & Bar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-medium text-slate-300">Tone & Register:</span>
            <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-lg p-0.5">
              {TONES.map((tone) => (
                <button
                  key={tone.id}
                  onClick={() => setSelectedTone(tone.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    selectedTone === tone.id
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                  title={tone.desc}
                >
                  {tone.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <span className="text-slate-500">Shortcuts:</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px]">
              Ctrl + Enter
            </kbd>
            <span>to translate</span>
          </div>
        </div>

        {/* Translation Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative">
          {/* SOURCE CARD */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col shadow-xl backdrop-blur-sm overflow-hidden focus-within:border-indigo-500/50 transition-colors">
            {/* Source Header / Language Bar */}
            <div className="p-3 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                {/* Auto Detect Button */}
                <button
                  onClick={() => setSourceCode('auto')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 flex items-center gap-1.5 ${
                    sourceCode === 'auto'
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto Detect
                  {translationResult?.detectedLanguage && sourceCode === 'auto' && (
                    <span className="text-[11px] text-indigo-200 opacity-90 font-normal">
                      ({translationResult.detectedLanguage})
                    </span>
                  )}
                </button>

                {/* Popular Source Languages */}
                <div className="hidden sm:flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {POPULAR_LANG_CODES.slice(0, 4).map((code) => {
                    const lang = getLanguageByCode(code);
                    const isActive = sourceCode === code;
                    return (
                      <button
                        key={code}
                        onClick={() => setSourceCode(code)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                          isActive
                            ? 'bg-slate-800 text-white border border-slate-700'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                        }`}
                      >
                        <span className="mr-1">{lang.flag}</span>
                        {lang.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Source Language Dropdown trigger */}
              <div className="relative">
                <button
                  onClick={() =>
                    setActiveDropdown(activeDropdown === 'source' ? null : 'source')
                  }
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 flex items-center gap-1.5"
                >
                  <span>{currentSourceLang.flag}</span>
                  <span className="truncate max-w-[100px]">{currentSourceLang.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {activeDropdown === 'source' && (
                  <div className="absolute right-0 top-full mt-1.5 w-64 max-h-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-slate-800">
                      <div className="flex items-center px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
                        <Search className="w-3.5 h-3.5 text-slate-400 mr-2" />
                        <input
                          type="text"
                          placeholder="Search language..."
                          value={langSearch}
                          onChange={(e) => setLangSearch(e.target.value)}
                          className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto p-1 divide-y divide-slate-800/40 flex-1">
                      <button
                        onClick={() => {
                          setSourceCode('auto');
                          setActiveDropdown(null);
                          setLangSearch('');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between ${
                          sourceCode === 'auto'
                            ? 'bg-indigo-600/20 text-indigo-300'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span>✨</span>
                          <span>Auto Detect</span>
                        </span>
                        {sourceCode === 'auto' && <Check className="w-3.5 h-3.5" />}
                      </button>
                      {filteredLanguages.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setSourceCode(lang.code);
                            setActiveDropdown(null);
                            setLangSearch('');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between ${
                            sourceCode === lang.code
                              ? 'bg-indigo-600/20 text-indigo-300'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span>{lang.flag}</span>
                            <span>{lang.name}</span>
                            <span className="text-slate-500 text-[10px]">({lang.nativeName})</span>
                          </span>
                          {sourceCode === lang.code && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Source Textarea */}
            <div className="p-4 flex-1 flex flex-col min-h-[220px]">
              <textarea
                ref={textareaRef}
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type or paste text to translate..."
                className="w-full flex-1 bg-transparent text-slate-100 placeholder-slate-500 resize-none focus:outline-none text-base sm:text-lg leading-relaxed"
                rows={6}
                maxLength={5000}
              />

              {/* Source Action Bar */}
              <div className="pt-3 mt-auto border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  {/* Clear button */}
                  {sourceText && (
                    <button
                      onClick={handleClear}
                      className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-slate-200 transition-colors flex items-center gap-1"
                      title="Clear text"
                    >
                      <X className="w-4 h-4" />
                      <span className="hidden sm:inline">Clear</span>
                    </button>
                  )}

                  {/* Speech input */}
                  <button
                    onClick={toggleVoiceInput}
                    className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                      isListening
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                        : 'hover:bg-slate-800 hover:text-slate-200'
                    }`}
                    title={isListening ? 'Stop listening' : 'Voice input'}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    <span className="hidden sm:inline">
                      {isListening ? 'Listening...' : 'Voice'}
                    </span>
                  </button>

                  {/* Text-to-speech for source */}
                  {sourceText && (
                    <button
                      onClick={() =>
                        handleSpeak(
                          sourceText,
                          sourceCode === 'auto'
                            ? translationResult?.detectedLanguageCode || 'en'
                            : sourceCode,
                          'source'
                        )
                      }
                      className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                        speechActive === 'source'
                          ? 'bg-indigo-600/30 text-indigo-300'
                          : 'hover:bg-slate-800 hover:text-slate-200'
                      }`}
                      title={speechActive === 'source' ? 'Stop audio' : 'Listen to original'}
                    >
                      {speechActive === 'source' ? (
                        <VolumeX className="w-4 h-4 animate-pulse" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                      <span className="hidden sm:inline">Listen</span>
                    </button>
                  )}

                  {/* Copy source */}
                  {sourceText && (
                    <button
                      onClick={() => handleCopy(sourceText, true)}
                      className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-slate-200 transition-colors flex items-center gap-1"
                      title="Copy source text"
                    >
                      {copiedSource ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span className="hidden sm:inline">Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Character Counter */}
                <div className="font-mono text-[11px] text-slate-500">
                  {sourceText.length} / 5,000
                </div>
              </div>
            </div>
          </div>

          {/* SWAP BUTTON (Floats in center on desktop) */}
          <div className="flex items-center justify-center -my-2 lg:my-0 lg:absolute lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 z-30">
            <button
              onClick={handleSwap}
              className="p-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/30 transition-transform active:scale-95 border border-indigo-400/30 flex items-center justify-center group"
              title="Swap languages"
            >
              <ArrowLeftRight className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
            </button>
          </div>

          {/* TARGET CARD */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col shadow-xl backdrop-blur-sm overflow-hidden focus-within:border-indigo-500/50 transition-colors">
            {/* Target Header / Language Bar */}
            <div className="p-3 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 min-w-0">
                {POPULAR_LANG_CODES.slice(0, 5).map((code) => {
                  const lang = getLanguageByCode(code);
                  const isActive = targetCode === code;
                  return (
                    <button
                      key={code}
                      onClick={() => setTargetCode(code)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? 'bg-slate-800 text-white border border-slate-700'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      }`}
                    >
                      <span className="mr-1">{lang.flag}</span>
                      {lang.name}
                    </button>
                  );
                })}
              </div>

              {/* Target Language Dropdown trigger */}
              <div className="relative">
                <button
                  onClick={() =>
                    setActiveDropdown(activeDropdown === 'target' ? null : 'target')
                  }
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 flex items-center gap-1.5"
                >
                  <span>{currentTargetLang.flag}</span>
                  <span className="truncate max-w-[100px]">{currentTargetLang.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {activeDropdown === 'target' && (
                  <div className="absolute right-0 top-full mt-1.5 w-64 max-h-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-slate-800">
                      <div className="flex items-center px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
                        <Search className="w-3.5 h-3.5 text-slate-400 mr-2" />
                        <input
                          type="text"
                          placeholder="Search language..."
                          value={langSearch}
                          onChange={(e) => setLangSearch(e.target.value)}
                          className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto p-1 divide-y divide-slate-800/40 flex-1">
                      {filteredLanguages.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setTargetCode(lang.code);
                            setActiveDropdown(null);
                            setLangSearch('');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between ${
                            targetCode === lang.code
                              ? 'bg-indigo-600/20 text-indigo-300'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span>{lang.flag}</span>
                            <span>{lang.name}</span>
                            <span className="text-slate-500 text-[10px]">({lang.nativeName})</span>
                          </span>
                          {targetCode === lang.code && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Target Translation Area */}
            <div className="p-4 flex-1 flex flex-col min-h-[220px]">
              {isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3 py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <p className="text-sm font-medium">Translating with Gemini AI...</p>
                </div>
              ) : translationResult ? (
                <div className="flex-1 flex flex-col">
                  {/* Translated Text */}
                  <div className="text-slate-100 text-base sm:text-lg leading-relaxed select-text whitespace-pre-wrap">
                    {translationResult.translatedText}
                  </div>

                  {/* Phonetic / Romanization reading (e.g. Pinyin, Romaji) */}
                  {translationResult.phoneticTranscription && (
                    <div className="mt-3 pt-2 text-xs font-mono text-indigo-300/90 bg-indigo-950/30 px-3 py-1.5 rounded-lg border border-indigo-900/40">
                      <span className="text-slate-500 select-none mr-2">Pronunciation:</span>
                      {translationResult.phoneticTranscription}
                    </div>
                  )}

                  {/* Alternative translations */}
                  {translationResult.alternativeTranslations &&
                    translationResult.alternativeTranslations.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-slate-500 flex items-center gap-1">
                          <BookOpen className="w-3 h-3" /> Alternatives:
                        </span>
                        {translationResult.alternativeTranslations.map((alt, i) => (
                          <button
                            key={i}
                            onClick={() =>
                              setTranslationResult({
                                ...translationResult,
                                translatedText: alt,
                              })
                            }
                            className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                            title="Click to use this translation"
                          >
                            {alt}
                          </button>
                        ))}
                      </div>
                    )}

                  {/* Linguistic Notes */}
                  {translationResult.linguisticNotes && (
                    <div className="mt-2 text-[11px] text-slate-400 italic flex items-start gap-1">
                      <Info className="w-3 h-3 text-slate-500 mt-0.5 shrink-0" />
                      <span>{translationResult.linguisticNotes}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-600 py-8">
                  <Languages className="w-10 h-10 stroke-1 mb-2 opacity-50" />
                  <p className="text-sm">Translation will appear here</p>
                </div>
              )}

              {/* Target Action Bar */}
              <div className="pt-3 mt-auto border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  {/* Copy button */}
                  {translationResult?.translatedText && (
                    <button
                      onClick={() => handleCopy(translationResult.translatedText, false)}
                      className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-slate-200 transition-colors flex items-center gap-1"
                      title="Copy translation"
                    >
                      {copiedTarget ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400 font-medium">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Text-to-Speech button */}
                  {translationResult?.translatedText && (
                    <button
                      onClick={() =>
                        handleSpeak(translationResult.translatedText, targetCode, 'target')
                      }
                      className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                        speechActive === 'target'
                          ? 'bg-indigo-600/30 text-indigo-300'
                          : 'hover:bg-slate-800 hover:text-slate-200'
                      }`}
                      title={speechActive === 'target' ? 'Stop audio' : 'Listen to translation'}
                    >
                      {speechActive === 'target' ? (
                        <VolumeX className="w-4 h-4 animate-pulse" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                      <span>Listen</span>
                    </button>
                  )}
                </div>

                {/* Detected Language pill */}
                {translationResult?.detectedLanguage && (
                  <div className="text-[11px] text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-full border border-slate-700/50">
                    Detected: <span className="text-slate-200">{translationResult.detectedLanguage}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Translation Submit Bar */}
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="w-full sm:w-auto">
            {errorMessage && (
              <div className="flex items-center gap-2 text-rose-400 text-xs sm:text-sm bg-rose-950/40 border border-rose-900/60 px-3.5 py-2 rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          <div className="w-full sm:w-auto flex items-center gap-3 justify-end">
            <button
              onClick={handleTranslate}
              disabled={isLoading || !sourceText.trim()}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-sm shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Translating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Translate</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Features & Quick Info Cards */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-800/80 pt-8 text-xs text-slate-400">
          <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-slate-200 font-medium mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Real-Time Gemini AI
            </div>
            <p className="text-slate-400 leading-relaxed">
              Powered by Google Gemini 3.8 Flash for contextual translation, culturally adapted idioms, and accurate phrasing.
            </p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-slate-200 font-medium mb-1">
              <Volume2 className="w-4 h-4 text-indigo-400" />
              Lifelike Speech Synthesis
            </div>
            <p className="text-slate-400 leading-relaxed">
              Integrated Text-to-Speech enables listening to natural pronunciations with seamless browser fallback support.
            </p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-slate-200 font-medium mb-1">
              <History className="w-4 h-4 text-violet-400" />
              History & Favorites
            </div>
            <p className="text-slate-400 leading-relaxed">
              Track past translations, bookmark favorite expressions, and swap between 50+ international languages.
            </p>
          </div>
        </div>
      </main>

      {/* History Slide-out Drawer */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-400" />
                <h2 className="font-semibold text-white text-sm">Translation History</h2>
              </div>
              <div className="flex items-center gap-2">
                {historyItems.length > 0 && (
                  <button
                    onClick={clearAllHistory}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                    title="Clear history"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-slate-800/60">
              <div className="flex items-center px-3 py-2 rounded-xl bg-slate-950 border border-slate-800">
                <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Search saved translations..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-full"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {filteredHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  {historyItems.length === 0
                    ? 'No translations recorded yet. Translated items will appear here.'
                    : 'No matching items found.'}
                </div>
              ) : (
                filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors group relative"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                      <span className="font-medium text-slate-300">
                        {item.sourceLangName} → {item.targetLangName}
                      </span>
                      <div className="flex items-center gap-1">
                        <span>{item.timestamp}</span>
                        <button
                          onClick={() => toggleFavoriteHistory(item.id)}
                          className={`p-1 rounded hover:bg-slate-800 transition-colors ${
                            item.isFavorite ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          <Star className="w-3.5 h-3.5 fill-current" />
                        </button>
                        <button
                          onClick={() => deleteHistoryItem(item.id)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-2 mb-1">{item.sourceText}</p>
                    <p className="text-xs text-indigo-300 font-medium line-clamp-2">
                      {item.translatedText}
                    </p>
                    <button
                      onClick={() => loadFromHistory(item)}
                      className="mt-2 text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                    >
                      Load into editor →
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
