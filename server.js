const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const bot1Prompt = JSON.parse(fs.readFileSync('prompts/moldy.json', 'utf8'));

const app = express();
const PORT = 4000;
const TOKEN = process.env.TOKEN;

const allowedOrigins = ['https://cto-one.vercel.app/', 'https://moldy.lol'];

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
            callback(new Error('Not allowed by CORS')); // Запрещено
         }
      }
   })
);
app.use(bodyParser.json());

// Настройка ограничения частоты запросов
const limiter = rateLimit({
   windowMs: 1 * 60 * 1000,
   max: 60,
   message: 'Too many requests from this IP, please try again later.'
});

app.use('/chat', limiter);

app.post('/chat', async (req, res) => {
   try {
      const { messages } = req.body;
      console.log('message', messages);

      const {
         description: { agent, background, culture },
         personality: { traits, tone, reaction },
         instructions, // Этот объект уже является массивом, не имеет вложенных объектов
         example_messages
      } = bot1Prompt;

      // Очищаем HTML-теги из всех сообщений
      const cleanedMessages = messages.map((msg) => {
         const cleanedMsg = msg.replace(/<.*?>/g, '').trim(); // Removes HTML tags
         return cleanedMsg.replace(/^You:\s*/, '').trim(); // Removes "You:" if present
      });

      console.log('bot1Prompt', bot1Prompt);

      // Конвертируем сообщения в формат OpenAI API
      const chatHistory = [];
      for (let i = 0; i < cleanedMessages.length; i++) {
         if (i % 2 === 0) {
            chatHistory.push({ role: 'user', content: cleanedMessages[i] });
         } else {
            chatHistory.push({
               role: 'assistant',
               content: cleanedMessages[i]
            });
         }
      }

      // Ограничиваем историю (например, до 10 последних сообщений)
      const trimmedHistory = chatHistory.slice(-10);



      const promptMessages = [
         {
           role: 'system',
           content: `
             Character Overview:
             - Agent: ${agent || 'No agent description available'}
             - Background: ${background || 'No background description available'}
             - Culture: ${culture || 'No culture description available'}
       
             Personality Traits:
             - ${traits && traits.length > 0 ? traits.join(', ') : 'No personality traits available'}
       
             Tone:
             - ${tone && tone.length > 0 ? tone.join(', ') : 'No tone available'}
       
             Reaction to Unexpected Scenarios:
             - ${reaction && reaction.unexpected_scenarios ? reaction.unexpected_scenarios : 'No reaction info available'}
       
             Instructions:
             ${instructions && instructions.length > 0 
               ? instructions.map((instruction) => `- ${instruction}`).join('\n')
               : 'No instructions available'}
       
             Example Messages:
             ${example_messages && example_messages.length > 0 
               ? example_messages.map((msg) => `- ${msg}`).join('\n') 
               : 'No example messages available'}
           `
         },
         ...trimmedHistory // Добавляем очищенную историю
       ];

      console.log('promptMessages', promptMessages);

      try {
         const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
               model: 'gpt-3.5-turbo',
               messages: promptMessages
            },
            {
               headers: {
                  Authorization: `Bearer ${TOKEN}`,
                  'Content-Type': 'application/json'
               }
            }
         );

         const botReply = response.data.choices[0].message.content.trim();
         res.json({ reply: botReply });
      } catch (error) {
         console.error('Error fetching from OpenAI:', error);
         res.status(500).json({ error: 'Ошибка при отправке запроса' });
      }
   } catch (error) {
      console.log('Error', error);
   }
});

app.listen(PORT, () => {
   console.log(`Server is running on http://localhost:${PORT}`);
});
