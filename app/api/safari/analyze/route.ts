import { NextRequest, NextResponse } from 'next/server';

interface Detection {
  label: string;
  score: number;
  box: [number, number, number, number];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image: _image, query } = body as { image: string; query: string };

    if (!query) {
      return NextResponse.json({ error: 'query required' }, { status: 400 });
    }

    const LOCATE_ANYTHING_URL = process.env.LOCATE_ANYTHING_URL;

    if (LOCATE_ANYTHING_URL) {
      const res = await fetch(`${LOCATE_ANYTHING_URL}/v1/locate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_b64: _image.replace(/^data:image\/\w+;base64,/, ''),
          task: 'ground',
          query,
          mode: 'hybrid',
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) throw new Error(`LocateAnything returned ${res.status}`);

      const data = await res.json();
      const detections: Detection[] = (data.detections || []).map(
        (d: { label: string; score: number; bbox?: [number, number, number, number] }) => ({
          label: d.label,
          score: d.score,
          box: d.bbox || [0, 0, 1, 1],
        }),
      );

      return NextResponse.json({ detections });
    }

    return NextResponse.json({
      detections: [{ label: query, score: 0.8, box: [0.1, 0.1, 0.9, 0.9] }],
      note: 'LOCATE_ANYTHING_URL not configured — returned simulated result',
    });
  } catch (err) {
    console.error('safari/analyze error:', err);
    return NextResponse.json(
      { error: 'Analysis failed', detections: [] },
      { status: 200 },
    );
  }
}
