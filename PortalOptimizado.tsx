import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, AlertCircle, Hand, Settings2 } from 'lucide-react';

type FilterType =
  | 'thermal'
  | 'edges'
  | 'sepia'
  | 'inverted'
  | 'original'
  | 'neon'
  | 'pixelated'
  | 'glitch'
  | 'popArt'
  | 'halftone';

interface FilterConfig {
  name: string;
}

const FILTER_ORDER: FilterType[] = [
  'thermal', 'popArt', 'halftone', 'edges', 'sepia', 'inverted', 'neon', 'pixelated', 'glitch', 'original',
];

const FILTERS: Record<FilterType, FilterConfig> = {
  thermal: { name: 'Térmico' },
  popArt: { name: 'Pop Art' },
  halftone: { name: 'Trama' },
  edges: { name: 'Bordes' },
  sepia: { name: 'Sepia' },
  inverted: { name: 'Invertido' },
  neon: { name: 'Neón' },
  pixelated: { name: 'Pixelado' },
  glitch: { name: 'Glitch' },
  original: { name: 'Original' },
};

// --- Sensibilidad: mapea un slider 0-100 a los parámetros reales de MediaPipe y del gesto ---
function sensitivityToParams(sensitivity: number) {
  const t = sensitivity / 100;
  return {
    // Más sensible = umbral de confianza más bajo = detecta manos/dedos más fácil
    minDetectionConfidence: 0.8 - t * 0.35, // 0.8 (estricto) -> 0.45 (sensible)
    minTrackingConfidence: 0.75 - t * 0.35,
    // Más sensible = acepta una pinza (pulgar+índice) aunque estén algo más separados
    pinchDistanceNorm: 0.045 + t * 0.05, // 0.045 (estricto) -> 0.095 (sensible)
  };
}

