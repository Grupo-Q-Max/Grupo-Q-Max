<?php require_once __DIR__ . '/auth.php'; $pageTitle = $pageTitle ?? 'QMAX Quiz'; $flash = pull_flash(); ?>
<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#071b18"><title><?= e($pageTitle) ?></title>
<link rel="stylesheet" href="<?= e(url('assets/css/style.css')) ?>">
</head><body>
<header class="topbar"><a class="brand" href="<?= e(url()) ?>" aria-label="QMAX Quiz"><span class="brand-q">Q</span><span>MAX</span><small>QUIZ</small></a>
<?php if (user()): ?><nav><a href="<?= e(url()) ?>">Quizzes</a><?php if(user()['role']==='admin'): ?><a href="<?= e(url('admin/')) ?>">Administração</a><?php endif; ?><span class="user-pill"><?= e(user()['name']) ?></span><a class="logout" href="<?= e(url('logout.php')) ?>">Sair</a></nav><?php endif; ?></header>
<main class="shell"><?php if($flash): ?><div class="flash <?= e($flash['type']) ?>"><?= e($flash['message']) ?></div><?php endif; ?>

