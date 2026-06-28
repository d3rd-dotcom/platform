export interface AnalysisResult {
  avgR: number;
  avgG: number;
  avgB: number;
  brightness: number;
  edgeDensity: number;
  dominantColor: string;
  dominantConfidence: number;
  matchScore: number;
}

function classifyColor(
  r: number,
  g: number,
  b: number,
): { dominantColor: string; dominantConfidence: number } {
  const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
  if (brightness < 0.08) return { dominantColor: 'black', dominantConfidence: 0.95 };
  if (brightness > 0.92) return { dominantColor: 'white', dominantConfidence: 0.9 };

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  if (sat < 0.12) return { dominantColor: 'gray', dominantConfidence: 0.75 };

  const norm = r + g + b;
  const rr = r / norm;
  const gg = g / norm;
  const bb = b / norm;

  if (rr > gg && rr > bb) return { dominantColor: 'red', dominantConfidence: rr };
  if (gg > rr && gg > bb) return { dominantColor: 'green', dominantConfidence: gg };
  if (bb > rr && bb > gg) return { dominantColor: 'blue', dominantConfidence: bb };
  if (rr > 0.35 && gg > 0.35) return { dominantColor: 'yellow', dominantConfidence: rr + gg };
  if (rr > 0.35 && bb > 0.35) return { dominantColor: 'purple', dominantConfidence: rr + bb };
  if (gg > 0.35 && bb > 0.35) return { dominantColor: 'teal', dominantConfidence: gg + bb };
  return { dominantColor: 'unknown', dominantConfidence: 0 };
}

function computePixelData(
  imageData: ImageData,
): { avgR: number; avgG: number; avgB: number; brightness: number; edgeDensity: number } {
  const { data, width, height } = imageData;
  const n = width * height;

  let totalR = 0, totalG = 0, totalB = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalR += data[i];
    totalG += data[i + 1];
    totalB += data[i + 2];
  }
  const avgR = totalR / n;
  const avgG = totalG / n;
  const avgB = totalB / n;
  const brightness = (avgR * 0.299 + avgG * 0.587 + avgB * 0.114) / 255;

  const gray = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    gray[i] = data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114;
  }

  let edgeSum = 0;
  let edgeCount = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const gx =
        -gray[(y - 1) * width + (x - 1)] + gray[(y - 1) * width + (x + 1)] +
        -2 * gray[y * width + (x - 1)] + 2 * gray[y * width + (x + 1)] +
        -gray[(y + 1) * width + (x - 1)] + gray[(y + 1) * width + (x + 1)];
      const gy =
        -gray[(y - 1) * width + (x - 1)] + -2 * gray[(y - 1) * width + x] + -gray[(y - 1) * width + (x + 1)] +
        gray[(y + 1) * width + (x - 1)] + 2 * gray[(y + 1) * width + x] + gray[(y + 1) * width + (x + 1)];
      edgeSum += Math.sqrt(gx * gx + gy * gy);
      edgeCount++;
    }
  }
  const edgeDensity = Math.min(edgeSum / edgeCount / 255, 1);

  return { avgR, avgG, avgB, brightness, edgeDensity };
}

export function analyzeImageData(imageData: ImageData): AnalysisResult {
  const { avgR, avgG, avgB, brightness, edgeDensity } = computePixelData(imageData);
  const { dominantColor, dominantConfidence } = classifyColor(avgR, avgG, avgB);
  return { avgR, avgG, avgB, brightness, edgeDensity, dominantColor, dominantConfidence, matchScore: 0 };
}

export function analyzeImageDataUrl(dataUrl: string): Promise<AnalysisResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 64;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, size, size);
      const imageData = ctx.getImageData(0, 0, size, size);
      resolve(analyzeImageData(imageData));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export function sampleVideoFrame(
  video: HTMLVideoElement,
): AnalysisResult | null {
  if (!video.videoWidth) return null;
  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0, size, size);
  const imageData = ctx.getImageData(0, 0, size, size);
  return analyzeImageData(imageData);
}

export function matchPrompt(prompt: string, result: AnalysisResult): number {
  const lower = prompt.toLowerCase();

  if (lower.includes('blue'))
    return result.dominantColor === 'blue'
      ? result.dominantConfidence
      : Math.max(0, (result.avgB - Math.max(result.avgR, result.avgG)) / 255);

  if (lower.includes('green'))
    return result.dominantColor === 'green' ? result.dominantConfidence : 0;

  if (lower.includes('yellow') || lower.includes('gold'))
    return result.dominantColor === 'yellow' ? result.dominantConfidence : 0.2;

  if (lower.includes('red'))
    return result.dominantColor === 'red' ? result.dominantConfidence : 0;

  if (lower.includes('favorite color'))
    return 0.5 + result.dominantConfidence * 0.3;

  if (lower.includes('rough') || lower.includes('texture') || lower.includes('pattern'))
    return result.edgeDensity > 0.25 ? Math.min(result.edgeDensity * 1.6, 1) : result.edgeDensity;

  if (lower.includes('soft') || lower.includes('smooth') || lower.includes('calm'))
    return Math.max(0, 1 - result.edgeDensity * 1.3);

  if (lower.includes('shiny'))
    return result.edgeDensity * 0.4 + result.brightness * 0.6;

  if (lower.includes('wood') || lower.includes('nature'))
    return (result.dominantColor === 'green' ? 0.5 : 0) + (result.edgeDensity > 0.2 && result.edgeDensity < 0.6 ? 0.3 : 0);

  if (lower.includes('round'))
    return 0.5;

  if (lower.includes('old') || lower.includes('wrote today') || lower.includes('letter'))
    return 0.5;

  if (lower.includes('every day') || lower.includes('use every day') || lower.includes('goal'))
    return 0.5;

  if (lower.includes('joy'))
    return 0.5 + result.brightness * 0.3;

  return 0.5;
}

export interface LocateResult {
  label: string;
  score: number;
  box: [number, number, number, number];
}

export async function locateOnImage(
  imageData: string,
  query: string,
): Promise<{ detections: LocateResult[]; fallback: boolean }> {
  try {
    const res = await fetch('/api/safari/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData, query }),
    });
    if (!res.ok) throw new Error('API unavailable');
    const data = await res.json();
    return { detections: data.detections || [], fallback: false };
  } catch {
    const { detectOnDataUrl } = await import('./object-detection');
    const { detections } = await detectOnDataUrl(imageData, 0.4);
    if (detections.length > 0) {
      return { detections, fallback: true };
    }
    const result = await analyzeImageDataUrl(imageData);
    const score = matchPrompt(query, result);
    return {
      detections: [{ label: result.dominantColor, score, box: [0, 0, 1, 1] }],
      fallback: true,
    };
  }
}
