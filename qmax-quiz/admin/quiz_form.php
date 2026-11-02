<?php
require_once dirname(__DIR__) . '/includes/auth.php';
require_admin();

$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
$quiz = [
    'id' => '',
    'title' => '',
    'description' => '',
    'status' => 'draft',
    'time_limit_minutes' => '',
    'show_score' => 1
];
$questions = [];

if ($id) {
    $s = db()->prepare('SELECT * FROM quizzes WHERE id = ?');
    $s->execute([$id]);
    $quiz = $s->fetch() ?: exit('Quiz não encontrado.');
    
    $c = db()->prepare('SELECT COUNT(*) FROM attempts WHERE quiz_id = ? AND submitted_at IS NOT NULL');
    $c->execute([$id]);
    if ((int)$c->fetchColumn() > 0) {
        flash('error', 'Este quiz já recebeu respostas e está bloqueado para edição para preservar o histórico. Se desejar, crie um novo quiz.');
        redirect('admin/');
    }
    
    $s = db()->prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY position');
    $s->execute([$id]);
    $questions = $s->fetchAll();
    
    foreach ($questions as &$q) {
        $o = db()->prepare('SELECT * FROM question_options WHERE question_id = ? ORDER BY position');
        $o->execute([$q['id']]);
        $q['options'] = $o->fetchAll();
    }
    unset($q);
}

$pageTitle = ($id ? 'Editar' : 'Criar') . ' Quiz · Grupo Q-Max';
require dirname(__DIR__) . '/includes/header.php';
?>

<section class="admin-head compact">
    <div>
        <a class="back" href="<?= e(url('admin/')) ?>">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            <span>Voltar ao painel</span>
        </a>
        <h1><?= $id ? 'Editar Quiz' : 'Criar Novo Quiz' ?></h1>
        <p>Configure o enunciado, opções de resposta e critérios de pontuação.</p>
    </div>
</section>

