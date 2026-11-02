<?php
require_once __DIR__ . '/includes/auth.php';
require_login();

$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
if (!$id) redirect('index.php');

$stmt = db()->prepare("SELECT * FROM quizzes WHERE id = ? AND status = 'published'");
$stmt->execute([$id]);
$quiz = $stmt->fetch();
if (!$quiz) exit('Quiz indisponível.');

$stmt = db()->prepare('SELECT * FROM attempts WHERE quiz_id = ? AND user_id = ?');
$stmt->execute([$id, user()['id']]);
$attempt = $stmt->fetch();

if ($attempt && $attempt['submitted_at']) {
    redirect('result.php?id=' . $attempt['id']);
}

if (!$attempt) {
    db()->prepare('INSERT INTO attempts(quiz_id, user_id, ip_address, user_agent) VALUES(?, ?, ?, ?)')->execute([
        $id,
        user()['id'],
        $_SERVER['REMOTE_ADDR'] ?? null,
        substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500)
    ]);
    $attempt = ['id' => db()->lastInsertId(), 'started_at' => date('Y-m-d H:i:s')];
}

$stmt = db()->prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY position');
$stmt->execute([$id]);
$questions = $stmt->fetchAll();

foreach ($questions as &$q) {
    $o = db()->prepare('SELECT id, option_text FROM question_options WHERE question_id = ? ORDER BY position');
    $o->execute([$q['id']]);
    $q['options'] = $o->fetchAll();
}
unset($q);

$pageTitle = $quiz['title'] . ' · Q-Max Quiz';
require __DIR__ . '/includes/header.php';
?>

<section class="quiz-stage" data-limit="<?= (int)($quiz['time_limit_minutes'] ?? 0) ?>" data-started="<?= e($attempt['started_at']) ?>">
    <div class="quiz-progress-card">
        <div class="quiz-info">
            <span class="quiz-progress-eyebrow">DESAFIO CORPORATIVO</span>
            <strong class="quiz-title-display"><?= e($quiz['title']) ?></strong>
        </div>
        <div class="timer" id="timer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span class="timer-text">--:--</span>
        </div>
    </div>
    
    <div class="progress-track" aria-label="Progresso do quiz">
        <i id="progressBar"></i>
    </div>

    <form action="<?= e(url('submit.php')) ?>" method="post" id="quizForm">
        <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
        <input type="hidden" name="attempt_id" value="<?= (int)$attempt['id'] ?>">

        <?php foreach ($questions as $i => $q): ?>
        <fieldset class="question-panel <?= $i === 0 ? 'active' : '' ?>" data-question>
            <legend>
                <div class="q-meta">
                    <span class="q-badge">Pergunta <?= $i + 1 ?> de <?= count($questions) ?></span>
                    <?php if (!empty($q['points'])): ?>
                        <span class="q-points-badge"><?= (int)$q['points'] ?> <?= (int)$q['points'] === 1 ? 'ponto' : 'pontos' ?></span>
                    <?php endif; ?>
                </div>
                <div class="q-text"><?= e($q['question_text']) ?></div>
            </legend>

            <?php if ($q['type'] === 'single'): ?>
                <div class="options">
                    <?php foreach ($q['options'] as $letter => $o): ?>
                    <label class="option-label">
                        <input type="radio" name="answers[<?= (int)$q['id'] ?>]" value="<?= (int)$o['id'] ?>" required>
                        <b class="option-badge"><?= chr(65 + $letter) ?></b>
                        <span class="option-text"><?= e($o['option_text']) ?></span>
                        <i class="option-check">✓</i>
                    </label>
                    <?php endforeach; ?>
                </div>
            <?php else: ?>
                <div class="textarea-wrap">
                    <textarea name="answers[<?= (int)$q['id'] ?>]" rows="5" required placeholder="Digite sua resposta detalhada aqui..."></textarea>
                </div>
            <?php endif; ?>

            <div class="quiz-actions">
                <button type="button" class="button secondary prev" <?= $i === 0 ? 'disabled' : '' ?>>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                    <span>Anterior</span>
                </button>
                
                <?php if ($i < count($questions) - 1): ?>
                    <button type="button" class="button primary next">
                        <span>Próxima</span>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </button>
                <?php else: ?>
                    <button type="submit" class="button submit-btn">
                        <span>Finalizar e enviar</span>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                <?php endif; ?>
            </div>
        </fieldset>
        <?php endforeach; ?>
    </form>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
