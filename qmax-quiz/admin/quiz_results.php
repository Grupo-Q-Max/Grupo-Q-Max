<?php
require_once dirname(__DIR__) . '/includes/auth.php';
require_admin();

$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
$s = db()->prepare('SELECT * FROM quizzes WHERE id = ?');
$s->execute([$id]);
$quiz = $s->fetch() ?: exit('Quiz não encontrado.');

$s = db()->prepare('
    SELECT a.*, u.name, u.email,
           ROUND(IF(a.max_score > 0, a.score / a.max_score * 100, 0)) percent
    FROM attempts a
    JOIN users u ON u.id = a.user_id
    WHERE a.quiz_id = ? AND a.submitted_at IS NOT NULL
    ORDER BY a.submitted_at DESC
');
$s->execute([$id]);
$attempts = $s->fetchAll();

$avg = count($attempts) ? round(array_sum(array_column($attempts, 'percent')) / count($attempts)) : 0;
$pageTitle = 'Resultados · ' . $quiz['title'] . ' · Q-Max';
require dirname(__DIR__) . '/includes/header.php';
?>

<section class="admin-head compact">
    <div>
        <a class="back" href="<?= e(url('admin/')) ?>">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            <span>Voltar ao painel</span>
        </a>
        <div class="eyebrow"><span class="eyebrow-spark">✦</span> RESULTADOS DO DESAFIO</div>
        <h1><?= e($quiz['title']) ?></h1>
    </div>
    <a class="button secondary" href="<?= e(url('admin/export.php?id=' . $id)) ?>">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>Exportar CSV</span>
    </a>
</section>

<div class="stats">
    <article class="stat-card stat-cyan">
        <span class="stat-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </span>
        <div>
            <strong><?= count($attempts) ?></strong>
            <small>participações registradas</small>
        </div>
    </article>
    <article class="stat-card stat-magenta">
        <span class="stat-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/></svg>
        </span>
        <div>
            <strong><?= $avg ?>%</strong>
            <small>média geral de acertos</small>
        </div>
    </article>
</div>

<section class="table-card">
    <div class="table-wrap">
        <table>
            <thead>
                <tr>
                    <th>Colaborador</th>
                    <th>E-mail Corporativo</th>
                    <th>Pontuação</th>
                    <th>Aproveitamento</th>
                    <th>Concluído em</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($attempts)): ?>
                    <tr>
                        <td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">
                            Nenhum colaborador concluiu este quiz ainda.
                        </td>
                    </tr>
                <?php endif; ?>
                <?php foreach ($attempts as $a): ?>
                <tr>
                    <td><strong><?= e($a['name']) ?></strong></td>
                    <td><span style="color:var(--text-secondary);"><?= e($a['email']) ?></span></td>
                    <td><?= e($a['score']) ?> / <?= e($a['max_score']) ?> pts</td>
                    <td>
                        <div class="mini-progress"><i style="width:<?= (int)$a['percent'] ?>%"></i></div>
                        <strong><?= (int)$a['percent'] ?>%</strong>
                    </td>
                    <td><?= date('d/m/Y H:i', strtotime($a['submitted_at'])) ?></td>
                    <td class="actions">
                        <a href="<?= e(url('admin/attempt.php?id=' . $a['id'])) ?>">Ver respostas ↗</a>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</section>

<?php require dirname(__DIR__) . '/includes/footer.php'; ?>