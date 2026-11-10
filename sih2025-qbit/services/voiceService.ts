import { Socket } from "socket.io-client";

// Define interfaces for voice service
interface TranscriptionResult {
  text: string;
  language: string;
  confidence: number;
}

interface SynthesisResult {
  audio: string; // base64 encoded audio
  text: string;
}

/**
 * Service to handle voice transcription and synthesis
 */
class VoiceService {
  private socket: Socket | null = null;
  
  constructor(socket: Socket | null) {
    this.socket = socket;
  }
  
  /**
   * Transcribe audio to text
   * @param audioBase64 Base64 encoded audio
   * @param language Language code (e.g., 'en-IN')
   * @returns Promise that resolves with transcription result
   */
  async transcribeAudio(audioBase64: string, language: string = 'en-IN'): Promise<TranscriptionResult> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error("Socket not connected"));
        return;
      }
      
      // Set up listener for response
      this.socket.once("transcription_result", (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve({
            text: result.text,
            language: result.language || language,
            confidence: result.confidence || 0.8
          });
        }
      });
      
      // Send transcription request
      this.socket.emit("transcribe_audio", {
        audio: audioBase64,
        language: language,
        auto_detect: true
      });
      
      // Set timeout
      setTimeout(() => {
        reject(new Error("Transcription timed out"));
      }, 15000);
    });
  }
  
  /**
   * Synthesize text to speech
   * @param text Text to synthesize
   * @param language Language code (e.g., 'en-IN')
   * @returns Promise that resolves with synthesis result
   */
  async synthesizeSpeech(text: string, language: string = 'en-IN'): Promise<SynthesisResult> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error("Socket not connected"));
        return;
      }
      
      // Set up listener for response
      this.socket.once("synthesis_result", (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve({
            audio: result.audio,
            text: result.text || text
          });
        }
      });
      
      // Send synthesis request
      this.socket.emit("synthesize_speech", {
        text: text,
        language: language
      });
      
      // Set timeout
      setTimeout(() => {
        reject(new Error("Speech synthesis timed out"));
      }, 15000);
    });
  }
  
  /**
   * Format chatbot response for speech
   * @param responseText Main response text
   * @param details Structured details from the response
   * @returns Formatted text ready for speech synthesis
   */
  formatResponseForSpeech(responseText: string, details: any): string {
    if (!details) return responseText;
    
    let speechText = responseText + " ";
    
    // Add key details in a way that sounds natural when spoken
    if (details.destination) {
      speechText += `Your destination is ${details.destination}. `;
    }
    
    if (details.price_range) {
      speechText += `Prices range from ${details.price_range.replace('-', 'to')}. `;
    }
    
    if (details.travel_tips) {
      // Only include the first sentence of travel tips to keep it concise for speech
      const firstTip = details.travel_tips.split('.')[0];
      if (firstTip) {
        speechText += `Here's a tip: ${firstTip}. `;
      }
    }
    
    return speechText;
  }
  
  /**
   * Detect language from audio
   * @param audioBase64 Base64 encoded audio
   * @returns Promise that resolves with detected language code
   */
  async detectLanguage(audioBase64: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        reject(new Error("Socket not connected"));
        return;
      }
      
      // Set up listener for response
      this.socket.once("detected_language", (result) => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result.language || "en-IN");
        }
      });
      
      // Send language detection request
      this.socket.emit("detect_language", {
        audio: audioBase64
      });
      
      // Set timeout
      setTimeout(() => {
        resolve("en-IN"); // Default to English on timeout
      }, 10000);
    });
  }
}

export default VoiceService;
