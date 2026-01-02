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

// Adicionar comentário
router.post('/posts/:id/comments', authMiddleware, verifiedMiddleware, async (req, res) => {
  try {
    const postId = req.params.id;
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Comentário vazio' });
    const p = await Post.findById(postId);
    if (!p) return res.status(404).json({ error: 'Post não encontrado' });
    p.comments = p.comments || [];
    p.comments.push({ userId: String(req.user._id), userName: req.user.name || req.user.email, text, createdAt: new Date() });
    await p.save();
    res.status(201).json({ comments: p.comments });
  } catch (err) {
    console.error('Erro ao comentar:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Like/Unlike
router.post('/posts/:id/like', authMiddleware, verifiedMiddleware, async (req, res) => {
  try {
    const postId = req.params.id;
    const p = await Post.findById(postId);
    if (!p) return res.status(404).json({ error: 'Post não encontrado' });
    p.likes = p.likes || [];
    const me = String(req.user._id);
    const idx = p.likes.findIndex(u => String(u) === me);
    if (idx >= 0) p.likes.splice(idx, 1); else p.likes.push(me);
    await p.save();
    res.json({ likes: p.likes, liked: idx < 0, count: p.likes.length });
  } catch (err) {
    console.error('Erro ao curtir:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;