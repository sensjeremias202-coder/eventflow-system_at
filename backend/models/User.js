const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const useMemory = !process.env.MONGODB_URI || String(process.env.NO_DB).toLowerCase() === 'true';

if (useMemory) {
    const users = [];

    class User {
        constructor(obj = {}) {
            this._id = obj._id || crypto.randomBytes(12).toString('hex');
            this.name = obj.name;
            this.email = String(obj.email || '').toLowerCase().trim();
            this.password = obj.password; // será hash em save()
            this.role = obj.role || 'participante';
            this.phone = obj.phone || '';
            this.position = obj.position || '';
            this.department = obj.department || '';
            this.location = obj.location || '';
            this.bio = obj.bio || '';
            this.avatar = obj.avatar || null;
            this.emailNotifications = obj.emailNotifications ?? true;
            this.pushNotifications = obj.pushNotifications ?? true;
            this.eventReminders = obj.eventReminders ?? true;
            this.messageNotifications = obj.messageNotifications ?? true;
            this.twoFactorEnabled = obj.twoFactorEnabled ?? false;
            this.eventsCount = obj.eventsCount ?? 0;
            this.participantsCount = obj.participantsCount ?? 0;
            this.successRate = obj.successRate ?? 0;
            this.resetPasswordToken = obj.resetPasswordToken || null;
            this.resetPasswordExpires = obj.resetPasswordExpires || null;
            this.createdAt = obj.createdAt || new Date();
            this.updatedAt = obj.updatedAt || new Date();
        }

        async save() {
            // hash de senha se for texto puro
            if (this.password && !String(this.password).startsWith('$2')) {
                const salt = await bcrypt.genSalt(10);
                this.password = await bcrypt.hash(String(this.password), salt);
            }
            this.updatedAt = new Date();
            const idx = users.findIndex(u => String(u._id) === String(this._id));
            if (idx >= 0) users[idx] = { ...users[idx], ...this };
            else users.push({ ...this });
            return this;
        }

        async comparePassword(candidatePassword) {
            return bcrypt.compare(String(candidatePassword), String(this.password));
        }

        generatePasswordReset() {
            const rawToken = crypto.randomBytes(32).toString('hex');
            const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
            this.resetPasswordToken = hashed;
            this.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
            return rawToken;
        }

        static async findOne(query) {
            if (!query || !Object.keys(query).length) return users[0] || null;
            if (query.email) {
                const email = String(query.email).toLowerCase().trim();
                return users.find(u => u.email === email) || null;
            }
            return users[0] || null;
        }

        static async findById(id) {
            return users.find(u => String(u._id) === String(id)) || null;
        }
    }

    module.exports = User;
    return;
}

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    role: {
        type: String,
        enum: ['administrador', 'organizador', 'participante'],
        default: 'participante'
    },
    phone: {
        type: String,
        trim: true
    },
    position: {
        type: String,
        trim: true
    },
    department: {
        type: String,
        trim: true
    },
    location: {
        type: String,
        trim: true
    },
    bio: {
        type: String,
        trim: true
    },
    avatar: {
        type: String,
        default: null
    },
    emailNotifications: {
        type: Boolean,
        default: true
    },
    pushNotifications: {
        type: Boolean,
        default: true
    },
    eventReminders: {
        type: Boolean,
        default: true
    },
    messageNotifications: {
        type: Boolean,
        default: true
    },
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    eventsCount: {
        type: Number,
        default: 0
    },
    participantsCount: {
        type: Number,
        default: 0
    },
    successRate: {
        type: Number,
        default: 0
    },
    // Recuperação de senha
    resetPasswordToken: {
        type: String,
        default: null
    },
    resetPasswordExpires: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Hash da senha antes de salvar
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Método para comparar senhas
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Gera token de recuperação de senha (retorna token em texto puro)
userSchema.methods.generatePasswordReset = function() {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
    this.resetPasswordToken = hashed;
    // expira em 1 hora
    this.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
    return rawToken;
};

// Atualizar updatedAt antes de salvar
userSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('User', userSchema);