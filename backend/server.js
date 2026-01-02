require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const eventsRoutes = require('./routes/events');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);
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

// Rota de saúde para health check da plataforma
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// HEAD root para alguns health checks que usam HEAD
app.head('/', (req, res) => {
    res.status(200).end();
});

// 404 amigável para rotas não encontradas
app.use((req, res, next) => {
    if (!res.headersSent) {
        return res.status(404).json({ error: 'Rota não encontrada', path: req.path });
    }
    next();
});

// Middleware de erro
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Algo deu errado!' });
});

// Socket.IO: configuração e handlers
const io = new Server(server, {
    cors: {
        origin: corsOrigins.length === 1 && corsOrigins[0] === '*' ? '*' : corsOrigins,
        methods: ['GET', 'POST']
    }
});

// Store simples em memória
const chatStore = {
    messages: {}, // { conversationId: [ { id, senderId, senderName, text, time, status } ] }
};

// Autenticação no handshake via JWT
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
        if (!token) return next(new Error('auth_required'));
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: decoded.userId });
        if (!user) return next(new Error('invalid_user'));
        socket.user = user;
        return next();
    } catch (e) {
        return next(new Error('invalid_token'));
    }
});

io.on('connection', (socket) => {
    // Entrar em uma conversa/sala
    socket.on('chat:join', ({ conversationId }) => {
        if (!conversationId) return;
        socket.join(String(conversationId));
        const history = chatStore.messages[String(conversationId)] || [];
        socket.emit('chat:history', { conversationId, messages: history });
    });

    // Indicador de digitação
    socket.on('chat:typing', ({ conversationId }) => {
        if (!conversationId) return;
        socket.to(String(conversationId)).emit('chat:typing', { conversationId, from: socket.user.name || socket.user.email });
    });

    // Nova mensagem
    socket.on('chat:message', ({ conversationId, text }) => {
        if (!conversationId || !text) return;
        const msg = {
            id: Date.now(),
            senderId: socket.user._id,
            senderName: socket.user.name || socket.user.email,
            text: String(text),
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            status: 'delivered'
        };
        chatStore.messages[String(conversationId)] = chatStore.messages[String(conversationId)] || [];
        chatStore.messages[String(conversationId)].push(msg);
        io.to(String(conversationId)).emit('chat:message', { conversationId, message: msg });
    });
});

// Iniciar servidor
server.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});