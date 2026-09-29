<?php require_once __DIR__.'/includes/auth.php'; require_login();
$stmt=db()->prepare("SELECT q.*,a.id attempt_id,a.submitted_at,a.score,a.max_score,(SELECT COUNT(*) FROM questions x WHERE x.quiz_id=q.id) question_count FROM quizzes q LEFT JOIN attempts a ON a.quiz_id=q.id AND a.user_id=? WHERE q.status='published' ORDER BY q.created_at DESC");
$stmt->execute([user()['id']]); $quizzes=$stmt->fetchAll(); $pageTitle='Quizzes · QMAX'; require __DIR__.'/includes/header.php'; ?>
<section class="page-head"><div><div class="eyebrow">ARENA DE CONHECIMENTO</div><h1>Olá, <?= e(explode(' ',user()['name'])[0]) ?>!</h1><p>Escolha um desafio e mostre o seu Q de conhecimento.</p></div><div class="score-bubble"><strong><?= count($quizzes) ?></strong><span>desafios ativos</span></div></section>
<div class="quiz-grid"><?php if(!$quizzes): ?><div class="empty"><span>✦</span><h2>Nenhum quiz disponível agora</h2><p>Volte em breve para o próximo desafio.</p></div><?php endif; ?>
<?php foreach($quizzes as $q): ?><article class="quiz-card"><div class="card-top"><span class="status live">● AO VIVO</span><span><?= (int)$q['question_count'] ?> perguntas</span></div><h2><?= e($q['title']) ?></h2><p><?= e($q['description']) ?></p><div class="card-meta"><span>◷ <?= $q['time_limit_minutes'] ? (int)$q['time_limit_minutes'].' min' : 'Sem limite' ?></span><span>♢ Tentativa única</span></div>
<?php if($q['submitted_at']): ?><a class="button secondary" href="<?= e(url('result.php?id='.$q['attempt_id'])) ?>">Ver meu resultado</a><?php else: ?><a class="button" href="<?= e(url('quiz.php?id='.$q['id'])) ?>"><?= $q['attempt_id']?'Continuar':'Começar desafio' ?> <b>→</b></a><?php endif; ?></article><?php endforeach; ?></div>
<?php require __DIR__.'/includes/footer.php'; ?>

