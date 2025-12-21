# Eventflow Backend Dockerfile
FROM node:18-alpine

WORKDIR /app

# Instalar dependências
COPY package*.json ./
# Usar npm install para não depender de package-lock.json
RUN npm install --omit=dev

# Copiar código
COPY . ./

# Expor porta
EXPOSE 5000

# Comando de inicialização
CMD ["node", "server.js"]
