const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');

const router = express.Router();

// Lista de usuários (sanitizada) com busca e paginação
router.get('/', authMiddleware, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit || '20', 10)));
    let users = [];
    // Suporta memória e MongoDB
    if (typeof User.find === 'function') {
      if (User.collection) {
        // Mongoose: aplicar filtro, skip e limit
        const filter = q ? { $or: [{ name: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }] } : {};
        users = await User.find(filter).skip((page - 1) * limit).limit(limit);
      } else {
        const all = await User.find(q ? { q } : {});
        users = all.slice((page - 1) * limit, (page - 1) * limit + limit);
      }
    }
    // Sanitização: remover campos sensíveis
    const safe = users.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      avatar: u.avatar,
      department: u.department,
      position: u.position,
      location: u.location,
      createdAt: u.createdAt,
    }));
    // presença
    const presence = require('../services/presence');
    const enriched = safe.map(u => ({
      ...u,
      online: presence.isOnline(u._id),
      lastSeen: presence.getLastSeen(u._id)
    }));
    res.json({ users: enriched, page, limit });
  } catch (err) {
    console.error('Erro ao listar usuários:', err);
    res.status(500).json({ error: 'Não foi possível listar usuários' });
  }
});

module.exports = router;
