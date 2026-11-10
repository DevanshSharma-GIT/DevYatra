"use client"
import { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Mic, MicOff, Send, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Home() {
    const [isRecording, setIsRecording] = useState(false);
    const [messages, setMessages] = useState<{ text: string, isUser: boolean }[]>([]);
    const [status, setStatus] = useState('idle');
    const socketRef = useRef<any>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        socketRef.current = io('http://localhost:5000');
        socketRef.current.on('connect', () => {
            console.log('Connected to server');
            setStatus('connected');
        });
        socketRef.current.on('response', (data: { original_text: string, text: string, audio_chunks: string[] }) => {
            setMessages(prev => [
                ...prev,
                { text: data.original_text, isUser: true },
                { text: data.text, isUser: false }
            ]);
            playAudioChunks(data.audio_chunks);
            setStatus('idle');
        });
        socketRef.current.on('error', (error: { message: string }) => {
            console.error('Error:', error);
            setStatus('error');
        });
        return () => {
            socketRef.current.disconnect();
        };
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            mediaRecorderRef.current.ondataavailable = (event) => audioChunksRef.current.push(event.data);
            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                audioChunksRef.current = [];
                sendAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorderRef.current.start();
            setIsRecording(true);
            setStatus('recording');
        } catch (error) {
            console.error('Error starting recording:', error);
            setStatus('error');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setStatus('processing');
        }
    };

    const sendAudio = async (audioBlob: Blob) => {
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
            const base64Audio = (reader.result as string).split(',')[1];
            socketRef.current.emit('audio_message', { audio: base64Audio, auto_detect: true });
        };
    };

    const playAudioChunks = (audioChunks: string[]) => {
        if (!audioChunks || audioChunks.length === 0) return;
        let index = 0;
        const playNext = () => {
            if (index >= audioChunks.length) return;
            const audioData = audioChunks[index];
            const audioBlob = base64ToBlob(audioData, 'audio/wav');
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.onended = () => {
                index++;
                playNext();
            };
            audio.play();
        };
        playNext();
    };

    const base64ToBlob = (base64: string, mime: string) => {
        const byteCharacters = atob(base64);
        const byteNumbers = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        return new Blob([byteNumbers], { type: mime });
    };

    const getStatusText = () => {
        switch (status) {
            case 'idle': return 'Ready';
            case 'connected': return 'Connected';
            case 'recording': return 'Recording...';
            case 'processing': return 'Processing...';
            case 'error': return 'Error';
            default: return status;
        }
    };

    const getStatusColor = () => {
        switch (status) {
            case 'idle': return 'bg-green-500';
            case 'connected': return 'bg-green-500';
            case 'recording': return 'bg-red-500';
            case 'processing': return 'bg-amber-500';
            case 'error': return 'bg-red-600';
            default: return 'bg-gray-500';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-100 p-4 flex flex-col items-center">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-600 p-6 text-white">
                    <h1 className="text-2xl font-bold text-center">Travel Guide Voice Chatbot</h1>
                    <p className="text-orange-100 text-center text-sm mt-1">Ask me anything about your travel destination</p>
                </div>
                
                {/* Messages */}
                <div className="h-96 overflow-y-auto p-4 bg-orange-50">
                    <AnimatePresence>
                        {messages.length === 0 ? (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center h-full text-center text-gray-500"
                            >
                                <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-3">
                                    <Mic className="w-8 h-8 text-orange-500" />
                                </div>
                                <p>Tap the microphone button to start asking questions about your travel destination</p>
                            </motion.div>
                        ) : (
                            messages.map((msg, index) => (
                                <motion.div 
                                    key={index}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className={`mb-3 max-w-[85%] ${msg.isUser ? 'ml-auto' : 'mr-auto'}`}
                                >
                                    <div className={`p-3 rounded-2xl ${
                                        msg.isUser 
                                            ? 'bg-orange-500 text-white rounded-tr-none' 
                                            : 'bg-white border border-orange-200 rounded-tl-none'
                                    }`}>
                                        {msg.text}
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                </div>
                
                {/* Controls */}
                <div className="p-4 border-t border-orange-100 bg-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full mr-2 ${getStatusColor()}`}></div>
                            <span className="text-sm text-gray-600">{getStatusText()}</span>
                        </div>
                        
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-colors ${
                                isRecording 
                                    ? 'bg-red-500 hover:bg-red-600' 
                                    : 'bg-orange-500 hover:bg-orange-600'
                            }`}
                            disabled={status === 'processing'}
                        >
                            {status === 'processing' ? (
                                <Loader2 className="w-6 h-6 text-white animate-spin" />
                            ) : isRecording ? (
                                <MicOff className="w-6 h-6 text-white" />
                            ) : (
                                <Mic className="w-6 h-6 text-white" />
                            )}
                        </motion.button>
                    </div>
                </div>
            </div>
        </div>
    );
}