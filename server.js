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
     // Видалення HTML-тегів і зайвих префіксів
     const cleanedMsg = msg.replace(/<[^>]*>/g, '').trim(); // Видалити HTML
     return cleanedMsg.replace(/^you:\s*/, '').trim(); // Видалити "you:"
   });
 
   // Форматування історії чату для OpenAI
   const chatHistory = [];
   for (let i = 0; i < cleanedMessages.length; i++) {
     if (i % 2 === 0) {
       chatHistory.push({ role: 'user', content: cleanedMessages[i] });
     } else {
       chatHistory.push({ role: 'assistant', content: cleanedMessages[i] });
     }
   }
 
   // Обрізаємо історію до останніх 10 повідомлень
   const trimmedHistory = chatHistory.slice(-10);
 
   // Генеруємо promptMessages
   const promptMessages = [
     {
       role: 'system',
       content: `
         Character Overview:
         - Name: ${botPrompt.name || 'No name available'}
         - Description: ${botPrompt.description?.join(' ') || 'No description available'}
         
         Personality:
         - Traits: ${botPrompt.personality?.traits?.join(', ') || 'No traits available'}
         - Values: ${botPrompt.personality?.values?.join(', ') || 'No values available'}
         - Culture: ${botPrompt.personality?.culture?.join(', ') || 'No culture information available'}
         - Unexpected Scenarios: ${botPrompt.personality?.unexpected_scenarios?.join(', ') || 'No specific instructions for scenarios'}
         
         Add-Ons:
         - References (Melania): ${
           botPrompt.add_ons?.references?.melania?.join('\n- ') || 'No references to Melania provided'
         }
         - References (Son): ${botPrompt.add_ons?.references?.son?.join('\n- ') || 'No references to son provided'}
         - Quirks: ${botPrompt.add_ons?.quirks?.join(', ') || 'No quirks available'}
         - Humor: ${botPrompt.add_ons?.humor?.join(', ') || 'No humor guidelines provided'}
         
         Instructions:
         - Do: ${botPrompt.instruction?.do_donts?.do?.join('\n- ') || 'No instructions available'}
         - Avoid: ${botPrompt.instruction?.do_donts?.dont || 'No specific restrictions'}
         - Message Length: ${botPrompt.instruction?.message_length || 'No preference specified'}
         - Emoji Use: ${botPrompt.instruction?.emoji_use || 'No guidance provided'}
         - Catchphrases: ${botPrompt.instruction?.catchphrases?.join(', ') || 'No catchphrases provided'}
         - Criticism Response: ${
           botPrompt.instruction?.criticism_response?.join('\n') || 'No specific guidance for criticism'
         }
         
         Example Messages:
         ${botPrompt.example_dialogues
           ?.map((dialogue) => `User: ${dialogue.user}\nResponse: ${dialogue.response}`)
           .join('\n') || 'No example messages available'}
       `,
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