export default function PortalOptimizado() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('thermal');
  const [handsDetected, setHandsDetected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sensitivity, setSensitivity] = useState(60); // 0-100
  const [smoothing, setSmoothing] = useState(3); // frames de historial

  const animationFrameRef = useRef<number | undefined>(undefined);
  const handsRef = useRef<any>(null);
  const pointHistoryRef = useRef<[number, number][][]>([]);
  const selectedFilterRef = useRef<FilterType>('thermal');
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sensitivityRef = useRef(sensitivity);
  const smoothingRef = useRef(smoothing);

  // Estado del gesto "cerrar / abrir" para ciclar filtros
  const gestureStateRef = useRef<'open' | 'closed'>('closed');

  useEffect(() => {
    selectedFilterRef.current = selectedFilter;
  }, [selectedFilter]);

  useEffect(() => {
    sensitivityRef.current = sensitivity;
    if (handsRef.current) {
      const { minDetectionConfidence, minTrackingConfidence } = sensitivityToParams(sensitivity);
      handsRef.current.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence,
        minTrackingConfidence,
      });
    }
  }, [sensitivity]);

  useEffect(() => {
    smoothingRef.current = smoothing;
  }, [smoothing]);

  const cycleFilter = useCallback(() => {
    setSelectedFilter((prev) => {
      const idx = FILTER_ORDER.indexOf(prev);
      return FILTER_ORDER[(idx + 1) % FILTER_ORDER.length];
    });
  }, []);

  useEffect(() => {
    const initializePortal = async () => {
      try {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.4/camera_utils.js';
        script.async = true;
        document.body.appendChild(script);

        const script2 = document.createElement('script');
        script2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.4/drawing_utils.js';
        script2.async = true;
        document.body.appendChild(script2);

        const script3 = document.createElement('script');
        script3.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/hands.js';
        script3.async = true;
        script3.onload = () => {
          initializeCamera();
        };
        document.body.appendChild(script3);
      } catch (err) {
        setError('Error cargando MediaPipe');
      }
    };

    const initializeCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch((err) => {
              console.error('Error playing video:', err);
            });
          };
        }

        const waitForMediaPipe = setInterval(() => {
          const Hands = (window as any).Hands;
          if (Hands) {
            clearInterval(waitForMediaPipe);
            setupHands(Hands);
          }
        }, 100);

        setTimeout(() => clearInterval(waitForMediaPipe), 5000);
      } catch (err) {
        setError('No se pudo acceder a la cámara. Verifica los permisos.');
        setIsLoading(false);
      }
    };

    const setupHands = (Hands: any) => {
      try {
        const { minDetectionConfidence, minTrackingConfidence } = sensitivityToParams(sensitivityRef.current);

        const hands = new Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`,
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence,
          minTrackingConfidence,
        });

        hands.onResults((results: any) => {
          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            setHandsDetected(true);
            drawPortal(results);
          } else {
            setHandsDetected(false);
            drawFrame();
          }
        });

        handsRef.current = hands;
        setIsLoading(false);

        const processFrame = async () => {
          if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            try {
              await hands.send({ image: videoRef.current });
            } catch (err) {
              console.error('Error processing frame:', err);
            }
          }
          animationFrameRef.current = requestAnimationFrame(processFrame);
        };

        processFrame();
      } catch (err) {
        console.error('Error setting up hands:', err);
        setError('Error inicializando MediaPipe');
        setIsLoading(false);
      }
    };

    initializePortal();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============ FILTROS (operan sobre el recorte, no el frame completo) ============
  const applyFilter = (ctx: CanvasRenderingContext2D, imageData: ImageData, filter: FilterType) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    switch (filter) {
      case 'thermal': {
        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          const norm = gray / 255;
          if (norm < 0.2) { data[i]=0; data[i+1]=0; data[i+2]=255; }
          else if (norm < 0.4) { data[i]=0; data[i+1]=128; data[i+2]=255; }
          else if (norm < 0.6) { data[i]=0; data[i+1]=255; data[i+2]=255; }
          else if (norm < 0.8) { data[i]=255; data[i+1]=255; data[i+2]=0; }
          else { data[i]=255; data[i+1]=0; data[i+2]=0; }
        }
        break;
      }
      case 'popArt': {
        // Duotono naranja/magenta, como el filtro visto en el video original
        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          if (gray > 120) { data[i]=255; data[i+1]=176; data[i+2]=0; }
          else { data[i]=230; data[i+1]=0; data[i+2]=130; }
        }
        break;
      }
      case 'halftone': {
        // Trama de puntos en blanco y negro, tamaño del punto según brillo
        const cell = 6;
        for (let y = 0; y < height; y += cell) {
          for (let x = 0; x < width; x += cell) {
            let sum = 0, count = 0;
            for (let yy = y; yy < Math.min(y + cell, height); yy++) {
              for (let xx = x; xx < Math.min(x + cell, width); xx++) {
                const idx = (yy * width + xx) * 4;
                sum += data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
                count++;
              }
            }
            const avg = sum / count;
            const radius = (1 - avg / 255) * (cell / 2);
            const cx = x + cell / 2, cy = y + cell / 2;
            for (let yy = y; yy < Math.min(y + cell, height); yy++) {
              for (let xx = x; xx < Math.min(x + cell, width); xx++) {
                const idx = (yy * width + xx) * 4;
                const dist = Math.hypot(xx - cx, yy - cy);
                const v = dist <= radius ? 0 : 255;
                data[idx] = v; data[idx + 1] = v; data[idx + 2] = v;
              }
            }
          }
        }
        break;
      }
      case 'edges': {
        const gray = new Float32Array(width * height);
        for (let p = 0, i = 0; i < data.length; i += 4, p++) {
          gray[p] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        }
        const output = new Uint8ClampedArray(data);
        for (let y = 1; y < height - 1; y++) {
          const rowUp = (y - 1) * width, row = y * width, rowDown = (y + 1) * width;
          for (let x = 1; x < width - 1; x++) {
            const g00=gray[rowUp+x-1], g01=gray[rowUp+x], g02=gray[rowUp+x+1];
            const g10=gray[row+x-1], g12=gray[row+x+1];
            const g20=gray[rowDown+x-1], g21=gray[rowDown+x], g22=gray[rowDown+x+1];
            const gx = -g00+g02-2*g10+2*g12-g20+g22;
            const gy = -g00-2*g01-g02+g20+2*g21+g22;
            const mag = Math.abs(gx) + Math.abs(gy);
            const idx = (row + x) * 4;
            if (mag > 60) { output[idx]=0; output[idx+1]=255; output[idx+2]=100; }
            else { output[idx]=0; output[idx+1]=0; output[idx+2]=0; }
            output[idx+3] = 255;
          }
        }
        data.set(output);
        break;
      }
      case 'sepia': {
        for (let i = 0; i < data.length; i += 4) {
          const r=data[i], g=data[i+1], b=data[i+2];
          data[i]=Math.min(255, r*0.393+g*0.769+b*0.189);
          data[i+1]=Math.min(255, r*0.349+g*0.686+b*0.168);
          data[i+2]=Math.min(255, r*0.272+g*0.534+b*0.131);
        }
        break;
      }
      case 'inverted': {
        for (let i = 0; i < data.length; i += 4) {
          data[i]=255-data[i]; data[i+1]=255-data[i+1]; data[i+2]=255-data[i+2];
        }
        break;
      }
      case 'neon': {
        for (let i = 0; i < data.length; i += 4) {
          const g2 = data[i]*0.299+data[i+1]*0.587+data[i+2]*0.114;
          if (g2 > 80) { data[i]=0; data[i+1]=255; data[i+2]=200; }
          else { data[i]=0; data[i+1]=0; data[i+2]=0; }
        }
        break;
      }
      case 'pixelated': {
        const pixelSize = 8;
        for (let y = 0; y < height; y += pixelSize) {
          for (let x = 0; x < width; x += pixelSize) {
            let r=0,g=0,b=0,count=0;
            for (let dy=0; dy<pixelSize && y+dy<height; dy++) {
              for (let dx=0; dx<pixelSize && x+dx<width; dx++) {
                const idx=((y+dy)*width+(x+dx))*4;
                r+=data[idx]; g+=data[idx+1]; b+=data[idx+2]; count++;
              }
            }
            r=Math.floor(r/count); g=Math.floor(g/count); b=Math.floor(b/count);
            for (let dy=0; dy<pixelSize && y+dy<height; dy++) {
              for (let dx=0; dx<pixelSize && x+dx<width; dx++) {
                const idx=((y+dy)*width+(x+dx))*4;
                data[idx]=r; data[idx+1]=g; data[idx+2]=b;
              }
            }
          }
        }
        break;
      }
      case 'glitch': {
        for (let i = 0; i < data.length; i += 4) {
          if (Math.random() < 0.05) {
            const offset = Math.floor((Math.random()-0.5)*30)*4;
            const idx = i+offset;
            if (idx>=0 && idx<data.length) {
              data[i]=data[idx]; data[i+1]=data[idx+1]; data[i+2]=data[idx+2];
            }
          }
        }
        break;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  };

  const orderQuadPoints = (input: [number, number][]): [number, number][] => {
    const centerX = input.reduce((s, p) => s + p[0], 0) / input.length;
    const centerY = input.reduce((s, p) => s + p[1], 0) / input.length;
    const ordered = [...input].sort(
      (a, b) => Math.atan2(a[1]-centerY, a[0]-centerX) - Math.atan2(b[1]-centerY, b[0]-centerX),
    );
    const topLeftIndex = ordered.reduce(
      (best, point, index, pts) => (point[0]+point[1] < pts[best][0]+pts[best][1] ? index : best), 0,
    );
    return [...ordered.slice(topLeftIndex), ...ordered.slice(0, topLeftIndex)];
  };

  const drawPortal = (results: any) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const { pinchDistanceNorm } = sensitivityToParams(sensitivityRef.current);
    const diag = Math.hypot(canvas.width, canvas.height);

    // Solo contamos como "pinza" el pulgar+índice de cada mano si están
    // razonablemente juntos (según la sensibilidad configurada).
    const points: [number, number][] = [];
    if (results.multiHandLandmarks) {
      for (const hand of results.multiHandLandmarks) {
        const thumb = hand[4];
        const index = hand[8];
        const tx = thumb.x * canvas.width, ty = thumb.y * canvas.height;
        const ix = index.x * canvas.width, iy = index.y * canvas.height;
        const dist = Math.hypot(tx - ix, ty - iy) / diag;
        if (dist < pinchDistanceNorm) {
          points.push([tx, ty]);
          points.push([ix, iy]);
        }
      }
    }

    if (points.length >= 4) {
      const orderedPoints = orderQuadPoints(points.slice(0, 4));
      pointHistoryRef.current.push(orderedPoints);
      const maxHistory = Math.max(1, smoothingRef.current);
      if (pointHistoryRef.current.length > maxHistory) {
        pointHistoryRef.current.shift();
      }

      let smoothedPoints = orderedPoints;
      if (pointHistoryRef.current.length > 1) {
        smoothedPoints = smoothedPoints.map((p, i) => {
          let x = 0, y = 0;
          for (const frame of pointHistoryRef.current) { x += frame[i][0]; y += frame[i][1]; }
          return [x / pointHistoryRef.current.length, y / pointHistoryRef.current.length] as [number, number];
        });
      }

      const xs = smoothedPoints.map((p) => p[0]);
      const ys = smoothedPoints.map((p) => p[1]);
      const rawW = Math.max(...xs) - Math.min(...xs);
      const rawH = Math.max(...ys) - Math.min(...ys);
      const area = rawW * rawH;
      const canvasArea = canvas.width * canvas.height;

      // --- Gesto de cerrar/abrir: al juntar las manos (área chica) y volver a
      // separarlas (área grande), se avanza al siguiente filtro. ---
      const closeThreshold = canvasArea * 0.012;
      const openThreshold = canvasArea * 0.035;
      if (area < closeThreshold) {
        gestureStateRef.current = 'closed';
      } else if (area > openThreshold) {
        if (gestureStateRef.current === 'closed') {
          cycleFilter();
        }
        gestureStateRef.current = 'open';
      }

      const pad = 4;
      const bx = Math.max(0, Math.floor(Math.min(...xs)) - pad);
      const by = Math.max(0, Math.floor(Math.min(...ys)) - pad);
      const bw = Math.min(canvas.width - bx, Math.ceil(rawW) + pad * 2);
      const bh = Math.min(canvas.height - by, Math.ceil(rawH) + pad * 2);

      if (bw > 4 && bh > 4) {
        if (!cropCanvasRef.current) cropCanvasRef.current = document.createElement('canvas');
        const crop = cropCanvasRef.current;
        crop.width = bw; crop.height = bh;
        const cropCtx = crop.getContext('2d', { willReadFrequently: true });
        if (cropCtx) {
          cropCtx.drawImage(video, bx, by, bw, bh, 0, 0, bw, bh);
          const activeFilter = selectedFilterRef.current;
          if (activeFilter !== 'original') {
            const imageData = cropCtx.getImageData(0, 0, bw, bh);
            applyFilter(cropCtx, imageData, activeFilter);
          }
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(smoothedPoints[0][0], smoothedPoints[0][1]);
          for (let i = 1; i < smoothedPoints.length; i++) ctx.lineTo(smoothedPoints[i][0], smoothedPoints[i][1]);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(crop, bx, by);
          ctx.restore();
        }
      }
      // Sin contorno ni puntos de control: portal limpio, sin overlay azul.
    } else {
      // Sin ambas pinzas detectadas: no tocamos el estado del gesto,
      // para que perder el tracking un instante no cuente como "cerrar".
    }
  };

  const drawFrame = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8">
      <video ref={videoRef} className="hidden" playsInline />

      <div className="relative bg-gray-900 rounded-lg overflow-hidden shadow-2xl glow-accent">
        <canvas ref={canvasRef} width={1280} height={720} className="w-full h-auto block" />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
              <p className="text-white font-mono text-sm">Inicializando cámara...</p>
            </div>
          </div>
        )}

        {!isLoading && (
          <>
            <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 bg-black/50 backdrop-blur-sm rounded-lg">
              <Hand className={`w-4 h-4 ${handsDetected ? 'text-accent animate-pulse' : 'text-gray-500'}`} />
              <span className="text-xs font-mono text-white">
                {handsDetected ? 'Manos detectadas' : 'Esperando manos...'}
              </span>
            </div>

            <button
              onClick={() => setShowSettings((s) => !s)}
              className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 bg-black/50 backdrop-blur-sm rounded-lg text-white hover:bg-black/70 transition-colors"
            >
              <Settings2 className="w-4 h-4" />
              <span className="text-xs font-mono">Ajustes</span>
            </button>

            <div className="absolute bottom-4 left-4 px-3 py-2 bg-black/50 backdrop-blur-sm rounded-lg">
              <span className="text-xs font-mono text-white">
                Filtro: <strong>{FILTERS[selectedFilter].name}</strong>
              </span>
            </div>
          </>
        )}

        {showSettings && (
          <div className="absolute top-16 left-4 w-64 p-4 bg-black/80 backdrop-blur-md rounded-lg space-y-4">
            <div>
              <div className="flex justify-between text-xs font-mono text-white mb-1">
                <span>Sensibilidad</span>
                <span>{sensitivity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={sensitivity}
                onChange={(e) => setSensitivity(Number(e.target.value))}
                className="w-full accent-accent"
              />
              <p className="text-[10px] text-gray-400 font-mono mt-1">
                Más alto = detecta manos y la pinza más fácil (más falsos positivos).
              </p>
            </div>
            <div>
              <div className="flex justify-between text-xs font-mono text-white mb-1">
                <span>Suavizado</span>
                <span>{smoothing} frames</span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                value={smoothing}
                onChange={(e) => setSmoothing(Number(e.target.value))}
                className="w-full accent-accent"
              />
              <p className="text-[10px] text-gray-400 font-mono mt-1">
                Más alto = portal más estable, pero con más retraso al mover las manos.
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-xl font-mono font-bold text-primary mb-4">Filtros Disponibles</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {FILTER_ORDER.map((key) => (
            <button
              key={key}
              onClick={() => setSelectedFilter(key)}
              className={`p-2 rounded-lg font-mono text-xs font-semibold transition-all duration-200 ${
                selectedFilter === key
                  ? 'bg-accent text-white glow-accent shadow-lg'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
              }`}
            >
              <div className="font-bold">{FILTERS[key].name}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-mono font-bold text-primary mb-2">Cómo usar</h3>
        <ul className="text-sm text-gray-700 space-y-1 font-mono">
          <li>✓ Permite el acceso a la cámara cuando se solicite</li>
          <li>✓ Levanta ambas manos frente a la cámara, junta pulgar e índice en cada una</li>
          <li>✓ Separa las manos para abrir el portal</li>
          <li>✓ Junta las manos y vuelve a separarlas para pasar al siguiente filtro</li>
          <li>✓ Ajusta la sensibilidad si cuesta que te detecte</li>
        </ul>
      </div>
    </div>
  );
}
