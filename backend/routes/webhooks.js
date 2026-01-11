const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

// Callback para receber banner gerado pela automação (Zapier/Make + Canva)
// Espera { eventId, bannerUrl }
router.post('/banner', async (req, res) => {
  try {
    const { eventId, bannerUrl } = req.body || {};
    if (!eventId || !bannerUrl) return res.status(400).json({ error: 'Parâmetros obrigatórios: eventId, bannerUrl' });
    const ev = await Event.findById(String(eventId));
    if (!ev) return res.status(404).json({ error: 'Evento não encontrado' });
    ev.bannerUrl = String(bannerUrl);
    await ev.save();
    // Notifica frontends do criador sobre atualização
    try {
      const io = req.app.get('io');
      if (io) {
        const payload = { event: {
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
        } };
        io.to(`user:${String(ev.createdBy)}`).emit('event:updated', payload);
      }
    } catch (_) {}
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Falha ao processar webhook' });
  }
});

module.exports = router;