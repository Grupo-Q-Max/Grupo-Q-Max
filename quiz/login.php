<?php
require_once __DIR__ . '/includes/bootstrap.php';
if (!empty($_SESSION['user'])) redirect('index.php');
$pageTitle='Entrar · QMAX Quiz'; require __DIR__.'/includes/header.php';
?>
<section class="login-layout"><div class="login-copy"><div class="eyebrow">EXPERIÊNCIA INTERNA QMAX</div><h1>Conhecimento que conecta o nosso time.</h1><p>Participe dos desafios, descubra o quanto você sabe e acompanhe seus resultados.</p><div class="trust"><span>✓ Acesso corporativo</span><span>✓ Uma resposta por pessoa</span><span>✓ Resultados confiáveis</span></div></div>
<div class="login-card"><div class="icon-orbit">Q</div><h2>Bem-vindo ao QMAX Quiz</h2><p>Use sua conta corporativa para continuar.</p><a class="ms-button" href="<?= e(url('auth/microsoft.php')) ?>"><span class="ms-logo"><i></i><i></i><i></i><i></i></span>Entrar com a Microsoft</a><small>Somente contas <strong>@grupoqmax.com.br</strong></small></div></section>
<?php require __DIR__.'/includes/footer.php'; ?>

