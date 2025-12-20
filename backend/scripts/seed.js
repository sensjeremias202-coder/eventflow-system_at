require('dotenv').config();
const connectDB = require('../config/database');
const User = require('../models/User');
const Event = require('../models/Event');

(async function run() {
  try {
    await connectDB();
    const email = process.env.SEED_USER_EMAIL || 'seed@eventflow.local';
    const password = process.env.SEED_USER_PASSWORD || '123456';
    const reset = String(process.env.SEED_RESET || '').toLowerCase() === 'true';

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({
        name: process.env.SEED_USER_NAME || 'Usuário Seed',
        email,
        password,
        role: 'administrador'
      });
      await user.save();
      console.log(`✅ Usuário seed criado: ${email} (senha: ${password})`);
    } else {
      console.log(`ℹ️ Usuário seed encontrado: ${email}`);
    }

    if (reset) {
      await Event.deleteMany({});
      console.log('🧹 Eventos antigos removidos');
    }

    // Utilitários de data
    const today = new Date();
    function fmtDate(d){ return d.toISOString().split('T')[0]; }
    function addDays(n){ const d = new Date(today); d.setDate(d.getDate()+n); return d; }

    const samples = [
      {
        title: 'Conferência Tech',
        description: 'Conferência com trilhas de IA, Web e Cloud.',
        date: fmtDate(addDays(7)),
        time: '09:00',
        endDate: fmtDate(addDays(7)),
        endTime: '18:00',
        location: 'Centro de Convenções',
        address: 'Av. Paulista, 1234 - São Paulo, SP',
        category: 'Tecnologia',
        status: 'upcoming',
        capacity: 500,
        organizer: 'Equipe Eventflow',
        color: '#1976d2'
      },
      {
        title: 'Workshop Marketing Digital',
        description: 'Táticas práticas para growth e mídia paga.',
        date: fmtDate(addDays(-5)),
        time: '14:00',
        endDate: fmtDate(addDays(-5)),
        endTime: '18:00',
        location: 'Sala A',
        address: 'Rua Augusta, 567 - São Paulo, SP',
        category: 'Marketing',
        status: 'completed',
        capacity: 80,
        organizer: 'Equipe Eventflow',
        color: '#f57c00'
      },
      {
        title: 'Meetup Dev',
        description: 'Networking e talks curtas de desenvolvimento.',
        date: fmtDate(addDays(1)),
        time: '19:00',
        endDate: fmtDate(addDays(1)),
        endTime: '21:00',
        location: 'Auditório 2',
        address: 'Rua dos Devs, 42 - Campinas, SP',
        category: 'Desenvolvimento',
        status: 'upcoming',
        capacity: 120,
        organizer: 'Comunidade Dev',
        color: '#7b1fa2'
      }
    ];

    // Evitar duplicados pelo par (title,date)
    const inserted = [];
    for (const s of samples) {
      const exists = await Event.findOne({ title: s.title, date: s.date });
      if (exists) { console.log(`↩️ Já existe: ${s.title} - ${s.date}`); continue; }
      const ev = new Event({ ...s, attendees: [], createdBy: user._id });
      await ev.save();
      inserted.push(ev);
    }

    console.log(`✅ Seeds concluídos. Novos eventos: ${inserted.length}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Erro no seed:', err);
    process.exit(1);
  }
})();
