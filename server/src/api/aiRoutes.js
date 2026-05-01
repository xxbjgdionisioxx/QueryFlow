import { Router } from 'express';
import { getAiResponse } from '../services/aiService.js';
import { requireAuth } from './routes.js';

export const aiRouter = Router();

// ── POST /chat ───────────────────────────────────────────────────────────────
aiRouter.post('/chat', requireAuth, async (req, res, next) => {
  try {
    const { message, history, schema } = req.body;
    console.log(`[AI Request] Message length: ${message?.length}, History: ${history?.length}, Schema Tables: ${schema?.length}`);
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const reply = await getAiResponse(message, history || [], schema || []);
    res.json({ reply });
  } catch (err) {
    console.error('[AI Router Error]:', err);

    // Some Google AI errors put status in err.status, others in err.response.status
    const status = err.status || err.response?.status;
    const isQuotaError = status === 429 || err.message?.includes('429') || err.message?.includes('Too Many Requests');

    if (isQuotaError) {
      return res.status(429).json({ 
        error: 'AI quota exceeded (Gemini Free Tier). Please wait about 60 seconds before asking again.' 
      });
    }

    if (err.message?.includes('API Key')) {
      return res.status(500).json({ 
        error: 'AI configuration error. Please verify your GEMINI_API_KEY.' 
      });
    }

    res.status(500).json({ 
      error: 'The AI assistant is temporarily unavailable. Please try again later.' 
    });
  }
});
