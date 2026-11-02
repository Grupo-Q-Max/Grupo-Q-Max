<?php
require_once __DIR__ . '/includes/bootstrap.php';
if (!empty($_SESSION['user'])) redirect('index.php');
$pageTitle = 'Acesso Corporativo · Grupo Q-Max Quiz';
require __DIR__ . '/includes/header.php';
?>

<section class="login-layout">
    <div class="login-copy">
        <div class="eyebrow"><span class="eyebrow-spark">✦</span> ECOSSISTEMA GRUPO Q-MAX</div>
        <h1>Tecnologia, Inovação e Atitude.</h1>
        <p>Um ecossistema empresarial sustentável que reúne empresas e profissionais para criar soluções inovadoras, qualificação contínua e resultados de alto impacto.</p>
        
        <div class="trust">
            <div class="trust-badge">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#14d0c1" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Acesso Seguro via Microsoft</span>
            </div>
            <div class="trust-badge">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#14d0c1" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Avaliação e Feedback Imediato</span>
            </div>
            <div class="trust-badge">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#14d0c1" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Conformidade Corporativa &amp; LGPD</span>
            </div>
        </div>
    </div>

    <div class="login-card">
        <div class="login-card-glow" aria-hidden="true"></div>
        <div class="login-card-inner">
            <div class="login-brand-display">
                <?php if (file_exists(dirname(__DIR__) . '/assets/images/logo.png')): ?>
                    <img src="<?= e(url('assets/images/logo.png')) ?>" alt="Grupo Q-Max" class="login-logo-img">
                <?php else: ?>
                    <div class="login-brandmark">
                        <span>Q</span>
                    </div>
                <?php endif; ?>
            </div>

            <h2>Plataforma de Desafios</h2>
            <p>Conecte-se com sua conta corporativa Microsoft institucional para participar dos desafios.</p>

            <a class="ms-button" href="<?= e(url('auth/microsoft.php')) ?>">
                <span class="ms-logo">
                    <i></i><i></i><i></i><i></i>
                </span>
                <span>Entrar com a Microsoft</span>
            </a>

            <div class="login-footer-info">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span>Exclusivo para colaboradores do ecossistema Q-Max</span>
            </div>
        </div>
    </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
