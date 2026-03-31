require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;
const API_BASE_URL = process.env.API_BASE_URL || 'https://api.openai.com/v1';

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const characters = [
  {
    id: 'tsundere_senpai',
    name: '傲娇学姐',
    persona: '嘴硬但关心人，有点傲娇',
    speaking_style: '短句，带一点吐槽'
  },
  {
    id: 'gentle_teacher',
    name: '温柔老师',
    persona: '耐心细致，循循善诱',
    speaking_style: '温和亲切，多用鼓励性语言'
  },
  {
    id: 'energetic_friend',
    name: '元气朋友',
    persona: '活泼开朗，充满正能量',
    speaking_style: '热情洋溢，语气欢快'
  }
];

const sessions = {};

const MAX_MESSAGES = 10;

function buildSystemPrompt(character) {
  return `你正在扮演一个角色，请严格遵守以下设定：

角色名称：${character.name}
性格：${character.persona}
说话风格：${character.speaking_style}

要求：
- 始终保持角色语气
- 不要提到自己是AI
- 不要跳出角色

请根据对话继续交流。`;
}

app.get('/api/characters', (req, res) => {
  res.json({ characters });
});

app.get('/api/characters/:id', (req, res) => {
  const character = characters.find(c => c.id === req.params.id);
  if (!character) {
    return res.status(404).json({ error: 'Character not found' });
  }
  res.json({ character });
});

app.post('/api/sessions', (req, res) => {
  const { character_id } = req.body;
  const character = characters.find(c => c.id === character_id);
  if (!character) {
    return res.status(404).json({ error: 'Character not found' });
  }

  const session_id = Date.now().toString();
  sessions[session_id] = {
    session_id,
    character_id,
    messages: []
  };

  res.json({ session_id });
});

app.get('/api/sessions/:id', (req, res) => {
  const session = sessions[req.params.id];
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json({ session });
});

app.post('/api/sessions/:id/chat', async (req, res) => {
  const { message } = req.body;
  const session = sessions[req.params.id];

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const character = characters.find(c => c.id === session.character_id);
  if (!character) {
    return res.status(404).json({ error: 'Character not found' });
  }

  session.messages.push({
    role: 'user',
    content: message
  });

  const recentMessages = session.messages.slice(-MAX_MESSAGES);

  const systemPrompt = buildSystemPrompt(character);

  const finalMessages = [
    {
      role: 'system',
      content: systemPrompt
    },
    ...recentMessages
  ];

  try {
    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: finalMessages,
        temperature: 0.8
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const assistantMessage = data.choices[0].message.content;

    session.messages.push({
      role: 'assistant',
      content: assistantMessage
    });

    res.json({
      message: assistantMessage,
      session: sessions[req.params.id]
    });
  } catch (error) {
    console.error('Chat Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`AI Chat System running on http://localhost:${PORT}`);
});
