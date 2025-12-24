const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const authMiddleware = require('../middleware/authMiddleware');

function canEdit(user, event){
  if (!user || !event) return false;
  if (String(event.createdBy) === String(user._id)) return true;
  if (user.role === 'administrador') return true;
  return false;
}

function toClient(ev){
  return {
    id: ev._id,
    title: ev.title,
    description: ev.description,
    date: ev.date,
    time: ev.time,
    endDate: ev.endDate || ev.date,
    endTime: ev.endTime || ev.time,
    location: ev.location,
    address: ev.address,
    category: ev.category,
    status: ev.status,
    capacity: ev.capacity,
    registered: Array.isArray(ev.attendees) ? ev.attendees.length : 0,
    organizer: ev.organizer,
    color: ev.color,
    attendees: ev.attendees,
    createdBy: ev.createdBy,
    createdAt: ev.createdAt,
    updatedAt: ev.updatedAt
  };
}

// Listar eventos (filtros opcionais)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, category, q, startDate, endDate, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (q) {
      filter.$or = [
        { title: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') },
        { location: new RegExp(q, 'i') }
      ];
    }
    if (startDate || endDate) {
      // date is a string YYYY-MM-DD; do range with lexicographical compare via $gte/$lte
      filter.date = {};
      if (startDate) filter.date.$gte = startDate;
      if (endDate) filter.date.$lte = endDate;
    }
    const skip = (Number(page) - 1) * Number(limit);
    let query = Event.find(filter);
    try {
      if (typeof query.sort === 'function') query = query.sort({ date: 1, time: 1 });
      if (typeof query.skip === 'function') query = query.skip(skip);
      if (typeof query.limit === 'function') query = query.limit(Number(limit));
    } catch (e) {
      // fallback seguro em modo memória
    }
    const events = await Promise.resolve(query);
    res.json({ items: events.map(toClient), count: events.length });
  } catch (err) {
    console.error('Erro ao listar eventos:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Obter evento
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const ev = await Event.findById(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Evento não encontrado' });
    res.json(toClient(ev));
  } catch (err) {
    res.status(400).json({ error: 'ID inválido' });
  }
});

// Criar evento
router.post('/', authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const ev = new Event({
      title: body.title,
      description: body.description,
      date: body.date,
      time: body.time,
      endDate: body.endDate || body.date,
      endTime: body.endTime || body.time,
      location: body.location,
      address: body.address,
      category: body.category,
      status: body.status || 'upcoming',
      capacity: body.capacity || 50,
      organizer: body.organizer || req.user.name || 'Organizador',
      color: body.color || '#1976d2',
      attendees: [],
      createdBy: req.user._id
    });
    await ev.save();
    res.status(201).json(toClient(ev));
  } catch (err) {
    console.error('Erro ao criar evento:', err);
    res.status(400).json({ error: 'Dados inválidos para criar evento' });
  }
});

// Atualizar evento
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const ev = await Event.findById(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Evento não encontrado' });
    if (!canEdit(req.user, ev)) return res.status(403).json({ error: 'Sem permissão' });

    const fields = ['title','description','date','time','endDate','endTime','location','address','category','status','capacity','organizer','color'];
    fields.forEach(f => {
      if (req.body[f] !== undefined) ev[f] = req.body[f];
    });
    await ev.save();
    res.json(toClient(ev));
  } catch (err) {
    res.status(400).json({ error: 'Falha ao atualizar evento' });
  }
});

// Excluir evento
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const ev = await Event.findById(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Evento não encontrado' });
    if (!canEdit(req.user, ev)) return res.status(403).json({ error: 'Sem permissão' });
    await ev.deleteOne();
    res.json({ message: 'Evento excluído com sucesso' });
  } catch (err) {
    res.status(400).json({ error: 'Falha ao excluir evento' });
  }
});

// Inscrever-se no evento
router.post('/:id/register', authMiddleware, async (req, res) => {
  try {
    const ev = await Event.findById(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Evento não encontrado' });
    const already = ev.attendees.find(a => String(a) === String(req.user._id));
    if (already) return res.status(400).json({ error: 'Você já está inscrito' });
    if (ev.capacity && ev.attendees.length >= ev.capacity) return res.status(400).json({ error: 'Evento lotado' });
    ev.attendees.push(req.user._id);
    await ev.save();
    res.json(toClient(ev));
  } catch (err) {
    res.status(400).json({ error: 'Falha ao inscrever no evento' });
  }
});

// Cancelar inscrição
router.post('/:id/unregister', authMiddleware, async (req, res) => {
  try {
    const ev = await Event.findById(req.params.id);
    if (!ev) return res.status(404).json({ error: 'Evento não encontrado' });
    ev.attendees = ev.attendees.filter(a => String(a) !== String(req.user._id));
    await ev.save();
    res.json(toClient(ev));
  } catch (err) {
    res.status(400).json({ error: 'Falha ao cancelar inscrição' });
  }
});

module.exports = router;
