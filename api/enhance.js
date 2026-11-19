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

    const version = '42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b';
    const input = {
      image: type === 'video' ? video : image,
      scale: scale === '8k' ? 4 : 2,
      face_enhance: true
    };

    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=15'
      },
      body: JSON.stringify({ version, input })
    });

    const startData = await startRes.json();
    
    // Pass HTTP status code (e.g., 429 for rate limit) so frontend can auto-retry smoothly
    return res.status(startRes.status).json(startData);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
