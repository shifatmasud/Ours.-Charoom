
import React, { useEffect, useState, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { motion, AnimatePresence } from 'framer-motion';
import { theme, commonStyles } from '../../Theme';
import { Microphone, MicrophoneSlash, X, PhoneCall } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

// --- Helper Functions for Audio ---
function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Simple float to int16 conversion
    int16[i] = Math.max(-1, Math.min(1, data[i])) * 32767;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const LiveCall: React.FC = () => {
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); // Visual indicator for AI speaking
  const [error, setError] = useState<string | null>(null);

  // Refs for Audio Contexts and Session
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  // Track the active session to ensure we only close the one we created
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    let active = true;
    let currentSession: any = null;

    const startSession = async () => {
      try {
        if (!process.env.API_KEY) throw new Error("API Key missing");
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // 1. Setup Audio Contexts
        // Close existing if any (cleanup safety)
        if (inputContextRef.current) inputContextRef.current.close();
        if (outputContextRef.current) outputContextRef.current.close();

        const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        inputContextRef.current = inputCtx;
        outputContextRef.current = outputCtx;

        // 2. Connect to Gemini Live
        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          callbacks: {
            onopen: async () => {
              if (!active) return;
              setIsConnected(true);
              
              // Start Microphone Stream
              try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const source = inputCtx.createMediaStreamSource(stream);
                const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                
                scriptProcessor.onaudioprocess = (e) => {
                  if (!active || isMuted || !currentSession) return;
                  const inputData = e.inputBuffer.getChannelData(0);
                  const pcmBlob = createBlob(inputData);
                  currentSession.sendRealtimeInput({ media: pcmBlob });
                };
                
                source.connect(scriptProcessor);
                scriptProcessor.connect(inputCtx.destination);
              } catch (err) {
                console.error(err);
                if (active) setError("Microphone access denied.");
              }
            },
            onmessage: async (message: LiveServerMessage) => {
              if (!active) return;
              
              // Handle Audio Output
              const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (base64Audio) {
                setIsSpeaking(true);
                // Reset speaking visual after a bit if no more chunks come
                setTimeout(() => { if(active) setIsSpeaking(false); }, 400); 

                const audioCtx = outputContextRef.current;
                if (!audioCtx || audioCtx.state === 'closed') return;

                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioCtx.currentTime);
                
                const audioBuffer = await decodeAudioData(
                  decode(base64Audio),
                  audioCtx,
                  24000,
                  1
                );
                
                const source = audioCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioCtx.destination);
                source.onended = () => {
                   sourcesRef.current.delete(source);
                };
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
              }

              // Handle Interruptions
              if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(src => {
                    try { src.stop(); } catch(e) {}
                });
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setIsSpeaking(false);
              }
            },
            onclose: () => {
              if(active) {
                  console.log("Session closed");
                  setIsConnected(false);
              }
            },
            onerror: (err) => {
              console.error("Session error", err);
              if(active) setError("Connection error.");
            }
          },
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            },
            systemInstruction: "You are a helpful, chill AI assistant in a social media app called 'Ours'. Keep responses concise and conversational."
          }
        });

        // Store session when resolved
        sessionPromise.then(sess => {
          if (!active) {
            // If we were cancelled before connection finished, close immediately
            sess.close();
            return;
          }
          currentSession = sess;
          sessionRef.current = sess;
        });

      } catch (e) {
        console.error(e);
        if(active) setError("Failed to initialize.");
      }
    };

    startSession();

    return () => {
      active = false;
      // Cleanup contexts
      if (inputContextRef.current && inputContextRef.current.state !== 'closed') inputContextRef.current.close();
      if (outputContextRef.current && outputContextRef.current.state !== 'closed') outputContextRef.current.close();
      
      // Robust Session Cleanup
      if (sessionRef.current) {
        try { sessionRef.current.close(); } catch(e) { console.log("Session close err", e); }
        sessionRef.current = null;
      }
      
      sourcesRef.current.forEach(src => {
         try { src.stop(); } catch(e) {}
      });
      sourcesRef.current.clear();
    };
  }, [isMuted]); 

  const handleEndCall = () => {
    navigate(-1); // Cleanup happens in useEffect unmount
  };

  return (
    <div style={{ 
      ...commonStyles.pageContainer, 
      background: '#000', 
      position: 'fixed', inset: 0, zIndex: 2000 
    }}>
      
      {/* Visualizer Orb */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '40px' }}>
        
        <div style={{ position: 'relative', width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Outer Glow */}
            <motion.div 
               animate={{ 
                 scale: isSpeaking ? [1, 1.5, 1] : [1, 1.1, 1],
                 opacity: isSpeaking ? 0.8 : 0.3
               }}
               transition={{ duration: isSpeaking ? 0.5 : 2, repeat: Infinity, ease: "easeInOut" }}
               style={{ 
                 position: 'absolute', inset: 0, borderRadius: '50%', 
                 background: `radial-gradient(circle, ${theme.colors.accent} 0%, transparent 70%)` 
               }}
            />
            {/* Core */}
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#fff', boxShadow: `0 0 40px ${theme.colors.accent}` }} />
        </div>

        <div style={{ textAlign: 'center' }}>
            <h2 style={{ color: '#fff', marginBottom: '8px', letterSpacing: '1px' }}>Voice Call</h2>
            <p style={{ color: theme.colors.text2 }}>{isConnected ? (isSpeaking ? "Speaking..." : "Listening...") : "Connecting..."}</p>
            {error && <p style={{ color: theme.colors.danger, marginTop: '8px' }}>{error}</p>}
        </div>
      
      </div>

      {/* Controls */}
      <div style={{ padding: '48px', display: 'flex', gap: '32px', alignItems: 'center', justifyContent: 'center' }}>
         <motion.button
           whileTap={{ scale: 0.9 }}
           onClick={() => setIsMuted(!isMuted)}
           style={{ 
             width: '60px', height: '60px', borderRadius: '50%', 
             background: isMuted ? '#fff' : 'rgba(255,255,255,0.1)', 
             color: isMuted ? '#000' : '#fff',
             border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
             cursor: 'pointer'
           }}
         >
            {isMuted ? <MicrophoneSlash size={24} weight="fill" /> : <Microphone size={24} weight="fill" />}
         </motion.button>

         <motion.button
           whileTap={{ scale: 0.9 }}
           onClick={handleEndCall}
           style={{ 
             width: '72px', height: '72px', borderRadius: '50%', 
             background: theme.colors.danger, 
             color: '#fff',
             border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
             cursor: 'pointer'
           }}
         >
            <X size={32} weight="bold" />
         </motion.button>
      </div>

    </div>
  );
};
