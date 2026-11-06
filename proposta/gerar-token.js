const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
// Precisa bater com um redirect URI do app "Sites oAuth 2" no Entra (cadastrado: http://localhost:3000/callback.php)
const port = 3000;

const CLIENT_ID = process.env.OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET;
const TENANT_ID = process.env.OAUTH_TENANT_ID;
const REDIRECT_URI = `http://localhost:${port}/callback.php`;

const SCOPES = "offline_access https://outlook.office.com/SMTP.Send";

app.get('/login', (req, res) => {
    const authUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`
        + `?client_id=${CLIENT_ID}`
        + `&response_type=code`
        + `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`
        + `&response_mode=query`
        + `&scope=${encodeURIComponent(SCOPES)}`;
    
    res.redirect(authUrl);
});

app.get('/callback.php', async (req, res) => {
    const code = req.query.code;
    
    if (!code) {
        return res.send("Erro: Nenhum código de autorização retornado pela Microsoft.");
    }

    try {
        const params = new URLSearchParams();
        params.append('client_id', CLIENT_ID);
        params.append('client_secret', CLIENT_SECRET);
        params.append('code', code);
        params.append('redirect_uri', REDIRECT_URI);
        params.append('grant_type', 'authorization_code');

        const response = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
            method: 'POST',
            body: params,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(JSON.stringify(errData));
        }

        const data = await response.json();
        const refreshToken = data.refresh_token;

        console.log("\n=======================================================");
        console.log("✅ AUTENTICAÇÃO CONCLUÍDA COM SUCESSO!");
        console.log("=======================================================\n");
        console.log("COPIE O TOKEN ABAIXO E COLE NO SEU ARQUIVO .env NA VARIÁVEL 'OAUTH_REFRESH_TOKEN':\n");
        console.log(refreshToken);
        console.log("\n=======================================================");
        console.log("Depois de salvar o .env, reinicie o seu servidor principal (node server.js).");

        res.send(`
            <h1 style="font-family: sans-serif; color: #10b981;">Autenticação Concluída!</h1>
            <p style="font-family: sans-serif;">Pode fechar esta janela. Olhe no terminal do seu editor de código para ver o seu novo Refresh Token.</p>
        `);
        
        setTimeout(() => process.exit(0), 5000);
    } catch (error) {
        console.error("Erro ao gerar token:", error.message);
        res.send("Erro ao tentar obter o token da Microsoft. Veja o terminal.");
    }
});

app.listen(port, () => {
    console.log(`
=======================================================
🚀 SERVIDOR DE AUTENTICAÇÃO MICROSOFT INICIADO
=======================================================
Passo 1: Abra o link abaixo no seu navegador:
👉 http://localhost:${port}/login

Passo 2: Faça login na sua conta Microsoft corporativa
Passo 3: Autorize o aplicativo
Passo 4: Copie o Refresh Token gerado aqui no terminal!
    `);
});
