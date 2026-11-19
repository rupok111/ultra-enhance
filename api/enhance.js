export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, image, video, type, scale, predictionId } = req.body;
  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

  if (!REPLICATE_API_TOKEN) {
    return res.status(500).json({ error: 'API Token not configured in Vercel' });
  }

  try {
    if (action === 'status' && predictionId) {
      const checkRes = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` }
      });
      const checkData = await checkRes.json();
      return res.status(200).json(checkData);
    }

    const isVideo = type === 'video';
    // Using official Real-ESRGAN (nightmareai/real-esrgan) which runs on warm fast GPUs
    // Fallback / primary model endpoint without cold-boot deadlocks
    const version = '42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b';

    const input = isVideo
      ? { image: video, scale: scale === '8k' ? 4 : 2, face_enhance: true }
      : { image: image, scale: scale === '8k' ? 4 : 2, face_enhance: true };

    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ version, input })
    });

    const startData = await startRes.json();
    if (!startRes.ok) {
      return res.status(startRes.status).json({ error: startData.detail || startData.error || 'Replicate API error' });
    }
    return res.status(200).json(startData);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
