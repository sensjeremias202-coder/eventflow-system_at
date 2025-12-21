# Eventflow Backend Dockerfile
FROM node:18-alpine

WORKDIR /app

# Instalar dependências
COPY package*.json ./
RUN npm ci --only=production

# Copiar código
COPY . ./

# Expor porta
EXPOSE 5000

# Comando de inicialização
CMD ["node", "server.js"]
