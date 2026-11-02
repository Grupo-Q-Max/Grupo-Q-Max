# QMAX Quiz

Plataforma interna de quizzes em PHP 8.1+, MySQL, CSS e JavaScript, com autenticação corporativa Microsoft.

## Requisitos

- PHP 8.1 ou superior com extensões PDO MySQL, cURL e OpenSSL
- MySQL 8 ou MariaDB 10.5+
- HTTPS em produção
- Aplicativo registrado no Microsoft Entra ID

## Instalação

1. Envie a pasta para o servidor web.
2. Importe `database.sql` no MySQL.
3. Copie `.env.example` para `.env` e preencha banco, URL e Microsoft.
4. Garanta que o Apache permita `.htaccess` (`AllowOverride All`).
5. Use PHP 8.1+ e abra a URL configurada em `APP_URL`.

## Configuração Microsoft Entra ID

1. Azure Portal → Microsoft Entra ID → Registros de aplicativo → Novo registro.
2. Escolha **Somente contas neste diretório organizacional**.
3. Em Autenticação → Web, adicione exatamente:
   `https://SEU-DOMINIO/quiz/auth/callback.php`
4. Em Certificados e segredos, crie um segredo e copie o **valor** para `MS_CLIENT_SECRET`.
5. Copie os IDs do aplicativo e do diretório para `MS_CLIENT_ID` e `MS_TENANT_ID`.
6. Em Permissões de API, adicione Microsoft Graph → Delegadas → `User.Read`, `openid`, `profile` e `email`.
7. Em `ADMIN_EMAILS`, informe quem terá o painel administrativo.

O endereço de retorno precisa ser idêntico ao produzido por `APP_URL` + `/auth/callback.php`, incluindo HTTPS, caminho e ausência/presença de barra.

## Segurança implementada

- Login vinculado ao objeto real do usuário no Microsoft Entra ID.
- Tenant específico e validação adicional do domínio `@grupoqmax.com.br`.
- Uma tentativa por usuário e por quiz, garantida também no banco.
- OAuth `state`, CSRF, cookies HttpOnly/SameSite, regeneração de sessão e PDO preparado.
- Administração liberada somente aos e-mails definidos no servidor.
- Segredos fora do código, no `.env`, bloqueado pelo `.htaccess`.

## Uso

O primeiro acesso de um e-mail listado em `ADMIN_EMAILS` cria o administrador. No menu Administração, ele pode criar, editar, publicar e encerrar quizzes, ver cada resposta individual e exportar o consolidado em CSV.

