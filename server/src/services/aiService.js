import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI = null;
let model = null;

function initAI() {
  if (!genAI && process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ 
      model: "gemini-flash-latest",
      systemInstruction: "You are QueryFlow AI, a helpful database assistant. Communicate like a real human. Do NOT use markdown headers (like ###). Instead, use double new lines to separate sections. Do NOT use markdown bolding (like **text**). Instead, use double quotation marks (like \"text\") to emphasize important terms. Keep your tone natural, helpful, and concise. Your primary goal is to guide users through database queries using the provided schema context."
    });
  }
  return model;
}

export async function getAiResponse(prompt, history = [], schema = []) {
  try {
    const activeModel = initAI();
    if (!activeModel) {
      throw new Error('Gemini API Key is missing. Please set GEMINI_API_KEY in your .env file.');
    }

    // Format schema for AI context
    const schemaContext = schema.length > 0 
      ? `\n\nCURRENT DATABASE SCHEMA:\n${schema.map(t => 
          `- Table: ${t.tableName} (${t.columns.map(c => `${c.columnName} ${c.dataType}`).join(', ')})`
        ).join('\n')}`
      : '\n\nNo specific database schema context provided.';

    // We can't change the systemInstruction after initialization easily with getGenerativeModel
    // but we can prepend it to the message or use a specialized chat session.
    // For Gemini Flash, it's often better to put the context in the very first message or as a system part.
    
    const enrichedPrompt = `CONTEXT: ${schemaContext}\n\nUSER QUESTION: ${prompt}`;
    // If our history starts with an assistant greeting, we need to skip it for the API call.
    let chatHistory = [];
    let startIdx = 0;
    while (startIdx < history.length && history[startIdx].role !== 'user') {
      startIdx++;
    }

    chatHistory = history.slice(startIdx).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    const chat = activeModel.startChat({
      history: chatHistory,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
    });

    const result = await chat.sendMessage(enrichedPrompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('[AI Service Error]:', error);
    throw error;
  }
}
