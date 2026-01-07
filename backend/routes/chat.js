const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const Conversation = require('../models/Conversation');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const Event = require('../models/Event');

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

// Criar/garantir conversa de grupo para um evento
router.post('/conversations/event', authMiddleware, async (req, res) => {
  try {
    const me = String(req.user._id);
    const eventId = String(req.body.eventId || '');
    if (!eventId) return res.status(400).json({ error: 'eventId obrigatório' });

    // validar evento existente
    let ev = null;
    try { ev = await Event.findById(eventId); } catch (_) {}
    if (!ev) return res.status(404).json({ error: 'Evento não encontrado' });

    // procurar conversa de grupo vinculada ao evento
    let convs = await Conversation.find({ type: 'group', eventId });
    let conv = convs && convs.length ? convs[0] : null;
    if (!conv) {
      conv = new Conversation({ type: 'group', title: ev.title || 'Evento', participants: [me], eventId });
      await conv.save();
    } else {
      // garantir que o usuário atual é participante
      const hasMe = (conv.participants || []).some(p => String(p) === me);
      if (!hasMe) {
        conv.participants = [...(conv.participants || []), me];
        await conv.save();
      }
    }

    // Auto-join imediato: colocar sockets conectados dos participantes na sala
    try {
      const io = req.app.get('io');
      if (io && io.sockets && io.sockets.sockets) {
        const roomId = String(conv._id);
        io.sockets.sockets.forEach((s) => {
          try {
            const uid = String(s.user?._id || '');
            if ((conv.participants || []).some(p => String(p) === uid)) {
              s.join(roomId);
            }
          } catch (_) {}
        });
      }
    } catch (_) {}
    res.json({
      conversation: {
        _id: conv._id,
        name: conv.title || (ev.title || 'Evento'),
        isGroup: true,
        eventId: eventId
      }
    });
  } catch (err) {
    console.error('Erro ao criar/garantir conversa de evento:', err);
    res.status(500).json({ error: 'Falha ao criar conversa de evento' });
  }
});

module.exports = router;
