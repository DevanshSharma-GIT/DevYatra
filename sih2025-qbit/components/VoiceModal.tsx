"use client"

import { useState, useEffect, useRef } from "react"
import { io, Socket } from "socket.io-client"
import { motion, AnimatePresence } from "framer-motion"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, X, Loader2 } from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  details?: any
}

interface VoiceModalProps {
  open: boolean
  onClose: () => void
  onMessageReceived: (message: string) => void
  username: string
  socketInstance?: Socket | null
  addMessageToHistory?: (message: Message) => void
  userProfile?: any
}

const VoiceModal: React.FC<VoiceModalProps> = ({ 
  open, 
  onClose, 
  onMessageReceived, 
  username, 
  socketInstance,
  addMessageToHistory,
  userProfile
}) => {
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [response, setResponse] = useState("")
  const [responseDetails, setResponseDetails] = useState<any>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [language, setLanguage] = useState("en-IN") // Default to English
  const [recordingTime, setRecordingTime] = useState(0)
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null)
  const [stoppingRecording, setStoppingRecording] = useState(false) // New state to track stop process

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const voiceSocketRef = useRef<Socket | null>(null)

  // Connect to voice bot server when modal opens
  useEffect(() => {
    let socket: any = null;
    if (open) {
      if (socketInstance && socketInstance.connected) {
        console.log("Using shared socket connection");
        setConnected(true);
        setError(null);
        socket = socketInstance;
      } else {
        console.log("Creating dedicated voice connection");
        const voiceSocket = io(`${process.env.NEXT_PUBLIC_API_URL}`);
        voiceSocketRef.current = voiceSocket;
        socket = voiceSocket;
        
        voiceSocket.on("connect", () => {
          console.log("Connected to voice bot server");
          setConnected(true);
          setError(null);
        });

        voiceSocket.on("disconnect", () => {
          console.log("Disconnected from voice bot server");
          setConnected(false);
          if (recording) {
            stopRecording(true); // Force stop recording if server disconnects
          }
        });
      }

      // Add listeners for voice-specific events
      if (socket) {
        socket.on("error", (data:any) => {
          console.error("Voice bot error:", data);
          setError(data.message || "An error occurred");
          setProcessing(false);
          if (recording) {
            stopRecording(true);
          }
        });

        socket.on("response", (data:any) => {
          console.log("Voice bot response:", data);
          setProcessing(false);
          setTranscript(data.original_text);
          setResponse(data.text);
          
          // Handle structured response fields if present
          if (data.details) {
            setResponseDetails(data.details);
          }
          
          // Create audio from base64
          if (data.audio) {
            const audioBlob = base64ToBlob(data.audio, "audio/wav");
            const audioUrl = URL.createObjectURL(audioBlob);
            setAudioUrl(audioUrl);
            
            // Auto-play the response
            if (audioRef.current) {
              audioRef.current.src = audioUrl;
              audioRef.current.play().catch(e => console.error("Audio playback error:", e));
            }
          }
          
          // Add message to chat history if function provided
          if (addMessageToHistory) {
            const botMessage: Message = {
              id: Date.now().toString(),
              role: "assistant",
              content: data.text,
              details: data.details
            };
            addMessageToHistory(botMessage);
          }
          
          // Always notify parent component
          onMessageReceived(data.original_text);
        });

        socket.on("detected_language", (data:any) => {
          console.log("Detected language:", data);
          setLanguage(data.language);
        });
      }
      
      // Check microphone permission
      checkMicrophonePermission();
    }

    // Clean up when component unmounts
    return () => {
      if (recording) {
        stopRecording(true);
      }
      
      if (voiceSocketRef.current) {
        voiceSocketRef.current.disconnect();
        voiceSocketRef.current = null;
      }
      
      // Clean up event listeners on socketInstance if it exists
      if (socketInstance) {
        socketInstance.off("error");
        socketInstance.off("response");
        socketInstance.off("detected_language");
      }

      const cleanupSocket = socketInstance || voiceSocketRef.current;
      if (cleanupSocket) {
        cleanupSocket.off("error");
        cleanupSocket.off("response");
        cleanupSocket.off("connect");
        cleanupSocket.off("disconnect");
      }
    };
  }, [open, socketInstance, onMessageReceived, addMessageToHistory, recording]);

  // Clean up when modal closes
  useEffect(() => {
    if (!open) {
      if (recording) {
        stopRecording(true);
      }
      setTranscript("");
      setResponse("");
      setResponseDetails(null);
      setAudioUrl(null);
      setError(null);
      setRecordingTime(0);
    }
    
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, [open, recording]);

  // Check for microphone permission
  const checkMicrophonePermission = async () => {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      setPermissionGranted(permissionStatus.state === 'granted');
      
      permissionStatus.onchange = () => {
        setPermissionGranted(permissionStatus.state === 'granted');
      };
    } catch (err) {
      console.log("Permission API not supported, will check when recording starts");
      setPermissionGranted(null);
    }
  };

  // Toggle recording function
  const toggleRecording = async () => {
    console.log("Toggle recording, current state:", recording, "stopping state:", stoppingRecording);
    
    if (recording) {
      if (stoppingRecording) {
        console.log("Already stopping recording, ignoring additional click");
        return;
      }
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  // Start recording function
  const startRecording = async () => {
    console.log("Starting recording...");
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermissionGranted(true);
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Set up event handlers
      mediaRecorder.ondataavailable = (event) => {
        console.log("Media recorder data available", event.data.size);
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log("MediaRecorder stopped, chunks:", audioChunksRef.current.length);
        setStoppingRecording(false);
        
        if (audioChunksRef.current.length > 0 && !processing) {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
          console.log("Created audio blob, size:", audioBlob.size);
          sendAudioToServer(audioBlob);
        } else {
          console.log("No audio chunks to process or already processing");
          if (processing) {
            console.warn("Already processing, not sending new audio");
          }
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        setError("Recording error occurred");
        setRecording(false);
        setStoppingRecording(false);
      };

      // Start recording
      mediaRecorder.start();
      setRecording(true);
      
      // Start timer for recording duration
      setRecordingTime(0);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      console.log("Recording started successfully");
    } catch (err) {
      console.error("Error starting recording:", err);
      setError("Could not access microphone. Please check permissions.");
      setPermissionGranted(false);
    }
  };

  // Stop recording function
  const stopRecording = async (force = false) => {
    console.log("Stopping recording...", force ? "(forced)" : "");
    try {
      if (!recording && !force) {
        console.log("Not recording, nothing to stop");
        return;
      }

      // Remove duplicate checking of stoppingRecording state
      setStoppingRecording(true);

      if (mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state === "recording") {
          console.log("Stopping MediaRecorder...");
          mediaRecorderRef.current.stop();
        } else {
          console.log("MediaRecorder not in recording state:", mediaRecorderRef.current.state);
        }

        if (mediaRecorderRef.current.stream) {
          console.log("Stopping all tracks in MediaRecorder stream...");
          mediaRecorderRef.current.stream.getTracks().forEach(track => {
            track.stop();
          });
        }
        mediaRecorderRef.current = null;
      } else {
        console.log("No MediaRecorder instance to stop");
      }

      if (recordingTimerRef.current) {
        console.log("Clearing recording timer");
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      setRecording(false);
    } catch (e) {
      console.error("Error stopping recorder:", e);
      setError("Error stopping recording: " + (e instanceof Error ? e.message : String(e)));
      setRecording(false);
    } finally {
      setStoppingRecording(false);
      console.log("Recording stopped (finally).");
    }
  };

  // Send audio to server
  const sendAudioToServer = async (audioBlob: Blob) => {
    console.log("Sending audio to server, blob size:", audioBlob.size);
    
    const socket = socketInstance || voiceSocketRef.current;
    if (!socket || !socket.connected) {
      setError("Not connected to voice bot server");
      setStoppingRecording(false);
      return;
    }

    try {
      setProcessing(true);
      console.log("Converting blob to base64...");
      const base64Audio = await blobToBase64(audioBlob);
      console.log("Base64 conversion complete, length:", base64Audio.length);
      
      // Send audio to server
      console.log("Emitting audio_message event...");
      socket.emit("audio_message", {
        audio: base64Audio,
        language: language,
        auto_detect: true,
        username: username,
        user_profile: userProfile // Pass user profile for context if available
      });
      
      console.log("Audio sent to server successfully");
    } catch (err) {
      console.error("Error sending audio:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError("Failed to send audio to server: " + errorMessage);
      setProcessing(false);
      setStoppingRecording(false);
    }
  };

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper to convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          const base64String = reader.result.split(",")[1];
          resolve(base64String);
        } else {
          reject(new Error("Failed to convert blob to base64"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Helper to convert base64 to blob
  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    
    for (let i = 0; i < byteCharacters.length; i += 512) {
      const slice = byteCharacters.slice(i, i + 512);
      const byteNumbers = new Array(slice.length);
      
      for (let j = 0; j < slice.length; j++) {
        byteNumbers[j] = slice.charCodeAt(j);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    
    return new Blob(byteArrays, { type: mimeType });
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Voice Assistant</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-4 py-4">
          {/* Microphone button */}
          <div className="relative">
            <Button
              disabled={processing || !connected || permissionGranted === false || stoppingRecording}
              size="lg"
              className={`rounded-full p-8 ${
                recording 
                  ? "bg-red-500 hover:bg-red-600 text-white animate-pulse" 
                  : stoppingRecording
                    ? "bg-yellow-500 text-white"
                    : "bg-teal-600 hover:bg-teal-700 text-white"
              }`}
              onClick={toggleRecording}
              aria-label={recording ? "Stop recording" : "Start recording"}
            >
              {recording ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
            </Button>
            
            <AnimatePresence>
              {recording && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                  className="absolute -inset-4 rounded-full border-4 border-red-500"
                >
                  <motion.div
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="w-full h-full rounded-full bg-red-500/20"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Recording timer */}
          {recording && (
            <div className="text-center text-sm text-red-500 font-semibold mt-2">
              Recording: {formatTime(recordingTime)}
            </div>
          )}
          
          {/* Status text */}
          <div className="text-center text-sm text-gray-500">
            {recording ? (
              "Speak now... Click the microphone again to stop recording"
            ) : stoppingRecording ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Stopping recording...
              </div>
            ) : processing ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing your message...
              </div>
            ) : permissionGranted === false ? (
              "Microphone access denied. Please enable microphone permissions."
            ) : connected ? (
              "Click the microphone to start speaking"
            ) : (
              "Connecting to voice assistant..."
            )}
          </div>
          
          {/* Error message */}
          {error && (
            <div className="text-red-500 text-sm mt-2">{error}</div>
          )}
          
          {/* Transcription result */}
          {transcript && (
            <div className="mt-4 p-3 bg-gray-100 rounded-md w-full">
              <p className="text-sm font-medium text-gray-700">You said:</p>
              <p className="text-sm">{transcript}</p>
            </div>
          )}
          
          {/* Response */}
          {response && (
            <div className="mt-2 p-3 bg-teal-50 rounded-md w-full">
              <p className="text-sm font-medium text-teal-700">Response:</p>
              <p className="text-sm">{response}</p>
              
              {/* Structured details */}
              {responseDetails && Object.values(responseDetails).some(Boolean) && (
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  {responseDetails.destination && (
                    <p>Destination: {responseDetails.destination}</p>
                  )}
                  {responseDetails.price_range && (
                    <p>Price Range: {responseDetails.price_range}</p>
                  )}
                </div>
              )}
              
              {/* Audio player */}
              {audioUrl && (
                <div className="mt-2">
                  <audio ref={audioRef} controls src={audioUrl} className="w-full h-8" />
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex justify-end mt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="gap-2"
          >
            <X className="h-4 w-4" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VoiceModal;
