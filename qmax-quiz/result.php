<?php
require_once __DIR__ . '/includes/auth.php';
require_login();

$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
$s = db()->prepare('SELECT a.*, q.title, q.show_score FROM attempts a JOIN quizzes q ON q.id = a.quiz_id WHERE a.id = ? AND a.user_id = ? AND a.submitted_at IS NOT NULL');
$s->execute([$id, user()['id']]);
$a = $s->fetch();
if (!$a) redirect('index.php');

$pct = $a['max_score'] > 0 ? round($a['score'] / $a['max_score'] * 100) : 0;

$history = [];
if ($a['show_score']) {
    $s_hist = db()->prepare("
        SELECT q.question_text, a.selected_option_id, a.text_answer, a.is_correct, a.points_awarded, q.points,
               (SELECT option_text FROM question_options WHERE id = a.selected_option_id) as user_answer,
               (SELECT GROUP_CONCAT(option_text SEPARATOR ' | ') FROM question_options WHERE question_id = q.id AND is_correct = 1) as correct_answer
        FROM answers a
        JOIN questions q ON q.id = a.question_id
        WHERE a.attempt_id = ?
        ORDER BY q.position ASC
    ");
    $s_hist->execute([$id]);
    $history = $s_hist->fetchAll();
}

$pageTitle = 'Resultado · ' . $a['title'] . ' · Q-Max';
require __DIR__ . '/includes/header.php';
?>

<section class="result-card">
    <div class="result-glow" aria-hidden="true"></div>
    <div class="result-ring" style="--score:<?= (int)$pct ?>">
        <div class="ring-content">
            <strong><?= (int)$pct ?>%</strong>
            <span>aproveitamento</span>
        </div>
    </div>

    <div class="eyebrow"><span class="eyebrow-spark">✦</span> DESAFIO CONCLUÍDO</div>
    <h1><?= e($a['title']) ?></h1>
    <p>Resposta registrada com sucesso em nome de <strong><?= e(user()['name']) ?></strong>.</p>

    <?php if ($a['show_score']): ?>
        <div class="result-stats">
            <div class="stat-box">
                <strong><?= e((string)$a['score']) ?></strong>
                <span>pontos obtidos</span>
            </div>
            <div class="stat-box">
                <strong><?= e((string)$a['max_score']) ?></strong>
                <span>máximo possível</span>
            </div>
            <div class="stat-box">
                <strong><?= date('d/m/Y H:i', strtotime($a['submitted_at'])) ?></strong>
                <span>data de envio</span>
            </div>
        </div>
    <?php endif; ?>

    <div class="result-actions">
        <a class="button primary" href="<?= e(url()) ?>">
            <span>Voltar aos quizzes</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
    </div>
</section>

<?php if ($a['show_score'] && !empty($history)): ?>
<section class="answers-container">
    <div class="answers-header">
        <span class="eyebrow"><span class="eyebrow-spark">✦</span> ANÁLISE DETALHADA</span>
        <h2>Resumo das suas respostas</h2>
    </div>

    <div class="answers-list">
        <?php foreach ($history as $i => $item): ?>
            <article class="table-card answer-card">
                <div class="answer-head">
                    <span class="answer-num"><?= $i + 1 ?></span>
                    <h3 class="answer-q-title"><?= e($item['question_text']) ?></h3>
                    <?php if (isset($item['is_correct'])): ?>
                        <?php if ((int)$item['is_correct'] === 1): ?>
                            <b class="status-badge correct">Correta</b>
                        <?php else: ?>
                            <b class="status-badge wrong">Incorreta</b>
                        <?php endif; ?>
                    <?php else: ?>
                        <b class="status-badge open">Resposta aberta</b>
                    <?php endif; ?>
                </div>
                
                <div class="given-answer">
                    <small>SUA RESPOSTA (<?= (float)$item['points_awarded'] ?> pts)</small>
                    <p><?= e($item['user_answer'] ?: $item['text_answer'] ?: 'Não respondida') ?></p>
                </div>

                <?php if (isset($item['is_correct']) && (int)$item['is_correct'] === 0 && !empty($item['correct_answer'])): ?>
                    <div class="correct-answer-box">
                        <small>GABARITO OFICIAL</small>
                        <p><?= e($item['correct_answer']) ?></p>
                    </div>
                <?php endif; ?>
            </article>
        <?php endforeach; ?>
    </div>
</section>
<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>