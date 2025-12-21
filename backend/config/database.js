const mongoose = require('mongoose');

const connectDB = async () => {
    const uri = process.env.MONGODB_URI;
    try {
        if (!uri) throw new Error('MONGODB_URI não definido');
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ MongoDB conectado com sucesso');
    } catch (error) {
        console.error('❌ Erro ao conectar ao MongoDB:', error.message || error);
        console.warn('⚠️ Continuando sem banco de dados (modo memória).');
        // Não encerra o processo; rotas podem operar em memória se modelos suportarem
    }
};

module.exports = connectDB;