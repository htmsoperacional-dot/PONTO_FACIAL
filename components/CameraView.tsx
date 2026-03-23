
import React, { useRef, useEffect, useState, useCallback } from 'react';

interface CameraViewProps {
  onCapture: (base64: string) => void;
  isLoading: boolean;
  buttonLabel?: string;
  sideButton?: boolean;
}

const CameraView: React.FC<CameraViewProps> = ({ onCapture, isLoading, buttonLabel = "BATER PONTO", sideButton = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const enableCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'user', width: 1280, height: 720 } 
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Erro ao acessar câmera:", err);
      }
    };
    enableCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        onCapture(base64);
      }
    }
  }, [onCapture]);

  return (
    <div className={`w-full mx-auto flex ${sideButton ? 'flex-col md:flex-row' : 'flex-col'} items-center gap-6 md:gap-8`}>
      {/* Video Container - Restaurado para max-w-2xl */}
      <div className={`relative w-full rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden shadow-2xl bg-gray-950 border-[10px] border-white group ${sideButton ? 'flex-1' : 'max-w-2xl'}`}>
        <video 
          ref={videoRef} 
          autoPlay 
          muted 
          playsInline 
          className="w-full h-auto aspect-video object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Subtle Frame overlay */}
        <div className="absolute inset-0 border-2 border-white/5 pointer-events-none rounded-[1.5rem] md:rounded-[2rem] m-6"></div>

        {/* Face Frame Helper - Emiliano Orange */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-64 md:w-64 md:h-80 border-2 border-dashed border-orange-500/20 rounded-[4rem] pointer-events-none group-hover:border-orange-500/40 transition-all duration-700"></div>

        {/* Scan line animation */}
        {!isLoading && (
          <div className="absolute left-0 right-0 h-1.5 bg-orange-500/40 blur-sm animate-[scan_3s_linear_infinite] pointer-events-none"></div>
        )}
      </div>

      {/* Button Emiliano Theme - Restaurado para tamanho maior */}
      <button
        onClick={handleCapture}
        disabled={isLoading}
        className={`
          ${sideButton ? 'w-full md:w-auto md:px-12 py-5' : 'px-16 py-6'}
          rounded-[2.5rem] font-black text-lg md:text-2xl transition-all flex items-center justify-center gap-4 md:gap-6 shadow-2xl uppercase tracking-widest
          ${isLoading 
            ? 'bg-gray-100 text-gray-300 cursor-not-allowed' 
            : 'bg-gray-950 hover:bg-orange-600 text-white transform hover:scale-105 active:scale-95'
          }
        `}
      >
        {isLoading ? (
          <>
            <div className="w-6 h-6 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            Processando...
          </>
        ) : (
          <>
            <div className="w-8 h-8 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg">
              <div className="w-4 h-4 bg-white rounded-full animate-pulse"></div>
            </div>
            {buttonLabel}
          </>
        )}
      </button>
      <style>{`
        @keyframes scan {
          0% { top: 10%; opacity: 0; }
          50% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default CameraView;
