# Grupo Q-Max — Ultra

Nova landing page completa em Next.js + TypeScript + Framer Motion.

## Rodar no Windows / PowerShell

```powershell
npm.cmd install
npm.cmd run dev
```

Abra http://localhost:3000

## O que já vem pronto

- Header sticky com mega menu para Empresas e Produtos
- Hero premium com a marca oficial enviada
- Missão, visão e valores com layout editorial e muito espaço
- Ecossistema interativo com as 5 empresas
- Showcase interativo para QXBACK, QXSIGN e FINORA
- CTA e contatos oficiais
- Responsividade para notebook, tablet e mobile

## Branding

Foram usados apenas os logos enviados nesta conversa. Auditoria, Lagerhaus, QXSIGN e FINORA ficam em tratamento tipográfico até você enviar os logos oficiais.

## Login do CRM (Microsoft Entra ID)

O `/crm` só aceita login com conta Microsoft do tenant da empresa e dos domínios em `MICROSOFT_ALLOWED_DOMAINS`.

- O navegador faz Authorization Code + PKCE com `@azure/msal-browser` (popup) e envia **só o `id_token`** para `POST /api/auth/microsoft`.
- O servidor valida assinatura (JWKS do tenant), `iss`, `aud`, `exp`, `tid` e idade do token (máx. 10 min). Depois aplica a lista de domínios e emite a sessão em cookie `HttpOnly; SameSite=Lax` (`Secure` em produção).
- Nenhum dado de identidade enviado pelo cliente é usado.
- O membro é identificado por `microsoftTid + microsoftOid`. No primeiro login ele é vinculado pelo e-mail ao membro que o admin cadastrou ou convidou. Se esse membro não existir, é criado no grupo de acesso padrão, oculto no site.
- Membro bloqueado (`/crm/access` > Bloquear) não entra e não tem permissões.
- Toda tentativa de login fica na tabela `AuthLog` (sem tokens).

### 1. App Registration (feito por um admin do Entra ID)

1. portal.azure.com > **Microsoft Entra ID > App registrations > New registration**.
2. **Supported account types:** *Accounts in this organizational directory only* (single tenant).
3. **Redirect URI:** plataforma **Single-page application (SPA)**. Cadastre as duas URIs exatas:
   - `https://qmaxbrasil.com.br/auth/microsoft/callback`
   - `http://localhost:3000/auth/microsoft/callback`
4. Em **Authentication**, deixe **desmarcados** "Access tokens" e "ID tokens" em *Implicit grant and hybrid flows*.
5. Em **API permissions**, adicione as permissões delegadas `openid`, `profile`, `email` e `User.Read` (Microsoft Graph). Depois clique em *Grant admin consent*.
6. Opcional: em **Enterprise applications** > o app > *Properties*, ligue **Assignment required = Yes** para restringir o acesso a um grupo do Entra ID.
7. Copie o **Directory (tenant) ID** e o **Application (client) ID** da página *Overview*.

O app não precisa de client secret: o fluxo SPA com PKCE não usa segredo.

### 2. Variáveis de ambiente

| Variável | Valor |
|---|---|
| `MICROSOFT_TENANT_ID` | Directory (tenant) ID, GUID. `common` e `organizations` são recusados. |
| `MICROSOFT_CLIENT_ID` | Application (client) ID, GUID |
| `MICROSOFT_ALLOWED_DOMAINS` | Domínios separados por vírgula, ex.: `grupoqmax.com.br` |
| `AUTH_SECRET` | String aleatória longa que assina o cookie de sessão |

- **Em produção:** configure em **App Service > Configurações > Variáveis de ambiente**. Os IDs são lidos em tempo de execução, então não é preciso refazer o build.
- **Em dev:** use `.env.development.local`.

Sem essas variáveis, o site continua funcionando, mas `/login` mostra "não configurado" e o log do servidor registra `[auth] CRM sign-in with Microsoft is DISABLED`.

### Testes

```bash
npm test
```

- Os testes do `id_token` usam um par de chaves local no lugar do JWKS da Microsoft.
- Os testes de vínculo e criação de membro usam o banco local (`.env.development.local`) e são pulados se a `DATABASE_URL` não for `localhost`.
