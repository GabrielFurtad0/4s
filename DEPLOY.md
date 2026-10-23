# Guia Oficial de Deploy em Produção — Total Trigo (4S ERP)

Este guia contém o passo a passo direto ao ponto para colocar o **Total Trigo (4S ERP)** no ar com segurança, banco de dados **PostgreSQL na nuvem**, **Login Oficial com Google (Gmail SSO)**, **Backend Java 21 (Cloud Run / Railway)** e **Frontend PWA (Vercel)** pronto para instalar na tela inicial do celular do **Sr. Sérgio**.

---

## Parte 1: Como funciona a Segurança, Senhas e Login com Google (Gmail SSO)

### 1.1. Regra de Whitelist Fechada (Zero Acesso para Desconhecidos)
O sistema **não permite cadastro aberto**. Ninguém de fora consegue entrar apenas clicando em *"Entrar com Google"* com uma conta Gmail qualquer.

O fluxo de segurança funciona em **Whitelist Estrita**:
1. Primeiro, o **Gabriel (Administrador)** entra no **Backoffice Web** e acessa o menu **"Usuários & Logins (SSO)"**.
2. Nessa tela, o Gabriel cadastra o **e-mail (@gmail.com ou corporativo)** autorizado, define uma senha inicial (caso a pessoa queira entrar com e-mail/senha) e escolhe o **Perfil de Acesso (Role)**:
   - **`ADMIN` — Tudo (Backoffice + Mobile):** Acesso completo à Mesa de Pré-Nota, Faturamento NF-e, Estoque/Importação, Clientes, Catálogo, Gestão de Acessos e também ao App Mobile.
   - **`VENDEDOR` — Somente Mobile (Sr. Sérgio):** Acesso **exclusivo ao App Mobile de Rua (`/app`)**. Se o Sr. Sérgio (ou qualquer vendedor externo) tentar acessar o Backoffice Web (`/`), o sistema bloqueia e redireciona automaticamente para a visão de celular, protegendo custos de importação, margens líquidas e configurações fiscais.
3. Quando o usuário clica em **"Entrar com Google (Gmail)"**, o Google valida a identidade criptograficamente e o ERP verifica:
   - O e-mail está cadastrado na lista de usuários?
   - O status do usuário está **Ativo**?
   - Se **SIM**, o login é liberado direto na tela permitida pelo perfil dele. Se **NÃO**, o acesso é negado imediatamente.

---

### 1.2. Credenciais Iniciais de Fábrica (Pré-cadastradas)
Para o seu primeiro acesso assim que o sistema subir, já vêm pré-configurados de fábrica dois acessos iniciais (que você pode alterar ou trocar o e-mail na tela **"Usuários & Logins (SSO)"**):

| Usuário | E-mail de Acesso | Senha Inicial | Perfil de Acesso |
| :--- | :--- | :--- | :--- |
| **Gabriel (Gestão / TI)** | `gabriel@totaltrigo.com.br` | `TotalTrigo@2026` | **Tudo (Backoffice + Mobile)** |
| **Sr. Sérgio (Comercial Rua)** | `sergio@totaltrigo.com.br` | `Sergio@2026` | **Somente Mobile (App de Rua)** |

> **Dica:** Assim que entrar como Gabriel, vá em **Usuários & Logins (SSO)** e atualize o e-mail do Gabriel e o e-mail do Sr. Sérgio para os endereços `@gmail.com` reais que vocês usam no celular/computador. A partir daí, basta tocar no botão **"Entrar com Google"** sem precisar digitar senha!

---

### 1.3. Passo a Passo de 2 Minutos: Criando o `GOOGLE_CLIENT_ID` no Google Cloud Console
Para ativar o botão oficial **"Entrar com Google"**:

