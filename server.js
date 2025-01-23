const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Load prompts for three different bots
const bot1Prompt = JSON.parse(fs.readFileSync('prompts/moldy.json', 'utf8'));
const bot2Prompt = JSON.parse(fs.readFileSync('prompts/bot2.json', 'utf8'));
const bot3Prompt = JSON.parse(fs.readFileSync('prompts/bot3.json', 'utf8'));

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
    const cleanedMsg = msg.replace(/<.*?>/g, '').trim(); // Removes HTML tags
    return cleanedMsg.replace(/^You:\s*/, '').trim(); // Removes "You:" if present
  });

  // Convert messages to OpenAI format
  const chatHistory = [];
  for (let i = 0; i < cleanedMessages.length; i++) {
    if (i % 2 === 0) {
      chatHistory.push({ role: 'user', content: cleanedMessages[i] });
    } else {
      chatHistory.push({ role: 'assistant', content: cleanedMessages[i] });
    }
  }

  // Limit history to last 10 messages
  const trimmedHistory = chatHistory.slice(-10);

  const promptMessages = [
    {
      role: 'system',
      content: `
        Character Overview:
        - Name: ${botPrompt.name || 'No name available'}
        - Description: ${botPrompt.description || 'No description available'}
        
        Personality:
        - ${botPrompt.details.personality && botPrompt.details.personality.length > 0
            ? botPrompt.details.personality.join(', ')
            : 'No personality traits available'}
        
        Instructions:
        ${botPrompt.details.instructions && botPrompt.details.instructions.do_and_donts.length > 0
            ? botPrompt.details.instructions.do_and_donts.map((instruction) => `- ${instruction}`).join('\n')
            : 'No instructions available'}
        
        Example Messages:
        ${botPrompt.details.instructions && botPrompt.details.instructions.response_guidelines.length > 0
            ? botPrompt.details.instructions.response_guidelines.map((msg) => `- ${msg}`).join('\n')
            : 'No example messages available'}
      `,
    },
    ...trimmedHistory,
  ];

  return promptMessages;
};

// Route for Bot 1
app.post('/chat/bot1', async (req, res) => {
  handleChat(req, res, bot1Prompt);
});

// Route for Bot 2
app.post('/chat/bot2', async (req, res) => {
  handleChat(req, res, bot2Prompt);
});

// Route for Bot 3
app.post('/chat/bot3', async (req, res) => {
  handleChat(req, res, bot3Prompt);
});

// Main chat handling logic
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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});