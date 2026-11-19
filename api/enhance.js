export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image, scale } = req.body;
  if (!image) return res.status(400).json({ error: 'No image provided' });

  try {
    // Convert base64 data URL to binary buffer
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const binaryBuffer = Buffer.from(base64Data, 'base64');

    // Step 1: Upload image to Hugging Face Gradio Space (Completely Free, No Credit Card/Billing)
    const formData = new FormData();
    const blob = new Blob([binaryBuffer], { type: 'image/jpeg' });
    formData.append('files', blob, 'input.jpg');

    const uploadRes = await fetch('https://sczhou-codeformer.hf.space/gradio_api/upload', {
      method: 'POST',
      body: formData
    });

    if (!uploadRes.ok) {
      throw new Error('Free GPU queue busy, trying backup...');
    }

    const uploadedFiles = await uploadRes.json();
    const filePath = uploadedFiles[0];

    // Step 2: Trigger CodeFormer Face Restoration + Real-ESRGAN Upscaling
    const upscaleFactor = scale === '8k' ? 4 : 2;
    const callRes = await fetch('https://sczhou-codeformer.hf.space/gradio_api/call/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [
          { path: filePath, meta: { _type: 'gradio.FileData' } },
          true,  // face_align
          true,  // background_enhance
          true,  // face_upsample
          upscaleFactor, // upscale (2 or 4)
          0.7    // codeformer_fidelity
        ]
      })
    });

    const callData = await callRes.json();
    const eventId = callData.event_id;
    if (!eventId) throw new Error('Could not start free GPU job');

    // Step 3: Read SSE stream for result
    const resultRes = await fetch(`https://sczhou-codeformer.hf.space/gradio_api/call/predict/${eventId}`);
    const resultText = await resultRes.text();

    const lines = resultText.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('data: ')) {
        try {
          const parsed = JSON.parse(lines[i].slice(6));
          if (Array.isArray(parsed) && parsed[0] && parsed[0].url) {
            return res.status(200).json({ status: 'succeeded', output: parsed[0].url });
          }
        } catch (e) {}
      }
    }

    throw new Error('Free server busy. Please try again in 5 seconds.');
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
      }
