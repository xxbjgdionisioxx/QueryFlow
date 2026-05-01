import { create } from 'zustand';
import api from '../services/api';

export const useAiStore = create((set, get) => ({
  messages: [
    { role: 'assistant', content: 'Hello! I am QueryFlow AI, powered by Gemini Flash. How can I help you with your database or queries today?' }
  ],
  isAiLoading: false,

  sendMessage: async (content, schema = []) => {
    const { messages } = get();
    const newUserMessage = { role: 'user', content };
    
    set({ 
      messages: [...messages, newUserMessage],
      isAiLoading: true 
    });

    try {
      // Send current history and the current schema context
      const { data } = await api.post('/ai/chat', {
        message: content,
        history: messages,
        schema: schema
      });

      set((state) => ({
        messages: [...state.messages, { role: 'assistant', content: data.reply }],
        isAiLoading: false
      }));
    } catch (err) {
      set((state) => ({
        messages: [...state.messages, { 
          role: 'assistant', 
          content: err.response?.data?.error || 'Sorry, I encountered an error connecting to the AI service.' 
        }],
        isAiLoading: false
      }));
    }
  },

  clearChat: () => {
    set({
      messages: [
        { role: 'assistant', content: 'Hello! I am QueryFlow AI. How can I help you today?' }
      ]
    });
  }
}));
