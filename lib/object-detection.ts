import { type AnalysisResult } from './safari-analyze';

export interface DetectedObject {
  label: string;
  score: number;
  /** Relative bounding box [left, top, right, bottom] in 0-1 range */
  box: [number, number, number, number];
}

let model: any = null;
let loading: Promise<void> | null = null;

async function loadModel(): Promise<void> {
  if (model) return;
  if (loading) return loading;
  loading = (async () => {
    const tf = await import('@tensorflow/tfjs');
    await tf.ready();
    const cocossd = await import('@tensorflow-models/coco-ssd');
    model = await cocossd.load();
  })();
  return loading;
}

export async function detectOnImage(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  minScore = 0.4,
): Promise<DetectedObject[]> {
  try {
    await loadModel();
    const predictions = await model.detect(source);
    return predictions
      .filter((p: any) => p.score >= minScore)
      .map((p: any) => ({
        label: p.class,
        score: p.score,
        box: [
          p.bbox[0] / source.width,
          p.bbox[1] / source.height,
          (p.bbox[0] + p.bbox[2]) / source.width,
          (p.bbox[1] + p.bbox[3]) / source.height,
        ] as [number, number, number, number],
      }));
  } catch (e) {
    console.warn('COCO-SSD detection failed', e);
    return [];
  }
}

export async function detectOnDataUrl(
  dataUrl: string,
  minScore?: number,
): Promise<{ detections: DetectedObject[]; analysis: AnalysisResult | null }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  const [{ analyzeImageData }, detections] = await Promise.all([
    import('./safari-analyze'),
    detectOnImage(img, minScore),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, 64, 64);
  const imageData = ctx.getImageData(0, 0, 64, 64);
  const analysis = analyzeImageData(imageData);

  return { detections, analysis };
}
