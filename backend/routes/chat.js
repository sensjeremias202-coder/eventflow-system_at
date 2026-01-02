const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const Conversation = require('../models/Conversation');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');

const router = express.Router();

// Lista conversas do usuário autenticado
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const me = String(req.user._id);
    let convs = [];
    // memory-mode and mongoose both expose find()
    convs = await Conversation.find({ participantId: me });

    // Montar payload com último preview
    const result = [];
    for (const c of convs) {
      let name = c.title || '';
      if (c.type === 'dm') {
        // determinar outro participante
        const otherId = (c.participants || []).find(id => String(id) !== me);
        const other = otherId ? await User.findById(otherId) : null;
        name = other ? (other.name || other.email || 'Usuário') : 'DM';
      }
      let lastMsg = null;
      try {
        const msgs = await ChatMessage.find({ conversationId: c._id, page: 1, limit: 1 });
        if (msgs && msgs.length) lastMsg = msgs[msgs.length - 1];
      } catch (_) {}
      result.push({
        _id: c._id,
        name,
        isGroup: c.type === 'group',
        lastMessage: lastMsg ? lastMsg.text : '',
        time: lastMsg ? lastMsg.time : '',
        unread: 0,
      });
    }
    res.json({ conversations: result });
  } catch (err) {
    console.error('Erro ao listar conversas:', err);
    res.status(500).json({ error: 'Não foi possível listar conversas' });
  }
});

// Criar/garantir DM com userId
router.post('/conversations/dm', authMiddleware, async (req, res) => {
  try {
    const me = String(req.user._id);
    const other = String(req.body.userId || '');
    if (!other || other === me) {
      return res.status(400).json({ error: 'userId inválido' });
    }
    let conv = await Conversation.findDM(me, other);
    if (!conv) {
      conv = new Conversation({ type: 'dm', participants: [me, other] });
      await conv.save();
    }
    // nome amigável
    const otherUser = await User.findById(other);
    res.json({
      conversation: {
        _id: conv._id,
        name: otherUser ? (otherUser.name || otherUser.email || 'Usuário') : 'DM',
        isGroup: false
      }
    });
  } catch (err) {
    console.error('Erro ao criar/garantir DM:', err);
    res.status(500).json({ error: 'Falha ao criar conversa' });
  }
});

module.exports = router;
