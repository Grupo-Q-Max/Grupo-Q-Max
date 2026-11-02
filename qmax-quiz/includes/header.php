<?php
require_once __DIR__ . '/auth.php';
$pageTitle = $pageTitle ?? 'Q-Max Quiz · Conhecimento & Desafios';
$flash = pull_flash();

// Detecta logo em assets/images/
$logoFile = null;
foreach (['logo.svg', 'logo.png', 'logo.webp', 'logo.jpg'] as $file) {
    if (file_exists(dirname(__DIR__) . '/assets/images/' . $file)) {
        $logoFile = url('assets/images/' . $file);
        break;
    }
}
$currentScript = basename($_SERVER['SCRIPT_NAME'] ?? '');
$isAdmin = str_contains($_SERVER['REQUEST_URI'] ?? '', '/admin');
?>
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#06070a">
<title><?= e($pageTitle) ?></title>
<link rel="icon" type="image/png" href="<?= e(url('assets/images/favicon.png')) ?>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= e(url('assets/css/style.css')) ?>">
</head>
<body>
<div class="ambient-aurora" aria-hidden="true"></div>
<header class="topbar">
    <div class="topbar-inner">
        <a class="brand" href="<?= e(url()) ?>" aria-label="Grupo Q-Max">
            <div class="brand-logo-wrap">
                <?php if ($logoFile): ?>
                    <img src="<?= e($logoFile) ?>" alt="Grupo Q-Max" class="brand-logo-img">
                <?php else: ?>
                    <span class="brand-q">Q</span><span class="brand-max">MAX</span>
                <?php endif; ?>
            </div>
            <span class="brand-badge">QUIZ</span>
        </a>

        <?php if (user()): ?>
        <nav class="topbar-nav">
            <a href="<?= e(url()) ?>" class="nav-link <?= (!$isAdmin && $currentScript !== 'quiz.php') ? 'active' : '' ?>">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10M6 10h10"/></svg>
                <span>Quizzes</span>
            </a>
            <?php if (user()['role'] === 'admin'): ?>
                <a href="<?= e(url('admin/')) ?>" class="nav-link <?= $isAdmin ? 'active' : '' ?>">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    <span>Administração</span>
                </a>
            <?php endif; ?>
            <div class="nav-divider"></div>
            <div class="user-pill">
                <span class="user-status-dot"></span>
                <span class="user-name"><?= e(user()['name']) ?></span>
                <?php if (user()['role'] === 'admin'): ?>
                    <span class="role-badge">ADMIN</span>
                <?php endif; ?>
            </div>
            <a class="logout-btn" href="<?= e(url('logout.php')) ?>" title="Encerrar sessão">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                <span>Sair</span>
            </a>
        </nav>
        <?php endif; ?>
    </div>
</header>
<main class="shell">
<?php if ($flash): ?>
    <div class="flash <?= e($flash['type']) ?>">
        <div class="flash-icon"><?= $flash['type'] === 'success' ? '✓' : '⚠' ?></div>
        <div class="flash-text"><?= e($flash['message']) ?></div>
    </div>
<?php endif; ?>
