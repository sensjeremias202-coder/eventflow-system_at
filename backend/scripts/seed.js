require('dotenv').config();
const connectDB = require('../config/database');
const User = require('../models/User');

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

    console.log('Seed concluído.');
    process.exit(0);
  } catch (err) {
    console.error('Falha no seed:', err);
    process.exit(1);
  }
}

run();
