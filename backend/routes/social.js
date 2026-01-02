const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const verifiedMiddleware = require('../middleware/verifiedMiddleware');
const Post = require('../models/Post');

const router = express.Router();

// Listar posts
router.get('/posts', authMiddleware, verifiedMiddleware, async (req, res) => {
  try {
    const items = await Post.find();
    res.json({ items });
  } catch (err) {
    console.error('Erro ao listar posts:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar post
router.post('/posts', authMiddleware, verifiedMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const p = await Post.create({
      userId: String(req.user._id),
      userName: req.user.name || req.user.email,
      content: String(body.content || ''),
      mediaUrl: body.mediaUrl || null
    });
    res.status(201).json(p);
  } catch (err) {
    console.error('Erro ao criar post:', err);
    res.status(400).json({ error: 'Dados inválidos para criar post' });
  }
});

module.exports = router;