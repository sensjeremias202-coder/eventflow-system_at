require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const eventsRoutes = require('./routes/events');

const app = express();
const PORT = process.env.PORT || 5000;

// Conectar ao MongoDB
connectDB();

// Middleware
// CORS configurável por ambiente: use CORS_ORIGIN (lista separada por vírgula) ou '*' por padrão
const corsOrigins = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
    origin: corsOrigins.length === 1 && corsOrigins[0] === '*' ? '*' : corsOrigins,
    credentials: false
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);

// Rota de teste
app.get('/', (req, res) => {
    res.json({ message: 'API do Eventflow funcionando!' });
});

// Middleware de erro
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Algo deu errado!' });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});