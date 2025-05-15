const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = 4000;
const TOKEN = process.env.TOKEN;

// 🔐 Дозволені домени
const allowedOrigins = ['https://boobsi.vercel.app', 'https://moldy.lol'];

// ✅ CORS
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || origin.startsWith('http://localhost') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(bodyParser.json());

// ⚠️ Rate limiter
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many requests from this IP, try again later.',
});

// 📦 Завантаження промптів
const loadPrompt = (filename) => JSON.parse(fs.readFileSync(`prompts/${filename}`, 'utf8'));
const botPrompts = {
  bot1: loadPrompt('Sunny.json'),
  bot2: loadPrompt('Mini.json'),
  bot3: loadPrompt('Nova.json'),
  bot4: loadPrompt('Eva.json'),
};

// 🧠 Генерація повідомлень для OpenAI
const getPromptMessages = (botPrompt, messages) => {
  const cleaned = messages.map(msg => msg.replace(/<[^>]*>/g, '').replace(/^you:\s*/i, '').trim());
  const chatHistory = cleaned.map((text, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: text,
  }));

  const systemContent = `
Character Overview:
- Name: ${botPrompt.name || 'Unknown'}
- Description: ${(botPrompt.description?.details || []).join(' ')}

Personality:
- Traits: ${(botPrompt.personality?.traits || []).join(', ')}
- Values: ${(botPrompt.personality?.values || []).join(', ')}
- Culture: ${(botPrompt.personality?.culture || []).join(', ')}
- Unexpected Scenarios: ${botPrompt.personality?.unexpected_scenarios || 'None'}

Add-Ons:
- Quirks: ${(botPrompt.add_ons?.quirks || []).join(', ')}
- Humor: ${(botPrompt.add_ons?.humor || []).join(', ')}

Instructions:
- Do: ${(botPrompt.instruction?.do_donts?.do || []).join('\n- ')}
- Avoid: ${botPrompt.instruction?.do_donts?.dont || 'None'}
- Message Length: ${botPrompt.instruction?.message_length || 'Any'}
- Emoji Use: ${botPrompt.instruction?.emoji_use || 'Any'}
- Catchphrases: ${(botPrompt.instruction?.catchphrases || []).join(', ')}
- Criticism Response: ${(botPrompt.instruction?.criticism_response || []).join('\n')}

Examples:
${(botPrompt.example_dialogues || []).map(ex => `User: ${ex.user}\nResponse: ${ex.response}`).join('\n')}
`.trim();

  return [
    { role: 'system', content: systemContent },
    ...chatHistory.slice(-10)
  ];
};

// 📡 Обробка чату
const handleChat = async (req, res, botPrompt) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages)) throw new Error("Invalid 'messages' array");

    const payload = {
      model: 'gpt-3.5-turbo',
      messages: getPromptMessages(botPrompt, messages),
    };

    const response = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const reply = response.data.choices[0].message.content.trim();
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err?.response?.data || err.message);
    res.status(500).json({
      error: 'OpenAI request failed',
      details: err?.response?.data || err.message
    });
  }
};

// 🧩 Маршрути для кожного бота
app.post('/chat/bot1', limiter, (req, res) => handleChat(req, res, botPrompts.bot1));
app.post('/chat/bot2', limiter, (req, res) => handleChat(req, res, botPrompts.bot2));
app.post('/chat/bot3', limiter, (req, res) => handleChat(req, res, botPrompts.bot3));
app.post('/chat/bot4', limiter, (req, res) => handleChat(req, res, botPrompts.bot4));

// 🔁 За замовчуванням — bot1
app.post('/chat', limiter, (req, res) => handleChat(req, res, botPrompts.bot1));

// 🚀 Запуск
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
