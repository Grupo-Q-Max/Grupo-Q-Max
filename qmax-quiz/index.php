<?php
require_once __DIR__ . '/includes/auth.php';
require_login();

$stmt = db()->prepare("
    SELECT q.*, a.id attempt_id, a.submitted_at, a.score, a.max_score,
           (SELECT COUNT(*) FROM questions x WHERE x.quiz_id = q.id) question_count
    FROM quizzes q
    LEFT JOIN attempts a ON a.quiz_id = q.id AND a.user_id = ?
    WHERE q.status = 'published'
    ORDER BY q.created_at DESC
");
$stmt->execute([user()['id']]);
$quizzes = $stmt->fetchAll();
$pageTitle = 'Arena de Conhecimento · Grupo Q-Max';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
    <div class="page-head-copy">
        <div class="eyebrow"><span class="eyebrow-spark">✦</span> ARENA DE CONHECIMENTO</div>
        <h1>Olá, <?= e(explode(' ', user()['name'])[0]) ?>!</h1>
        <p>Desenvolva seu conhecimento, supere desafios e acelere o crescimento do nosso ecossistema.</p>
    </div>
    <div class="score-bubble">
        <div class="score-bubble-inner">
            <strong><?= count($quizzes) ?></strong>
            <span><?= count($quizzes) === 1 ? 'desafio ativo' : 'desafios ativos' ?></span>
        </div>
    </div>
</section>

<div class="quiz-grid">
    <?php if (!$quizzes): ?>
        <div class="empty">
            <span class="empty-icon">✦</span>
            <h2>Nenhum quiz disponível no momento</h2>
            <p>Novos desafios corporativos serão liberados em breve. Fique atento às comunicações internas!</p>
        </div>
    <?php endif; ?>

    <?php foreach ($quizzes as $q): ?>
        <article class="quiz-card">
            <div class="card-glow" aria-hidden="true"></div>
            <div class="card-top">
                <span class="status live"><span class="status-pulse"></span> AO VIVO</span>
                <span class="card-count-badge"><?= (int)$q['question_count'] ?> <?= (int)$q['question_count'] === 1 ? 'pergunta' : 'perguntas' ?></span>
            </div>
            
            <h2 class="card-title"><?= e($q['title']) ?></h2>
            <p class="card-desc"><?= e($q['description']) ?></p>
            
            <div class="card-meta">
                <span class="meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <?= $q['time_limit_minutes'] ? (int)$q['time_limit_minutes'] . ' min' : 'Sem limite' ?>
                </span>
                <span class="meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Tentativa única
                </span>
            </div>

            <div class="card-actions">
                <?php if ($q['submitted_at']): ?>
                    <a class="button secondary" href="<?= e(url('result.php?id=' . $q['attempt_id'])) ?>">
                        <span>Ver meu resultado</span>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M7 7h10v10"/></svg>
                    </a>
                <?php else: ?>
                    <a class="button primary" href="<?= e(url('quiz.php?id=' . $q['id'])) ?>">
                        <span><?= $q['attempt_id'] ? 'Continuar desafio' : 'Iniciar desafio' ?></span>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </a>
                <?php endif; ?>
            </div>
        </article>
    <?php endforeach; ?>
</div>

<?php require __DIR__ . '/includes/footer.php'; ?>
