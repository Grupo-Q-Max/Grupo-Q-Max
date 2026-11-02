<?php
require_once dirname(__DIR__) . '/includes/auth.php';
require_admin();

$quizzes = db()->query("
    SELECT q.*, u.name creator,
           (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) questions,
           (SELECT COUNT(*) FROM attempts WHERE quiz_id = q.id AND submitted_at IS NOT NULL) responses
    FROM quizzes q
    JOIN users u ON u.id = q.created_by
    ORDER BY q.created_at DESC
")->fetchAll();

$stats = db()->query("
    SELECT (SELECT COUNT(*) FROM quizzes) quizzes,
           (SELECT COUNT(*) FROM attempts WHERE submitted_at IS NOT NULL) responses,
           (SELECT COUNT(*) FROM users) users
")->fetch();

$pageTitle = 'Painel Administrativo · Grupo Q-Max';
require dirname(__DIR__) . '/includes/header.php';
?>

<section class="admin-head">
    <div>
        <div class="eyebrow"><span class="eyebrow-spark">✦</span> GESTÃO DE CONTEÚDO</div>
        <h1>Central de Quizzes</h1>
        <p>Crie novos desafios corporativos, acompanhe adesão e meça a evolução do conhecimento.</p>
    </div>
    <a class="button primary" href="<?= e(url('admin/quiz_form.php')) ?>">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        <span>Criar novo quiz</span>
    </a>
</section>

<div class="stats">
    <article class="stat-card stat-cyan">
        <span class="stat-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10M6 10h10"/></svg>
        </span>
        <div>
            <strong><?= (int)$stats['quizzes'] ?></strong>
            <small>quizzes cadastrados</small>
        </div>
    </article>
    <article class="stat-card stat-magenta">
        <span class="stat-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </span>
        <div>
            <strong><?= (int)$stats['responses'] ?></strong>
            <small>respostas recebidas</small>
        </div>
    </article>
    <article class="stat-card stat-violet">
        <span class="stat-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </span>
        <div>
            <strong><?= (int)$stats['users'] ?></strong>
            <small>colaboradores</small>
        </div>
    </article>
</div>

<section class="table-card">
    <div class="table-title">
        <h2>Todos os quizzes</h2>
    </div>
    <div class="table-wrap">
        <table>
            <thead>
                <tr>
                    <th>Quiz</th>
                    <th>Status</th>
                    <th>Perguntas</th>
                    <th>Respostas</th>
                    <th>Criado em</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($quizzes)): ?>
                    <tr>
                        <td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">
                            Nenhum quiz cadastrado até o momento.
                        </td>
                    </tr>
                <?php endif; ?>
                <?php foreach ($quizzes as $q): ?>
                <tr>
                    <td>
                        <strong><?= e($q['title']) ?></strong>
                        <small>Criado por <?= e($q['creator']) ?></small>
                    </td>
                    <td>
                        <span class="status <?= e($q['status']) ?>">
                            <?= e(['draft' => 'Rascunho', 'published' => 'Publicado', 'closed' => 'Encerrado'][$q['status']] ?? $q['status']) ?>
                        </span>
                    </td>
                    <td><?= (int)$q['questions'] ?></td>
                    <td><strong><?= (int)$q['responses'] ?></strong></td>
                    <td><?= date('d/m/Y', strtotime($q['created_at'])) ?></td>
                    <td class="actions">
                        <a href="<?= e(url('admin/quiz_results.php?id=' . $q['id'])) ?>">Resultados</a>
                        <a href="<?= e(url('admin/quiz_form.php?id=' . $q['id'])) ?>">Editar</a>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</section>

<?php require dirname(__DIR__) . '/includes/footer.php'; ?>