1. Acesse o [Google Cloud Console — Credenciais](https://console.cloud.google.com/apis/credentials).
2. Crie um projeto (ex: `TotalTrigo-ERP`) ou selecione um projeto existente.
3. No menu lateral, clique em **Tela de permissão OAuth (OAuth consent screen)**:
   - Escolha **Externo (External)** e clique em **Criar**.
   - Preencha **Nome do App**: `Total Trigo 4S ERP`, seu e-mail de suporte e clique em **Salvar e Continuar** até concluir (e clique em *Publicar Aplicativo / Publish App* para não expirar tokens de teste).
4. Volte em **Credenciais (Credentials)** > clique em **`+ CRIAR CREDENCIAIS`** no topo > escolha **ID do cliente OAuth (OAuth client ID)**:
   - **Tipo de aplicativo:** `Aplicativo da Web (Web application)`
   - **Nome:** `Total Trigo Web & PWA`
   - **Origens JavaScript autorizadas (Authorized JavaScript origins):** Adicione as URLs onde seu site vai rodar (sem barra no final):
     - `http://localhost:5173` (para testes locais)
     - `https://seu-dominio-na-vercel.vercel.app` (URL de produção da Vercel)
5. Clique em **Criar** e copie o código gerado (**ID do cliente**, que termina com `.apps.googleusercontent.com`).
   - Você usará esse mesmo código em `GOOGLE_CLIENT_ID` (no Backend) e `VITE_GOOGLE_CLIENT_ID` (na Vercel).

---

## Parte 2: Banco de Dados PostgreSQL Gratuito na Nuvem (Neon.tech ou Supabase)

Para que os pedidos do Sr. Sérgio, o estoque e os cadastros fiquem salvos de forma permanente na nuvem (24/7), usaremos o **Neon.tech** (Serverless PostgreSQL com plano gratuito vitalício e servidores em São Paulo/AWS).

1. Acesse [https://neon.tech](https://neon.tech) e crie uma conta gratuita (pode entrar com sua conta Google/GitHub).
2. Clique em **Create Project**:
   - **Project Name:** `totaltrigo-prod`
   - **Region:** Escolha `AWS South America (São Paulo) — sa-east-1` (para resposta instantânea no Brasil).
3. Na tela inicial do projeto criado (**Dashboard**), localize a caixa **Connection Details**:
   - No seletor de linguagem/framework (onde aparece *Connection string* ou *psql*), mude para **`Java` (JDBC)**.
   - Você verá os 3 dados que precisa copiar para o Backend:
     - **`SPRING_DATASOURCE_URL`**:
       ```text
       jdbc:postgresql://ep-xxxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require
       ```
     - **`SPRING_DATASOURCE_USERNAME`**: `neondb_owner` (ou o usuário exibido)
     - **`SPRING_DATASOURCE_PASSWORD`**: `sua_senha_gerada_pelo_neon`

> **Atenção:** O Flyway já está configurado no `application-prod.yml`. Na primeira vez que o Backend Java conectar no Neon.tech, ele criará automaticamente todas as tabelas (`products`, `clients`, `orders`, `users`, etc.) e a carga inicial da Total Trigo!

---

## Parte 3: Subindo o Backend Java 21 (No Google Cloud Run ou Railway)

O arquivo `backend/Dockerfile` já está otimizado em multi-stage (`Maven + Eclipse Temurin 21 Alpine`). Você pode subir no **Google Cloud Run** (São Paulo) ou no **Railway / Render** em 2 cliques.

### Opção A: Deploy no Google Cloud Run (Região São Paulo `southamerica-east1`)
Se você tem o [Google Cloud SDK (`gcloud`)](https://cloud.google.com/sdk/docs/install) instalado, abra o terminal na raiz do projeto `TotalTrigo` e rode o comando abaixo substituindo os valores do seu banco Neon e Client ID:

```bash
gcloud run deploy totaltrigo-api \
  --source ./backend \
  --region southamerica-east1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8085 \
  --memory 512Mi \
  --set-env-vars="SPRING_PROFILES_ACTIVE=prod" \
  --set-env-vars="SPRING_DATASOURCE_URL=jdbc:postgresql://SEU_HOST_NEON/neondb?sslmode=require" \
  --set-env-vars="SPRING_DATASOURCE_USERNAME=neondb_owner" \
  --set-env-vars="SPRING_DATASOURCE_PASSWORD=SUA_SENHA_NEON" \
  --set-env-vars="GOOGLE_CLIENT_ID=SEU_ID.apps.googleusercontent.com" \
  --set-env-vars="CORS_ALLOWED_ORIGINS=*"
```

Ao finalizar (leva ~2 minutos), o terminal exibirá a URL pública da sua API:
`Service URL: https://totaltrigo-api-xxxxxx-rj.a.run.app`

---

### Opção B: Alternativa em 2 Cliques pelo Railway.app ou Render.com (Via GitHub)
1. Suba este repositório para o seu **GitHub** (privado).
2. Acesse [Railway.app](https://railway.app) ou [Render.com](https://render.com) -> **New Project** -> **Deploy from GitHub repo**.
3. Nas configurações do serviço (**Settings**):
   - Defina o **Root Directory** como: `backend` (ele detectará o `backend/Dockerfile` automaticamente).
4. Na aba **Variables (Environment Variables)**, adicione as variáveis listadas em `backend/.env.example`:
   - `SPRING_PROFILES_ACTIVE` = `prod`
   - `SPRING_DATASOURCE_URL` = `jdbc:postgresql://...`
   - `SPRING_DATASOURCE_USERNAME` = `neondb_owner`
   - `SPRING_DATASOURCE_PASSWORD` = `sua_senha`
   - `GOOGLE_CLIENT_ID` = `seu-client-id.apps.googleusercontent.com`
   - `CORS_ALLOWED_ORIGINS` = `*` (ou o domínio da Vercel)
5. Gere o domínio público em **Settings > Networking > Generate Domain** e copie a URL gerada.

---

## Parte 4: Subindo o Frontend na Vercel + Instalando o App no Celular do Sr. Sérgio (PWA)

### 4.1. Publicando o Frontend na Vercel
1. Acesse [https://vercel.com](https://vercel.com) e clique em **Add New... > Project**.
2. Importe o repositório `TotalTrigo` do seu GitHub.
3. Na tela de configuração do projeto:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Clique em *Edit* e selecione a pasta **`frontend`**.
4. Abra a seção **Environment Variables** e adicione as 2 variáveis (conforme `frontend/.env.example`):
   - **`VITE_API_URL`** = `https://totaltrigo-api-xxxxxx-rj.a.run.app/api` *(atenção: coloque `/api` no final e sem barra extra depois de `/api`)*
   - **`VITE_GOOGLE_CLIENT_ID`** = `123456789-xxx.apps.googleusercontent.com`
5. Clique em **Deploy**. Em menos de 1 minuto seu sistema estará no ar (ex: `https://totaltrigo-erp.vercel.app`).
   - *Lembrete:* Adicione esse endereço `https://totaltrigo-erp.vercel.app` lá nas **Origens JavaScript autorizadas** do Google Cloud Console (Parte 1.3) para o login com Gmail funcionar em produção!

---

### 4.2. Instalando o Ícone do App na Tela Inicial do Celular do Sr. Sérgio (PWA)
O sistema conta com suporte nativo a **PWA (Progressive Web App)** e redirecionamento automático por perfil (quando o Sr. Sérgio faz login, ele cai direto no aplicativo mobile de vendas externas `/app`).

Para deixar o aplicativo com ícone exclusivo na tela inicial do celular do Sr. Sérgio (igual a um aplicativo baixado da loja, em tela cheia e sem barra de endereço do navegador):

#### No Android (Samsung / Motorola / Xiaomi — Google Chrome):
1. No celular do Sr. Sérgio, abra o **Google Chrome** e acesse o link da Vercel (ex: `https://totaltrigo-erp.vercel.app`).
2. Faça o login com a conta Google do Sr. Sérgio (ou com o e-mail e senha dele).
3. Toque nos **3 pontinhos (`⋮`)** no canto superior direito do Chrome.
4. Toque em **"Adicionar à tela inicial"** (ou **"Instalar aplicativo"**).
5. Confirme clicando em **Adicionar / Instalar**. Pronto! O ícone **Total Trigo** aparecerá na tela principal do celular dele.

#### No iPhone (iOS — Safari):
1. No iPhone do Sr. Sérgio, abra o navegador **Safari** e acesse o link da Vercel.
2. Toque no botão **Compartilhar** (ícone do quadradinho com uma seta para cima na barra inferior).
3. Role a lista para baixo e toque em **"Adicionar à Tela de Início"** (*Add to Home Screen*).
4. Toque em **Adicionar** no canto superior direito. O ícone **Total Trigo** ficará salvo direto na tela de início do iPhone!
