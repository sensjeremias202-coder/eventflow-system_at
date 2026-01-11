const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { sendMail } = require('../config/mailer');
const { OAuth2Client } = require('google-auth-library');
const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || '';
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;

// Registro de usuário
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        
        // Verifica se usuário já existe
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }
        
        // Cria novo usuário
        const user = new User({
            name,
            email,
            password,
            role: role || 'participante'
        });
        
        // Verificação por email removida: conta ativa imediatamente
        user.isVerified = true;
        await user.save();
        res.status(201).json({ message: 'Usuário criado com sucesso.' });
    } catch (error) {
        console.error('Erro no registro:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Login de usuário
router.post('/login', async (req, res) => {
    try {
        const { email, password, totp } = req.body;
        
        // Encontra usuário
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Email ou senha incorretos' });
        }
        
        // Verifica senha
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Email ou senha incorretos' });
        }
        
        // TOTP desativado: login não requer 2FA

        // Gera token JWT
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            message: 'Login realizado com sucesso',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                eventsCount: user.eventsCount,
                participantsCount: user.participantsCount,
                successRate: user.successRate,
                isVerified: true
            },
            token
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Obter perfil do usuário (requer autenticação)
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        res.json({
            user: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role,
                phone: req.user.phone,
                position: req.user.position,
                department: req.user.department,
                location: req.user.location,
                bio: req.user.bio,
                avatar: req.user.avatar,
                isVerified: req.user.isVerified === true,
                emailNotifications: req.user.emailNotifications,
                pushNotifications: req.user.pushNotifications,
                eventReminders: req.user.eventReminders,
                messageNotifications: req.user.messageNotifications,
                twoFactorEnabled: req.user.twoFactorEnabled,
                eventsCount: req.user.eventsCount,
                participantsCount: req.user.participantsCount,
                successRate: req.user.successRate
            }
        });
    } catch (error) {
        console.error('Erro ao obter perfil:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Atualizar perfil do usuário
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const updates = req.body;
        
        // Remove campos que não podem ser atualizados
        delete updates.password;
        delete updates.email;
        delete updates._id;
        delete updates.createdAt;
        
        // Atualiza usuário
        Object.keys(updates).forEach(key => {
            req.user[key] = updates[key];
        });
        
        await req.user.save();
        
        res.json({
            message: 'Perfil atualizado com sucesso',
            user: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role,
                phone: req.user.phone,
                position: req.user.position,
                department: req.user.department,
                location: req.user.location,
                bio: req.user.bio,
                avatar: req.user.avatar
            }
        });
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Alterar senha
router.put('/change-password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        // Verifica senha atual
        const isPasswordValid = await req.user.comparePassword(currentPassword);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Senha atual incorreta' });
        }
        
        // Atualiza senha
        req.user.password = newPassword;
        await req.user.save();
        
        res.json({ message: 'Senha alterada com sucesso' });
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Logout (no JWT, logout é feito no frontend apenas removendo o token)
router.post('/logout', authMiddleware, async (req, res) => {
    try {
        // Em um sistema mais complexo, você poderia invalidar o token aqui
        res.json({ message: 'Logout realizado com sucesso' });
    } catch (error) {
        console.error('Erro no logout:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;

// Login com Google via ID Token
router.post('/google-login', async (req, res) => {
    try {
        const { idToken } = req.body || {};
        if (!idToken) return res.status(400).json({ error: 'idToken é obrigatório' });
        if (!googleClient) return res.status(500).json({ error: 'GOOGLE_CLIENT_ID não configurado no backend' });

        const ticket = await googleClient.verifyIdToken({ idToken, audience: googleClientId });
        const payload = ticket.getPayload();
        const email = payload && payload.email ? payload.email : null;
        const name = payload && payload.name ? payload.name : 'Usuário Google';
        const avatar = payload && payload.picture ? payload.picture : null;
        if (!email) return res.status(400).json({ error: 'Não foi possível obter email da conta Google' });

        let user = await User.findOne({ email });
        if (!user) {
            user = new User({ name, email, password: crypto.randomBytes(16).toString('hex'), role: 'participante', avatar, isVerified: true });
            await user.save();
        } else {
            if (!user.isVerified) { user.isVerified = true; await user.save(); }
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        return res.json({
            message: 'Login Google realizado com sucesso',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                isVerified: true
            },
            token
        });
    } catch (error) {
        console.error('Erro em google-login:', error);
        res.status(500).json({ error: 'Falha na autenticação Google' });
    }
});

// Recuperação de senha: solicitar token
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email é obrigatório' });

        const user = await User.findOne({ email });
        // Sempre retornar 200 para não revelar se o email existe
        if (!user) {
            return res.json({ message: 'Se o email existir, enviaremos instruções em breve' });
        }

        // Gera e salva token de reset
        const rawToken = user.generatePasswordReset();
        await user.save();

        const frontendUrl = process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || 'http://127.0.0.1:5500';
        const resetLink = `${frontendUrl}/forgot-password.html?token=${rawToken}`;

        const html = `
            <p>Olá, ${user.name || 'usuário'}</p>
            <p>Recebemos uma solicitação para redefinir sua senha. Utilize o link abaixo:</p>
            <p><a href="${resetLink}" target="_blank">Redefinir senha</a></p>
            <p>Ou copie este token no formulário de redefinição:</p>
            <pre style="padding:12px;border:1px solid #ddd;border-radius:6px;background:#f7f7f7;">${rawToken}</pre>
            <p>Este token expira em 1 hora.</p>
            <p>Se você não solicitou, ignore este email.</p>
        `;

        await sendMail({ to: email, subject: 'Eventflow - Redefinição de senha', html });

        return res.json({ message: 'Se o email existir, enviaremos instruções em breve' });
    } catch (error) {
        console.error('Erro em forgot-password:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Recuperação de senha: redefinir com token
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
        }
        if (String(newPassword).length < 6) {
            return res.status(400).json({ error: 'A nova senha deve ter ao menos 6 caracteres' });
        }

        const hashed = crypto.createHash('sha256').update(token).digest('hex');
        const now = Date.now();
        const user = await User.findOne({
            resetPasswordToken: hashed,
            resetPasswordExpires: { $gt: now }
        });

        if (!user) {
            return res.status(400).json({ error: 'Token inválido ou expirado' });
        }

        user.password = newPassword;
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();

        return res.json({ message: 'Senha redefinida com sucesso' });
    } catch (error) {
        console.error('Erro em reset-password:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Testar envio de e-mail SMTP
router.post('/test-email', async (req, res) => {
    try {
        const { to } = req.body || {};
        if (!to) return res.status(400).json({ error: 'Destinatário (to) é obrigatório' });
        const html = `
            <p>Teste de envio SMTP do Eventflow.</p>
            <p>Se você está lendo isto, o SMTP está funcionando.</p>
        `;
        try {
            const r = await sendMail({ to, subject: 'Eventflow - Teste SMTP', html });
            return res.json({ message: 'Email enviado', info: r && r.messageId ? { messageId: r.messageId } : {} });
        } catch (e) {
            console.error('Erro ao enviar email de teste:', e && e.message ? e.message : e);
            return res.status(500).json({ error: 'Falha ao enviar email', details: e && e.message ? e.message : String(e) });
        }
    } catch (error) {
        console.error('Erro em test-email:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

 