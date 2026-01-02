const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { sendMail } = require('../config/mailer');
const crypto = require('crypto');

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
        
        await user.save();
        
        // Gera token JWT
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.status(201).json({
            message: 'Usuário criado com sucesso',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            },
            token
        });
    } catch (error) {
        console.error('Erro no registro:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Login de usuário
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
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
                isVerified: user.isVerified === true
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

        const frontendUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5500';
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

// Solicitar verificação (email/telefone)
router.post('/request-verification', authMiddleware, async (req, res) => {
    try {
        const method = (req.body.method || 'email').toLowerCase();
        if (!['email','phone'].includes(method)) return res.status(400).json({ error: 'Método inválido' });
        const code = req.user.generateVerificationCode(method);
        await req.user.save();

        if (method === 'email') {
            const html = `
                <p>Olá, ${req.user.name || 'usuário'}</p>
                <p>Seu código de verificação é:</p>
                <h2 style="letter-spacing:4px">${code}</h2>
                <p>Este código expira em 10 minutos.</p>
            `;
            await sendMail({ to: req.user.email, subject: 'Eventflow - Verificação de conta', html });
        } else {
            // Para telefone/SMS, integrar provedor (ex.: Twilio). Aqui apenas simulamos sucesso.
        }

        res.json({ message: 'Código de verificação enviado' });
    } catch (error) {
        console.error('Erro em request-verification:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Confirmar verificação
router.post('/verify', authMiddleware, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Código é obrigatório' });
        const hashed = crypto.createHash('sha256').update(String(code)).digest('hex');
        if (!req.user.verificationCodeHash || req.user.verificationCodeHash !== hashed) {
            return res.status(400).json({ error: 'Código inválido' });
        }
        if (req.user.verificationExpires && Date.now() > req.user.verificationExpires) {
            return res.status(400).json({ error: 'Código expirado' });
        }
        req.user.isVerified = true;
        req.user.verificationCodeHash = null;
        req.user.verificationExpires = null;
        await req.user.save();
        res.json({ message: 'Conta verificada com sucesso' });
    } catch (error) {
        console.error('Erro em verify:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});