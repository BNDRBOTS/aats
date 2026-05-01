import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '50mb' }));
app.use(express.static('dist')); // serve built frontend

// Proxy endpoint: forwards transcription requests to the real AI API
app.post('/api/transcribe/:provider', async (req, res) => {
    const { provider } = req.params;
    const { model, apiKey, chunk, format } = req.body;

    let response;
    if (provider === 'openai') {
        response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'multipart/form-data'
            },
            body: (() => {
                const form = new FormData();
                const blob = new Blob([Buffer.from(chunk, 'base64')], { type: format });
                form.append('file', blob, 'chunk');
                form.append('model', 'whisper-1');
                return form;
            })()
        });
    } else if (provider === 'anthropic') {
        // Anthropic doesn't have a direct audio endpoint; fallback to chat-based transcription
        // (In production you'd use a dedicated STT service or convert audio to text another way)
        res.status(400).json({ error: 'Anthropic audio transcription not supported via this proxy' });
        return;
    } else if (provider === 'deepseek') {
        res.status(400).json({ error: 'Deepseek audio transcription not supported yet' });
        return;
    } else {
        res.status(400).json({ error: 'Unknown provider' });
        return;
    }

    if (!response.ok) {
        const err = await response.json();
        return res.status(response.status).json({ error: err.error?.message || 'Provider error' });
    }

    const data = await response.json();
    // standardize response
    res.json({ text: data.text, speaker: data.speaker || '' });
});

app.listen(PORT, () => {
    console.log(`Aura proxy running on http://localhost:${PORT}`);
});
