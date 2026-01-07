require('dotenv').config();
const connectDB = require('../config/database');
const User = require('../models/User');
const Event = require('../models/Event');
const Conversation = require('../models/Conversation');

async function run() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('MONGODB_URI não definido. Defina a URI antes de rodar o seed.');
      process.exit(1);
    }
    await connectDB();

    const samples = [
      { name: 'Alice Souza', email: 'alice@example.com', password: '123456', role: 'participante' },
      { name: 'Bruno Lima', email: 'bruno@example.com', password: '123456', role: 'participante' },
      { name: 'Carla Mendes', email: 'carla@example.com', password: '123456', role: 'organizador' },
    ];

    for (const s of samples) {
      const existing = await User.findOne({ email: s.email });
      if (existing) {
        console.log(`Usuário já existe: ${s.email}`);
        continue;
      }
      const u = new User(s);
      await u.save();
      console.log(`Criado usuário: ${s.name} <${s.email}>`);
    }

    // Buscar usuários para relacionamentos
    const users = [];
    for (const s of samples) {
      const u = await User.findOne({ email: s.email });
      if (u) users.push(u);
    }
    const owner = users[0];

    // Criar eventos de exemplo
    if (owner) {
      const today = new Date();
      const fmt = (n) => n.toString().padStart(2, '0');
      const yyyy = today.getFullYear();
      const mm = fmt(today.getMonth() + 1);
      const dd = fmt(today.getDate());
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const timeStr = `${fmt(today.getHours())}:${fmt(today.getMinutes())}`;

      const events = [
        { title: 'Meetup Node.js', description: 'Encontro da comunidade', date: dateStr, time: timeStr, location: 'São Paulo', category: 'Tech', createdBy: owner._id },
        { title: 'Workshop Frontend', description: 'Hands-on', date: dateStr, time: timeStr, location: 'Online', category: 'Educação', createdBy: owner._id }
      ];

      for (const ev of events) {
        // evita duplicar por título + data
        let exists = null;
        try { exists = await Event.find({ $or: [{ title: new RegExp(`^${ev.title}$`, 'i') }] }).sort().skip().limit(); } catch(_) {}
        if (!Array.isArray(exists) || exists.length === 0) {
          const e = new Event(ev);
          await e.save();
          console.log(`Criado evento: ${e.title}`);
        } else {
          console.log(`Evento já existe: ${ev.title}`);
        }
      }

      // Criar grupo padrão para testes de chat em grupo
      const title = 'Grupo de Teste';
      try {
        // Não temos busca por título no modelo, então criaremos sempre que não houver um com mesmo participants set
        const participantIds = users.slice(0, 3).map(u => String(u._id));
        let created = false;
        // Verifica se já existe grupo com mesmos participantes (ordem ignorada)
        try {
          const allGroups = await Conversation.find({ type: 'group' });
          if (Array.isArray(allGroups)) {
            const norm = (arr) => [...new Set(arr.map(String))].sort().join(',');
            const target = norm(participantIds);
            const found = allGroups.find(g => norm(g.participants || []) === target);
            if (found) {
              console.log('Grupo de Teste já existe.');
            } else {
              const conv = new Conversation({ type: 'group', title, participants: participantIds });
              await conv.save();
              console.log('Criado grupo de teste para chat em grupo.');
              created = true;
            }
          }
        } catch (_) {
          // fallback: tenta criar direto
          const conv = new Conversation({ type: 'group', title, participants: users.slice(0,3).map(u => String(u._id)) });
          await conv.save();
          console.log('Criado grupo de teste para chat em grupo.');
          created = true;
        }
        if (!created) {
          // nada a fazer
        }
      } catch (e) {
        console.log('Falha ao criar grupo de teste (ignorado):', e?.message || e);
      }
    }

    console.log('Seed concluído.');
    process.exit(0);
  } catch (err) {
    console.error('Falha no seed:', err);
    process.exit(1);
  }
}

run();
