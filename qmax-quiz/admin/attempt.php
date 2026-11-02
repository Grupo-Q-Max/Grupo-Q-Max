<?php
require_once dirname(__DIR__) . '/includes/auth.php';
require_admin();

$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
$s = db()->prepare('SELECT a.*, u.name, u.email, q.title FROM attempts a JOIN users u ON u.id = a.user_id JOIN quizzes q ON q.id = a.quiz_id WHERE a.id = ?');
$s->execute([$id]);
$a = $s->fetch() ?: exit('Resposta não encontrada.');

$s = db()->prepare('
    SELECT q.question_text, q.type, q.points, ans.text_answer, ans.is_correct, ans.points_awarded, o.option_text
    FROM answers ans
    JOIN questions q ON q.id = ans.question_id
    LEFT JOIN question_options o ON o.id = ans.selected_option_id
    WHERE ans.attempt_id = ?
    ORDER BY q.position
');
$s->execute([$id]);
$answers = $s->fetchAll();

$pageTitle = 'Respostas de ' . $a['name'] . ' · Q-Max';
require dirname(__DIR__) . '/includes/header.php';
?>

<section class="admin-head compact">
    <div>
        <a class="back" href="<?= e(url('admin/quiz_results.php?id=' . $a['quiz_id'])) ?>">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            <span>Voltar aos resultados</span>
        </a>
        <div class="eyebrow"><span class="eyebrow-spark">✦</span> RESPOSTAS INDIVIDUAIS</div>
        <h1><?= e($a['name']) ?></h1>
        <p><?= e($a['email']) ?> · Desafio: <strong><?= e($a['title']) ?></strong></p>
    </div>
    <div class="grade">
        <strong><?= e($a['score']) ?> / <?= e($a['max_score']) ?></strong>
        <span>pontos totais</span>
    </div>
</section>

<div class="answers-list" style="margin-top:30px;">
    <?php foreach ($answers as $i => $ans): ?>
    <article class="table-card answer-card">
        <div class="answer-head">
            <span class="answer-num"><?= $i + 1 ?></span>
            <h2 class="answer-q-title"><?= e($ans['question_text']) ?></h2>
            <?php if ($ans['is_correct'] !== null): ?>
                <b class="status-badge <?= $ans['is_correct'] ? 'correct' : 'wrong' ?>">
                    <?= $ans['is_correct'] ? 'Correta' : 'Incorreta' ?>
                </b>
            <?php else: ?>
                <b class="status-badge open">Resposta aberta</b>
            <?php endif; ?>
        </div>
        <div class="given-answer">
            <small>RESPOSTA SUBMETIDA (<?= (float)$ans['points_awarded'] ?> pts)</small>
            <p><?= e($ans['type'] === 'text' ? $ans['text_answer'] : $ans['option_text']) ?></p>
        </div>
    </article>
    <?php endforeach; ?>
</div>

<?php require dirname(__DIR__) . '/includes/footer.php'; ?>