<form class="editor" action="<?= e(url('admin/save_quiz.php')) ?>" method="post" id="quizEditor">
    <input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>">
    <input type="hidden" name="id" value="<?= e((string)$quiz['id']) ?>">

    <section class="form-card">
        <h2>Informações Gerais</h2>
        <div class="form-grid">
            <label class="wide">
                <span>Título do Desafio</span>
                <input name="title" required maxlength="180" value="<?= e($quiz['title']) ?>" placeholder="Ex.: Desafio de Compliance &amp; LGPD 2026">
            </label>
            <label class="wide">
                <span>Descrição ou Instruções</span>
                <textarea name="description" rows="3" placeholder="Uma breve contextualização para os participantes..."><?= e($quiz['description']) ?></textarea>
            </label>
            <label>
                <span>Status</span>
                <select name="status">
                    <option value="draft" <?= $quiz['status'] === 'draft' ? 'selected' : '' ?>>Rascunho</option>
                    <option value="published" <?= $quiz['status'] === 'published' ? 'selected' : '' ?>>Publicado (Visível aos colaboradores)</option>
                    <option value="closed" <?= $quiz['status'] === 'closed' ? 'selected' : '' ?>>Encerrado</option>
                </select>
            </label>
            <label>
                <span>Tempo Limite (em minutos)</span>
                <input type="number" min="1" max="240" name="time_limit_minutes" value="<?= e((string)$quiz['time_limit_minutes']) ?>" placeholder="Opcional (ex.: 20)">
            </label>
            <label class="check wide">
                <input type="checkbox" name="show_score" value="1" <?= $quiz['show_score'] ? 'checked' : '' ?>>
                <span>Exibir gabarito e pontuação detalhada ao colaborador após o envio</span>
            </label>
        </div>
    </section>

    <div class="section-row">
        <div>
            <h2>Perguntas e Alternativas</h2>
            <p>Reordene as perguntas arrastando pelo ícone ou usando os botões subir/descer. Selecione a alternativa correta para correção automática.</p>
        </div>
        <button type="button" class="button secondary" id="addQuestion">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Adicionar pergunta</span>
        </button>
    </div>

    <div id="questionsBuilder">
        <?php foreach ($questions as $i => $q): ?>
        <section class="question-builder">
            <div class="builder-head">
                <div class="builder-head-left">
                    <span class="drag-handle" title="Arrastar para reordenar" aria-label="Arrastar pergunta">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="5" r="1.5" fill="currentColor"/><circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="9" cy="19" r="1.5" fill="currentColor"/><circle cx="15" cy="5" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="19" r="1.5" fill="currentColor"/></svg>
                    </span>
                    <strong>Pergunta <span class="q-number"><?= $i + 1 ?></span></strong>
                </div>
                <div class="builder-actions">
                    <button type="button" class="btn-order move-question-up" title="Mover para cima" aria-label="Mover pergunta para cima" <?= $i === 0 ? 'disabled' : '' ?>>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 15l-6-6-6 6"/></svg>
                        <span>Subir</span>
                    </button>
                    <button type="button" class="btn-order move-question-down" title="Mover para baixo" aria-label="Mover pergunta para baixo" <?= $i === count($questions) - 1 ? 'disabled' : '' ?>>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
                        <span>Descer</span>
                    </button>
                    <button type="button" class="remove-question" title="Excluir pergunta">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        <span>Excluir</span>
                    </button>
                </div>
            </div>
            <div class="form-grid">
                <label class="wide">
                    <span>Enunciado</span>
                    <textarea name="questions[<?= $i ?>][text]" required rows="2" placeholder="Digite o enunciado da pergunta..."><?= e($q['question_text']) ?></textarea>
                </label>
                <label>
                    <span>Tipo da Questão</span>
                    <select name="questions[<?= $i ?>][type]" class="question-type">
                        <option value="single" <?= $q['type'] === 'single' ? 'selected' : '' ?>>Múltipla escolha</option>
                        <option value="text" <?= $q['type'] === 'text' ? 'selected' : '' ?>>Resposta aberta (discursiva)</option>
                    </select>
                </label>
                <label>
                    <span>Pontuação</span>
                    <input type="number" min="0" max="100" name="questions[<?= $i ?>][points]" value="<?= (int)$q['points'] ?>">
                </label>
            </div>
            <div class="option-list">
                <?php foreach ($q['options'] as $j => $o): ?>
                <div class="option-row">
                    <input type="radio" name="questions[<?= $i ?>][correct]" value="<?= $j ?>" <?= $o['is_correct'] ? 'checked' : '' ?> required title="Marcar como alternativa correta">
                    <input type="text" name="questions[<?= $i ?>][options][]" value="<?= e($o['option_text']) ?>" placeholder="Texto da alternativa" required>
                    <button type="button" class="remove-option" title="Remover alternativa">×</button>
                </div>
                <?php endforeach; ?>
            </div>
            <button type="button" class="add-option">+ Nova alternativa</button>
        </section>
        <?php endforeach; ?>
    </div>

    <div class="savebar">
        <span>Suas alterações serão salvas imediatamente no ecossistema Q-Max.</span>
        <button class="button primary" type="submit">
            <span>Salvar Quiz</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
    </div>
</form>

<template id="questionTemplate">
    <section class="question-builder">
        <div class="builder-head">
            <div class="builder-head-left">
                <span class="drag-handle" title="Arrastar para reordenar" aria-label="Arrastar pergunta">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="5" r="1.5" fill="currentColor"/><circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="9" cy="19" r="1.5" fill="currentColor"/><circle cx="15" cy="5" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="19" r="1.5" fill="currentColor"/></svg>
                </span>
                <strong>Pergunta <span class="q-number"></span></strong>
            </div>
            <div class="builder-actions">
                <button type="button" class="btn-order move-question-up" title="Mover para cima" aria-label="Mover pergunta para cima">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 15l-6-6-6 6"/></svg>
                    <span>Subir</span>
                </button>
                <button type="button" class="btn-order move-question-down" title="Mover para baixo" aria-label="Mover pergunta para baixo">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
                    <span>Descer</span>
                </button>
                <button type="button" class="remove-question" title="Excluir pergunta">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    <span>Excluir</span>
                </button>
            </div>
        </div>
        <div class="form-grid">
            <label class="wide">
                <span>Enunciado</span>
                <textarea data-name="text" required rows="2" placeholder="Digite o enunciado da pergunta..."></textarea>
            </label>
            <label>
                <span>Tipo da Questão</span>
                <select data-name="type" class="question-type">
                    <option value="single">Múltipla escolha</option>
                    <option value="text">Resposta aberta (discursiva)</option>
                </select>
            </label>
            <label>
                <span>Pontuação</span>
                <input type="number" min="0" max="100" data-name="points" value="1">
            </label>
        </div>
        <div class="option-list"></div>
        <button type="button" class="add-option">+ Nova alternativa</button>
    </section>
</template>

<?php require dirname(__DIR__) . '/includes/footer.php'; ?>