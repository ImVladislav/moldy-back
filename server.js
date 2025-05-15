const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Load prompts for three different bots
const bot1Prompt = JSON.parse(fs.readFileSync('prompts/Sunny.json', 'utf8'));
const bot2Prompt = JSON.parse(fs.readFileSync('prompts/Mini.json', 'utf8'));
const bot3Prompt = JSON.parse(fs.readFileSync('prompts/Nova.json', 'utf8'));
const bot4Prompt = JSON.parse(fs.readFileSync('prompts/Eva.json', 'utf8'));

const app = express();
const PORT = 4000;
const TOKEN = process.env.TOKEN;

const allowedOrigins = ['https://cto-one.vercel.app', 'https://moldy.lol'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1') ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS')); // Deny the request
      }
    },
  })
);

app.use(bodyParser.json());

// Set up rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 requests per minute
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/chat', limiter);

// Helper function to handle prompts
const getPromptMessages = (botPrompt, messages) => {
  const cleanedMessages = messages.map((msg) => {
    const cleanedMsg = msg.replace(/<[^>]*>/g, '').trim();
    return cleanedMsg.replace(/^you:\s*/i, '').trim();
  });

  const chatHistory = [];
  for (let i = 0; i < cleanedMessages.length; i++) {
    chatHistory.push({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: cleanedMessages[i],
    });
  }

  const trimmedHistory = chatHistory.slice(-10);

  const references = botPrompt.add_ons?.references || {};

  const promptMessages = [
    {
      role: 'system',
      content: `
Character Overview:
- Name: ${botPrompt.name || 'No name available'}
- Description: ${(botPrompt.description?.details || []).join(' ') || 'No description available'}

Personality:
- Traits: ${(botPrompt.personality?.traits || []).join(', ') || 'No traits'}
- Values: ${(botPrompt.personality?.values || []).join(', ') || 'No values'}
- Culture: ${(botPrompt.personality?.culture || []).join(', ') || 'No culture info'}
- Unexpected Scenarios: ${botPrompt.personality?.unexpected_scenarios || 'None'}

Add-Ons:
- References (1): ${(references.sunblock || references.donald || references.stars || []).join('\n- ') || 'No references'}
- References (2): ${(references.boys || references.hat || references.past || []).join('\n- ') || 'No references'}
- Quirks: ${(botPrompt.add_ons?.quirks || []).join(', ') || 'No quirks'}
- Humor: ${(botPrompt.add_ons?.humor || []).join(', ') || 'No humor'}

Instructions:
- Do: ${(botPrompt.instruction?.do_donts?.do || []).join('\n- ') || 'None'}
- Avoid: ${botPrompt.instruction?.do_donts?.dont || 'None'}
- Message Length: ${botPrompt.instruction?.message_length || 'Unspecified'}
- Emoji Use: ${botPrompt.instruction?.emoji_use || 'Unspecified'}
- Catchphrases: ${(botPrompt.instruction?.catchphrases || []).join(', ') || 'None'}
- Criticism Response: ${(botPrompt.instruction?.criticism_response || []).join('\n') || 'None'}

Example Messages:
${(botPrompt.example_dialogues || [])
  .map((dialogue) => `User: ${dialogue.user}\nResponse: ${dialogue.response}`)
  .join('\n') || 'None'}
      `.trim(),
    },
    ...trimmedHistory,
  ];

  return promptMessages;
};


// Handle different bots
const handleChat = async (req, res, botPrompt) => {
  try {
    const { messages } = req.body;
    console.log('Received messages:', messages);

    const promptMessages = getPromptMessages(botPrompt, messages);

    console.log('Prepared prompt messages:', promptMessages);

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: promptMessages,
        },
        {
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const botReply = response.data.choices[0].message.content.trim();
      res.json({ reply: botReply });
    } catch (error) {
      console.error('Error fetching from OpenAI:', error);
      res.status(500).json({ error: 'Error fetching response from OpenAI' });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'Error processing request' });
  }
};

// Routes for each bot
app.post('/chat/bot1', async (req, res) => {
  handleChat(req, res, bot1Prompt); // Uses Donald.json
});

app.post('/chat/bot2', async (req, res) => {
  handleChat(req, res, bot2Prompt); // Uses Junior.json
});
app.post('/chat', async (req, res) => {
   handleChat(req, res, bot2Prompt); // Uses Junior.json
 });
app.post('/chat/bot3', async (req, res) => {
  handleChat(req, res, bot3Prompt); // Uses Melania.json
});
app.post('/chat/bot4', async (req, res) => {
  handleChat(req, res, bot4Prompt); // Uses Eva.json
});
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});