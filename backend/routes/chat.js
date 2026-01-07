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
    convs = await Conversation.find({ participants: me });

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

// Lista convites pendentes
router.get('/conversations/invites', authMiddleware, async (req, res) => {
  try {
    const me = String(req.user._id);
    let invites = [];
    try {
      invites = await Conversation.findInvitesFor(me);
    } catch (_) {
      invites = [];
    }
    const payload = invites.map(c => ({
      _id: c._id,
      name: c.title || 'Conversa',
      isGroup: c.type === 'group',
      eventId: c.eventId || null
    }));
    res.json({ invites: payload });
  } catch (err) {
    console.error('Erro ao listar convites:', err);
    res.status(500).json({ error: 'Não foi possível listar convites' });
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
      conv = new Conversation({ type: 'dm', participants: [me, other], members: [ { userId: me, status: 'accepted' }, { userId: other, status: 'accepted' } ] });
      await conv.save();
    }
    // Auto-join: colocar sockets conectados dos participantes na sala da DM e notificar ambos
    try {
      const io = req.app.get('io');
      const meName = (req.user.name || req.user.email || 'Você');
      const otherUser = await User.findById(other);
      const otherName = otherUser ? (otherUser.name || otherUser.email || 'Usuário') : 'Usuário';
      if (io && io.sockets && io.sockets.sockets) {
        const roomId = String(conv._id);
        io.sockets.sockets.forEach((s) => {
          try {
            const uid = String(s.user?._id || '');
            if ((conv.participants || []).some(p => String(p) === uid)) {
              s.join(roomId);
              const nameForRecipient = (uid === other ? meName : otherName);
              s.emit('conversation:new', { conversation: { _id: conv._id, name: nameForRecipient, isGroup: false } });
            }
          } catch (_) {}
        });
      }
    } catch (_) {}
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

// Criar conversa de grupo com usuários selecionados
router.post('/conversations/group', authMiddleware, async (req, res) => {
  try {
    const me = String(req.user._id);
    const userIds = Array.isArray(req.body.userIds) ? req.body.userIds.map(String) : [];
    const title = String(req.body.title || '').trim();
    const participants = [...new Set([me, ...userIds.filter(id => id && id !== me)])];
    if (participants.length < 2) {
      return res.status(400).json({ error: 'Selecione ao menos 1 usuário' });
    }
    // Criador já aceito; demais usuários entram como pendentes
    const pending = participants.filter(p => p !== me);
    const conv = new Conversation({ type: 'group', title: title || 'Conversa', participants: [me], members: [ { userId: me, status: 'accepted' }, ...pending.map(p => ({ userId: p, status: 'pending' })) ] });
    await conv.save();

    // Auto-join participantes conectados
    try {
      const io = req.app.get('io');
      if (io && io.sockets && io.sockets.sockets) {
        const roomId = String(conv._id);
        io.sockets.sockets.forEach((s) => {
          try {
            const uid = String(s.user?._id || '');
            // Criador entra na sala
            if (String(uid) === String(me)) s.join(roomId);
            // Convidados recebem convite
            if ((conv.members || []).some(m => String(m.userId) === uid && m.status === 'pending')) {
              s.emit('conversation:invite', { conversation: { _id: conv._id, name: conv.title || 'Conversa', isGroup: true } });
            }
          } catch (_) {}
        });
      }
    } catch (_) {}

    res.json({ conversation: { _id: conv._id, name: conv.title || 'Conversa', isGroup: true } });
  } catch (err) {
    console.error('Erro ao criar conversa de grupo:', err);
    res.status(500).json({ error: 'Falha ao criar conversa de grupo' });
  }
});

// Aceitar convite de conversa
router.post('/conversations/:id/accept', authMiddleware, async (req, res) => {
  try {
    const id = String(req.params.id || '');
    const me = String(req.user._id);
    let conv = await Conversation.findById(id);
    if (!conv) return res.status(404).json({ error: 'Conversa não encontrada' });
    // Atualiza status do membro
    let changed = false;
    conv.members = (conv.members || []).map(m => {
      if (String(m.userId) === me && m.status === 'pending') { changed = true; return { userId: me, status: 'accepted' }; }
      return m;
    });
    if (changed) {
      // adiciona nos participants
      const has = (conv.participants || []).some(p => String(p) === me);
      if (!has) conv.participants = [...(conv.participants || []), me];
      await conv.save();
      // Auto-join se socket conectado
      try {
        const io = req.app.get('io');
        if (io && io.sockets && io.sockets.sockets) {
          const roomId = String(conv._id);
          io.sockets.sockets.forEach((s) => {
            try {
              const uid = String(s.user?._id || '');
              if (uid === me) s.join(roomId);
            } catch (_) {}
          });
        }
      } catch (_) {}
    }
    res.json({ conversation: { _id: conv._id, name: conv.title || 'Conversa', isGroup: conv.type === 'group' } });
  } catch (err) {
    console.error('Erro ao aceitar convite:', err);
    res.status(500).json({ error: 'Falha ao aceitar convite' });
  }
});

// Recusar convite de conversa
router.post('/conversations/:id/decline', authMiddleware, async (req, res) => {
  try {
    const id = String(req.params.id || '');
    const me = String(req.user._id);
    let conv = await Conversation.findById(id);
    if (!conv) return res.status(404).json({ error: 'Conversa não encontrada' });
    conv.members = (conv.members || []).map(m => {
      if (String(m.userId) === me && m.status === 'pending') { return { userId: me, status: 'declined' }; }
      return m;
    });
    await conv.save();
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao recusar convite:', err);
    res.status(500).json({ error: 'Falha ao recusar convite' });
  }
});

module.exports = router;
