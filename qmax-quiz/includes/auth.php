<?php
require_once __DIR__ . '/bootstrap.php';
function user(): ?array { return $_SESSION['user'] ?? null; }
function require_login(): void { if (!user()) redirect('login.php'); }
function require_admin(): void { require_login(); if ((user()['role'] ?? '') !== 'admin') { http_response_code(403); exit('Acesso restrito.'); } }

