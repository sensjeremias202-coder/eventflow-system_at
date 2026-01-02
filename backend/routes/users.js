const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');

const router = express.Router();

// Lista de usuários (sanitizada)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    let users = [];
    // Suporta memória e MongoDB
    if (typeof User.find === 'function') {
      users = await User.find(q ? { q } : {});
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
    res.json({ users: safe });
  } catch (err) {
    console.error('Erro ao listar usuários:', err);
    res.status(500).json({ error: 'Não foi possível listar usuários' });
  }
});

module.exports = router;
