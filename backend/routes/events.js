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
    bannerUrl: ev.bannerUrl || '',
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
    // Notifica o próprio usuário (outros dispositivos) que um evento foi criado
    try {
      const io = req.app.get('io');
      if (io) io.to(`user:${String(req.user._id)}`).emit('event:created', { event: toClient(ev) });
    } catch (_) {}

    // Dispara webhook para automação de banner (Zapier/Make + Canva)
    try {
      const WEBHOOK = process.env.BANNER_WEBHOOK_URL || process.env.ZAPIER_WEBHOOK_URL || process.env.MAKE_WEBHOOK_URL;
      if (WEBHOOK) {
        // Executa sem bloquear a resposta
        setImmediate(() => postWebhook(WEBHOOK, {
          type: 'event.created',
          eventId: String(ev._id),
          title: ev.title,
          description: ev.description || '',
          date: ev.date,
          time: ev.time,
          location: ev.location || '',
          organizer: ev.organizer || '',
          // URL pública sugerida para detalhes (frontend)
          detailsUrl: `${process.env.FRONTEND_BASE_URL || ''}/pages/event-details.html?id=${String(ev._id)}`
        }).catch(()=>{}));
      }
    } catch (_) { /* silencioso */ }
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
    // Notificar atualização para dispositivos do criador e do usuário que realizou a ação
    try {
      const io = req.app.get('io');
      if (io) {
        const payload = { event: toClient(ev) };
        io.to(`user:${String(ev.createdBy)}`).emit('event:updated', payload);
        if (String(ev.createdBy) !== String(req.user._id)) {
          io.to(`user:${String(req.user._id)}`).emit('event:updated', payload);
        }
      }
    } catch (_) {}
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
    // Notificar exclusão para dispositivos do criador e do usuário que realizou a ação
    try {
      const io = req.app.get('io');
      if (io) {
        const payload = { id: String(ev._id) };
        io.to(`user:${String(ev.createdBy)}`).emit('event:deleted', payload);
        if (String(ev.createdBy) !== String(req.user._id)) {
          io.to(`user:${String(req.user._id)}`).emit('event:deleted', payload);
        }
      }
    } catch (_) {}
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
    try {
      const io = req.app.get('io');
      if (io) {
        const payload = { event: toClient(ev) };
        io.to(`user:${String(ev.createdBy)}`).emit('event:updated', payload);
        io.to(`user:${String(req.user._id)}`).emit('event:updated', payload);
      }
    } catch (_) {}
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
    try {
      const io = req.app.get('io');
      if (io) {
        const payload = { event: toClient(ev) };
        io.to(`user:${String(ev.createdBy)}`).emit('event:updated', payload);
        io.to(`user:${String(req.user._id)}`).emit('event:updated', payload);
      }
    } catch (_) {}
    res.json(toClient(ev));
  } catch (err) {
    res.status(400).json({ error: 'Falha ao cancelar inscrição' });
  }
});

module.exports = router;
// Lista apenas eventos criados pelo usuário autenticado
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = { createdBy: req.user._id };
    let query = Event.find(filter);
    try {
      if (typeof query.sort === 'function') query = query.sort({ date: 1, time: 1 });
      if (typeof query.skip === 'function') query = query.skip(skip);
      if (typeof query.limit === 'function') query = query.limit(Number(limit));
    } catch (_) {}
    const events = await Promise.resolve(query);
    res.json({ items: (events || []).map(toClient), count: Array.isArray(events) ? events.length : 0 });
  } catch (err) {
    console.error('Erro ao listar meus eventos:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Helper simples para POST JSON em webhook HTTPS
function postWebhook(url, payload){
  return new Promise((resolve, reject) => {
    try {
      const { URL } = require('url');
      const u = new URL(url);
      const https = require('https');
      const data = Buffer.from(JSON.stringify(payload));
      const req = https.request({
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + (u.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      }, (res) => {
        // Consumir resposta e resolver
        res.on('data', () => {});
        res.on('end', () => resolve());
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    } catch (e) { reject(e); }
  });
}
