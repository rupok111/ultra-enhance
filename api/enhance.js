export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image, scale } = req.body;
  if (!image) return res.status(400).json({ error: 'No image provided' });

  // List of verified public Gradio / Hugging Face restoration & upscaling spaces with auto-fallback
  const endpoints = [
    {
      url: 'https://sczhou-codeformer.hf.space/api/predict',
      payload: (img) => ({
        fn_index: 0,
        data: [img, true, true, scale === '8k' ? 4 : 2, 0.7]
      })
    },
    {
      url: 'https://tencentarc-gfpgan.hf.space/api/predict',
      payload: (img) => ({
        fn_index: 0,
        data: [img, 'v1.4', scale === '8k' ? 4 : 2]
      })
    },
    {
      url: 'https://bookbot-real-esrgan.hf.space/api/predict',
      payload: (img) => ({
        fn_index: 0,
        data: [img, 'RealESRGAN_x4plus']
      })
    }
  ];

  for (const ep of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 22000);

      const response = await fetch(ep.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ep.payload(image)),
        signal: controller.signal
      });
      clearTimeout(timeout);

      const rawText = await response.text();
      if (!response.ok || rawText.trim().startsWith('Traceback') || rawText.trim().startsWith('<')) {
        continue; // Try next GPU server automatically
      }

      const json = JSON.parse(rawText);
      if (json && json.data && json.data[0]) {
        let out = json.data[0];
        if (typeof out === 'object' && out.url) out = out.url;
        if (typeof out === 'string' && (out.startsWith('data:image') || out.startsWith('http'))) {
          return res.status(200).json({ output: out, server: ep.url });
        }
      }
    } catch (e) {
      // Move seamlessly to next endpoint
      continue;
    }
  }

  // Tell client to use built-in high-precision fallback if all public GPUs are busy
  return res.status(200).json({ fallback: true });
}
