'use client';

import { useState, useEffect, FormEvent, useRef } from 'react';
import type { MouseEvent } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Globe, Send, MessageCircle, RefreshCw, ChevronDown, Check, ArrowLeftRight, Mic, Square } from 'lucide-react';

// API URL
const RAW_API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '')
const API_URL = RAW_API_BASE.endsWith('/api') ? RAW_API_BASE : `${RAW_API_BASE}/api`

// Types
type RecognitionConstructor = new () => ISpeechRecognition;

interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: ISpeechRecognitionEvent) => unknown) | null;
  onstart: (() => unknown) | null;
  onerror: ((ev: unknown) => unknown) | null;
  onend: (() => unknown) | null;
  start(): void;
  stop(): void;
}

interface ISpeechRecognitionEvent {
  resultIndex: number;
  results: ISpeechRecognitionResultList;
}

type ISpeechRecognitionResultList = ArrayLike<ISpeechRecognitionResult>;

interface ISpeechRecognitionResult extends ArrayLike<{ transcript: string }> {
  isFinal: boolean;
}

interface Message {
  id: number;
  sender: string;
  senderType: string;
  content: string;
  originalContent: string;
  originalLanguage: string;
  translatedLanguage: string;
  timestamp: string;
}

export default function AnonymousChat() {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [userName, setUserName] = useState('Anonymous');
  const [languages, setLanguages] = useState<Record<string, string>>({});
  const [sourceLanguage, setSourceLanguage] = useState<string>('auto');
  const [targetLanguage, setTargetLanguage] = useState<string>('en-IN');
  const [speaker, setSpeaker] = useState<'you' | 'native'>('you');
  const [isLoading, setIsLoading] = useState(false);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [renderTranslations, setRenderTranslations] = useState<Record<string, string>>({});
  const inFlightRef = useRef<Set<string>>(new Set());
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  
  // Initialize
  useEffect(() => {
    fetchMessages();
    fetchLanguages();
    
    // Live updates via Socket.IO
    const socketBase = RAW_API_BASE; // backend root, not /api
    const socket: Socket = io(socketBase, { transports: ['websocket'] });

    socket.on('connect', () => {
      // console.log('Native chat connected')
    });

    type NativePayload = {
      deleted_all?: boolean;
      id?: number;
      sender?: string;
      senderType?: string;
      content?: string;
      originalContent?: string;
      originalLanguage?: string;
      translatedLanguage?: string;
      timestamp?: string;
    };

    socket.on('native_message', (payload: NativePayload) => {
      if (payload && payload.deleted_all) {
        setMessages([]);
        return;
      }
      if (payload && payload.id) {
        setMessages((prev) => [...prev, payload as Message]);
      }
    });

    return () => {
      try { socket.disconnect(); } catch {}
    };
  }, []);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const fetchLanguages = async () => {
    try {
      const response = await axios.get(`${API_URL}/supported-languages`);
      if (response.data.success) {
        setLanguages(response.data.languages);
        return;
      }
    } catch (err) {
      console.error('Failed to fetch languages:', err);
    }
    // Fallback languages if backend is unavailable
    setLanguages({
      'en-IN': 'English',
      'hi-IN': 'Hindi',
      'ta-IN': 'Tamil',
      'te-IN': 'Telugu',
      'kn-IN': 'Kannada',
      'ml-IN': 'Malayalam',
      'mr-IN': 'Marathi',
      'bn-IN': 'Bengali',
      'gu-IN': 'Gujarati',
      'pa-IN': 'Punjabi',
      'or-IN': 'Odia'
    })
  };
  
  const fetchMessages = async () => {
    try {
      const response = await axios.get(`${API_URL}/messages`);
      if (response.data.success) {
        setMessages(response.data.messages);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  };
  
  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;
    
    try {
      setIsLoading(true);
      
      const displayLang = sourceLanguage !== 'auto' ? sourceLanguage : 'en-IN';
      const payload = speaker === 'you'
        ? {
          message: newMessage,
            originalLang: sourceLanguage,
            targetLang: targetLanguage,
            senderType: 'you',
            senderName: userName || 'You'
          }
        : {
            message: newMessage,
            originalLang: targetLanguage, // they speak this
            targetLang: displayLang,      // translate to me
            senderType: 'native',
            senderName: 'Native'
          };

      const response = await axios.post(`${API_URL}/messages`, payload);
      
      if (response.data.success) {
        setNewMessage('');
        if (speaker === 'you' && sourceLanguage === 'auto') {
          const detected = response.data?.message?.originalLanguage;
          if (detected) setSourceLanguage(detected);
        }
        fetchMessages(); // Refresh messages
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Voice input using Web Speech API (fallback to alert if unavailable)
  const startVoice = () => {
    try {
      const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
      const SpeechRecognitionCtor: RecognitionConstructor | null = w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
      if (!SpeechRecognitionCtor) {
        // Fallback to MediaRecorder + server STT
        startMediaRecorder();
        setIsRecording(true);
        return;
      }

      const rec = new SpeechRecognitionCtor();
      rec.continuous = true;
      rec.interimResults = true;

      // Decide recognition language based on current speaker
      const youLang = sourceLanguage !== 'auto' ? sourceLanguage : 'en-IN';
      const recLang = speaker === 'you' ? youLang : targetLanguage;
      rec.lang = recLang.split('-')[0];

      let finalTranscript = '';

      rec.onresult = (event: ISpeechRecognitionEvent) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interim += transcript;
          }
        }
        setNewMessage((finalTranscript || interim).trim());
      };

      rec.onstart = () => {
        setIsRecording(true);
      };
      rec.onerror = () => {
        // Fallback to MediaRecorder if browser recognition is flaky
        try { rec.stop(); } catch {}
        recognitionRef.current = null;
        startMediaRecorder();
      };
      rec.onend = () => {
        // Chrome often ends recognition after short silence; restart if still recording
        if (recognitionRef.current) {
          try {
            if (isRecording) {
              rec.start();
              return;
            }
          } catch {
            // ignore
          }
        }
        setIsRecording(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      console.error('Voice start error', e);
      setIsRecording(false);
    }
  };

  const stopVoice = () => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch {
      // ignore
    } finally {
      setIsRecording(false);
    }
  };

  // Fallback: MediaRecorder + server STT
  const startMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) mediaChunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const blob = new Blob(mediaChunksRef.current, { type: 'audio/webm' });
        mediaChunksRef.current = [];
        const file = new File([blob], 'audio.webm', { type: 'audio/webm' });
        const form = new FormData();
        form.append('audio', file);
        const youLang = sourceLanguage !== 'auto' ? sourceLanguage : 'en-IN';
        const recLang = speaker === 'you' ? youLang : targetLanguage;
        form.append('source_language_code', recLang);
        try {
          const res = await fetch(`${API_URL}/stt`, { method: 'POST', body: form });
          const data = await res.json();
          if (data?.success && data.transcript) {
            setNewMessage((data.transcript as string).trim());
          }
        } catch (err) {
          console.error('STT upload failed', err);
        }
      };
      mediaRecorderRef.current = rec;
      rec.start();
    } catch (e) {
      console.error('MediaRecorder failed', e);
    }
  };
  
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async (e?: MouseEvent<HTMLButtonElement>) => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const clearChat = e ? (e.shiftKey === true) : false;
      if (clearChat) {
        try {
          await axios.delete(`${API_URL}/messages`)
        } catch (err) {
          console.error('Failed to clear messages:', err)
        }
      }
      await fetchMessages();
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const toggleSourceDropdown = () => setShowSourceDropdown(!showSourceDropdown);
  const toggleTargetDropdown = () => setShowTargetDropdown(!showTargetDropdown);
  const selectSourceLanguage = (code: string) => { setSourceLanguage(code); setShowSourceDropdown(false); };
  const selectTargetLanguage = (code: string) => { setTargetLanguage(code); setShowTargetDropdown(false); };
  const swapLanguages = () => {
    setSourceLanguage((prevSource) => {
      const newSource = targetLanguage;
      setTargetLanguage(prevSource);
      return newSource;
    });
  };

  // Build language list with Auto option for source
  const languagesWithAuto: Record<string, string> = { 'auto': 'Auto-detect', ...languages };

  // Ensure display translations for both directions
  useEffect(() => {
    const displayLang = sourceLanguage !== 'auto' ? sourceLanguage : 'en-IN';
    messages.forEach((m) => {
      // Inbound: translate to my display language
      if (m.sender !== userName) {
        const keyIn = `${m.id}:${displayLang}`;
        if (m.translatedLanguage === displayLang) {
          setRenderTranslations((prev) => (prev[keyIn] ? prev : { ...prev, [keyIn]: m.content }));
        } else if (!renderTranslations[keyIn] && !inFlightRef.current.has(keyIn)) {
          inFlightRef.current.add(keyIn);
          axios.post(`${API_URL}/translate`, {
            input: m.originalContent,
            source_language_code: m.originalLanguage || 'auto',
            target_language_code: displayLang
          }).then((res) => {
            const txt = res.data?.translated_text || m.content;
            setRenderTranslations((prev) => ({ ...prev, [keyIn]: txt }));
          }).catch(() => {
            setRenderTranslations((prev) => ({ ...prev, [keyIn]: m.content }));
          }).finally(() => {
            inFlightRef.current.delete(keyIn);
          });
        }
      }

      // Outbound: translate to their language (current targetLanguage)
      const keyOut = `${m.id}:${targetLanguage}`;
      if (m.sender === userName) {
        if (m.translatedLanguage === targetLanguage) {
          setRenderTranslations((prev) => (prev[keyOut] ? prev : { ...prev, [keyOut]: m.content }));
        } else if (!renderTranslations[keyOut] && !inFlightRef.current.has(keyOut)) {
          inFlightRef.current.add(keyOut);
          axios.post(`${API_URL}/translate`, {
            input: m.originalContent,
            source_language_code: m.originalLanguage || 'auto',
            target_language_code: targetLanguage
          }).then((res) => {
            const txt = res.data?.translated_text || m.content;
            setRenderTranslations((prev) => ({ ...prev, [keyOut]: txt }));
          }).catch(() => {
            setRenderTranslations((prev) => ({ ...prev, [keyOut]: m.content }));
          }).finally(() => {
            inFlightRef.current.delete(keyOut);
          });
        }
      }
    });
  }, [messages, targetLanguage, sourceLanguage, userName, renderTranslations]);

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Globe className="h-6 w-6" />
            <h1 className="text-xl font-bold">Live Translation Chat</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Source language */}
            <div className="relative">
              <button
                className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 rounded-md px-3 py-2 transition-colors"
                onClick={toggleSourceDropdown}
              >
                <span>You speak: {languagesWithAuto[sourceLanguage] || sourceLanguage}</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              {showSourceDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg overflow-hidden z-50">
                  <div className="py-1 max-h-60 overflow-y-auto">
                    {Object.entries(languagesWithAuto).map(([code, name]) => (
              <button
                        key={code}
                        className={`flex items-center w-full px-4 py-2 text-sm text-left ${
                          sourceLanguage === code
                            ? 'bg-blue-100 text-blue-700'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                        onClick={() => selectSourceLanguage(code)}
                      >
                        {name}
                        {sourceLanguage === code && (
                          <Check className="h-4 w-4 ml-auto" />
                        )}
              </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Swap */}
            <button
              className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors"
              onClick={swapLanguages}
              title="Swap languages"
            >
              <ArrowLeftRight className="h-5 w-5" />
            </button>

            {/* Target language */}
            <div className="relative">
              <button
                className="flex items-center space-x-2 bg-white/20 hover:bg-white/30 rounded-md px-3 py-2 transition-colors"
                onClick={toggleTargetDropdown}
              >
                <span>They speak: {languages[targetLanguage] || 'Select Language'}</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              {showTargetDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg overflow-hidden z-50">
                  <div className="py-1 max-h-60 overflow-y-auto">
                    {Object.entries(languages).map(([code, name]) => (
                      <button
                        key={code}
                        className={`flex items-center w-full px-4 py-2 text-sm text-left ${
                          targetLanguage === code
                            ? 'bg-blue-100 text-blue-700'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                        onClick={() => selectTargetLanguage(code)}
                      >
                        {name}
                        {targetLanguage === code && (
                          <Check className="h-4 w-4 ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Voice and Refresh buttons */}
            <button
              className={`bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors ${isRecording ? 'ring-2 ring-red-400' : ''}`}
              onClick={isRecording ? stopVoice : startVoice}
              title={isRecording ? 'Stop voice capture' : 'Start voice capture'}
            >
              {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            
            {/* Refresh button */}
            <button
              className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors disabled:opacity-60"
              onClick={handleRefresh}
              title="Refresh messages (Shift+Click to clear all)"
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin opacity-70' : ''}`} />
            </button>
          </div>
        </div>
      </header>
      
      {/* Name input */}
      <div className="bg-white shadow-sm p-3 border-b">
        <div className="container mx-auto flex items-center">
          <label className="text-gray-700 mr-2">Your Name:</label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Enter your name"
            className="border rounded-md px-3 py-1 flex-1 max-w-xs"
          />
          
        </div>
      </div>
      
      {/* Chat container */}
      <div className="flex-1 overflow-hidden container mx-auto p-4">
        <div className="bg-white rounded-lg shadow-md h-full flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <MessageCircle className="h-12 w-12 mb-2 text-gray-300" />
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-center"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-4xl">
                    {/* Left: You speak (your display language) or their message translated to you */}
                    <div className="rounded-lg p-3 bg-gray-100 text-gray-800">
                    <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-sm">{message.sender === userName ? (userName || 'You') : 'To You'}</span>
                        <span className="text-xs opacity-70">{formatTime(message.timestamp)}</span>
                      </div>
                      {(() => {
                        const displayLang = sourceLanguage !== 'auto' ? sourceLanguage : 'en-IN';
                        if (message.sender === userName) {
                          return (
                            <p className="whitespace-pre-wrap break-words" lang={(message.originalLanguage || 'en-IN').split('-')[0]} dir="auto">{message.originalContent}</p>
                          );
                        }
                        const key = `${message.id}:${displayLang}`;
                        const txt = (message.translatedLanguage === displayLang ? message.content : renderTranslations[key]) || message.originalContent;
                        return (
                          <p className="whitespace-pre-wrap break-words" lang={(displayLang || 'en-IN').split('-')[0]} dir="auto">{txt}</p>
                        );
                      })()}
                    </div>
                    
                    {/* Right: They speak (delivered to them) or their original */}
                    <div className="rounded-lg p-3 bg-blue-600 text-white">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-sm">{message.sender === userName ? (languages[targetLanguage] || targetLanguage) : 'Original'}</span>
                        <span className="text-xs opacity-80">{formatTime(message.timestamp)}</span>
                      </div>
                      {message.sender === userName ? (
                        <p className="whitespace-pre-wrap break-words" lang={(targetLanguage || 'en-IN').split('-')[0]} dir="auto">{renderTranslations[`${message.id}:${targetLanguage}`] || (message.translatedLanguage === targetLanguage ? message.content : '…')}</p>
                      ) : (
                        <p className="whitespace-pre-wrap break-words" lang={(message.originalLanguage || 'en-IN').split('-')[0]} dir="auto">{message.originalContent}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Message input */}
          <div className="border-t p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 bg-gray-100 rounded-md p-1">
                <button
                  type="button"
                  className={`px-3 py-1 rounded ${speaker === 'you' ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
                  onClick={() => setSpeaker('you')}
                  title="You are typing"
                >
                  You
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 rounded ${speaker === 'native' ? 'bg-blue-600 text-white' : 'text-gray-700'}`}
                  onClick={() => setSpeaker('native')}
                  title="Native is typing"
                >
                  Native
                </button>
              </div>
            </div>
            <form onSubmit={sendMessage} className="flex items-center space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                className={`bg-blue-600 text-white rounded-md px-4 py-2 flex items-center ${
                  isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'
                }`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Translating...
                  </span>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    Send
                  </>
                )}
              </button>
            </form>
            <div className="mt-2 text-xs text-gray-500 flex items-center">
              <Globe className="h-3 w-3 mr-1" />
              Messages will be automatically translated to {languages[targetLanguage] || targetLanguage}
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="bg-gray-800 text-white py-2 text-center text-xs">
        <div className="container mx-auto">
          <p>Powered by Sarvam AI Translation • Supports multiple Indian languages</p>
        </div>
      </footer>
    </div>
  );
}