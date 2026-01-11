require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const eventsRoutes = require('./routes/events');
const usersRoutes = require('./routes/users');
const chatRoutes = require('./routes/chat');
const verifiedMiddleware = require('./middleware/verifiedMiddleware');
const User = require('./models/User');
const ChatMessage = require('./models/ChatMessage');
const Conversation = require('./models/Conversation');
const presence = require('./services/presence');
const socialRoutes = require('./routes/social');
const webhooksRoutes = require('./routes/webhooks');

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
app.use('/api/events', verifiedMiddleware, eventsRoutes);
app.use('/api/users', verifiedMiddleware, usersRoutes);
app.use('/api/chat', verifiedMiddleware, chatRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/webhooks', webhooksRoutes);
// Social rotas (adicionadas abaixo)

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

// Tornar io acessível nas rotas Express
app.set('io', io);

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
        presence.markOnline(user._id);
        return next();
    } catch (e) {
        return next(new Error('invalid_token'));
    }
});

io.on('connection', (socket) => {
    // Broadcast presença inicial
    io.emit('presence:update', { userId: String(socket.user._id), online: true, lastSeen: null });

    // Sala específica do usuário para notificações pessoais (ex.: eventos criados)
    try { socket.join(`user:${String(socket.user._id)}`); } catch (_) {}

    // Auto-join: ao conectar, entrar em todas as conversas do usuário
    (async () => {
        try {
            const me = String(socket.user._id);
                const myConversations = await Conversation.find({ participants: me });
            (myConversations || []).forEach(c => {
                const roomId = String(c._id || '');
                if (roomId) socket.join(roomId);
            });
            // Enviar convites pendentes ao conectar
            try {
                if (typeof Conversation.findInvitesFor === 'function') {
                    const invites = await Conversation.findInvitesFor(me);
                    (invites || []).forEach(c => {
                        socket.emit('conversation:invite', { conversation: { _id: String(c._id || ''), name: c.title || 'Conversa', isGroup: c.type === 'group' } });
                    });
                }
            } catch (_) {}
        } catch (e) {
            // Ignorar erros silenciosamente para não interromper conexão
        }
    })();

    // Entrar em uma conversa/sala
    socket.on('chat:join', ({ conversationId }) => {
        if (!conversationId) return;
        socket.join(String(conversationId));
        // Histórico persistente (fallback memória)
        (async () => {
            let history = [];
            try {
                history = await ChatMessage.find({ conversationId, page: 1, limit: 100 });
            } catch (e) {
                history = chatStore.messages[String(conversationId)] || [];
            }
            socket.emit('chat:history', { conversationId, messages: history });
        })();
    });

    // Indicador de digitação
    socket.on('chat:typing', ({ conversationId }) => {
        if (!conversationId) return;
        socket.to(String(conversationId)).emit('chat:typing', { conversationId, from: socket.user.name || socket.user.email });
    });

    // Nova mensagem
    socket.on('chat:message', ({ conversationId, text, clientId }) => {
        if (!conversationId || !text) return;
        const msg = {
            id: Date.now(),
            senderId: socket.user._id,
            senderName: socket.user.name || socket.user.email,
            text: String(text),
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            status: 'delivered',
            clientId: clientId || null
        };
        chatStore.messages[String(conversationId)] = chatStore.messages[String(conversationId)] || [];
        chatStore.messages[String(conversationId)].push(msg);
        // Persistência
        const cm = new ChatMessage({
            conversationId: String(conversationId),
            senderId: String(socket.user._id),
            senderName: msg.senderName,
            text: msg.text,
            time: msg.time,
            status: msg.status
        });
        cm.save().catch(()=>{});
        // Eco imediato para o remetente, e broadcast para os demais na sala
        socket.emit('chat:message', { conversationId, message: msg });
        socket.to(String(conversationId)).emit('chat:message', { conversationId, message: msg });
    });

    // Marcar mensagens como lidas (read receipts)
    socket.on('chat:markRead', async ({ conversationId }) => {
        if (!conversationId) return;
        const roomId = String(conversationId);
        const readerId = String(socket.user._id);
        // Atualiza memória
        try {
            const arr = chatStore.messages[roomId] || [];
            arr.forEach(m => { if (String(m.senderId) !== readerId) m.status = 'read'; });
        } catch (_) {}
        // Atualiza persistência (MongoDB)
        try {
            if (typeof ChatMessage.updateMany === 'function') {
                await ChatMessage.updateMany(
                    { conversationId: roomId, senderId: { $ne: readerId }, status: { $ne: 'read' } },
                    { $set: { status: 'read' } }
                );
            }
        } catch (_) {}
        // Notifica sala
        io.to(roomId).emit('chat:read', { conversationId: roomId, userId: readerId, at: Date.now() });
    });

    // Histórico paginado sob demanda
    socket.on('chat:historyPage', async ({ conversationId, page = 1, limit = 50 }) => {
        try {
            const msgs = await ChatMessage.find({ conversationId, page, limit });
            socket.emit('chat:historyPage', { conversationId, page, messages: msgs });
        } catch (e) {
            const all = chatStore.messages[String(conversationId)] || [];
            const start = (page - 1) * limit;
            const slice = all.slice(start, start + limit);
            socket.emit('chat:historyPage', { conversationId, page, messages: slice });
        }
    });

    // Criar/obter conversa DM
    socket.on('chat:ensureDM', async ({ userId }) => {
        if (!userId) return;
        const me = String(socket.user._id);
        const other = String(userId);
        let conv = null;
        try {
            const existing = await Conversation.findDM(me, other);
            if (existing) conv = existing; else {
                conv = new Conversation({ type: 'dm', participants: [me, other] });
                await conv.save();
            }
        } catch(e) {
            // fallback memória já coberto no findDM/save
        }
        socket.emit('chat:dmReady', { conversationId: conv?._id || `dm:${[me, other].sort().join('-')}` });
    });

    socket.on('disconnect', () => {
        presence.markOffline(socket.user._id);
        io.emit('presence:update', { userId: String(socket.user._id), online: false, lastSeen: presence.getLastSeen(socket.user._id) });
    });
});

// Iniciar servidor
server.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});