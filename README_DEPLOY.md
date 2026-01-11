# Deploy do Eventflow Backend (Online)

Este guia ensina a publicar o backend online usando Render e MongoDB Atlas.

## Pré-requisitos
- Conta na [Render](https://render.com/)
- Conta no [MongoDB Atlas](https://www.mongodb.com/atlas/database)
- Este repositório com os arquivos: `render.yaml`, `backend/` e `backend/.env.example`

## Passo 1 — Criar cluster no MongoDB Atlas
1. Crie um cluster gratuito.
2. Crie um usuário de banco (usuário/senha).
3. Em Network Access, adicione IP `0.0.0.0/0` para acesso (ou sua faixa segura).
4. Copie a string de conexão `mongodb+srv://usuario:senha@<cluster>/<db>?retryWrites=true&w=majority`.

## Passo 2 — Publicar na Render (Blueprint)
1. Faça login na Render.
2. Acesse "New +" → "Blueprint".
3. Selecione este repositório (GitHub) e confirme.
4. A Render lerá `render.yaml` e criará o serviço `eventflow-backend`.
5. Configure variáveis de ambiente no serviço:
   - `MONGODB_URI`: string do Atlas
   - `JWT_SECRET`: um segredo forte
   - `CORS_ORIGIN`: URLs do frontend separadas por vírgula (ex.: `https://seu-frontend.com,http://127.0.0.1:5500`)
  - `FRONTEND_BASE_URL`: URL pública do frontend (ex.: `https://sensjeremias202-coder.github.io/eventflow-system_at`)
6. Deployará automaticamente; ao finalizar, você terá uma URL pública, ex.: `https://eventflow-backend.onrender.com`.

## Passo 3 — Apontar o frontend
- Defina a URL no `config.js` (antes de `api.js`) ou via `localStorage`:
  ```js
  window.API_BASE_URL = 'https://eventflow-system-at-2.onrender.com';
  // ou
  localStorage.setItem('API_BASE_URL', 'https://eventflow-backend.onrender.com');
  ```

## Passo 4 — Testes rápidos
- Teste saúde:
  ```bash
  curl https://eventflow-system-at-2.onrender.com/
  ```
- Fluxos de login/registro a partir das páginas: `login-firebase.html`, `register-firebase.html`.

### Banners
- Os banners são gerados localmente no frontend via Canvas.
- Não há dependência de automações externas (Zapier/Make/Canva) nem webhooks.

## Alternativas
- Railway, Fly.io, Azure App Service: utilize `backend/Dockerfile` para build e defina as envs.

## Dicas de produção
- Restrinja `CORS_ORIGIN` às origens reais do frontend.
- Troque `JWT_SECRET` regularmente.
- Use logs e monitoramento da plataforma para acompanhar falhas.
