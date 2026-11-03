<?php
require_once dirname(__DIR__) . '/includes/auth.php';
require_admin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    redirect('admin/');
}

verify_csrf();

$id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT);
$title = trim((string)($_POST['title'] ?? ''));
$questions = $_POST['questions'] ?? [];

if ($title === '' || !is_array($questions) || count($questions) < 1) {
    flash('error', 'Informe o título do quiz e adicione pelo menos uma pergunta.');
    redirect('admin/quiz_form.php' . ($id ? '?id=' . $id : ''));
}

$pdo = db();
$pdo->beginTransaction();

try {
    $data = [
        $title,
        trim((string)($_POST['description'] ?? '')),
        in_array($_POST['status'] ?? '', ['draft', 'published', 'closed'], true) ? $_POST['status'] : 'draft',
        ($_POST['time_limit_minutes'] ?? '') !== '' ? (int)$_POST['time_limit_minutes'] : null,
        isset($_POST['show_score']) ? 1 : 0
    ];

    $existingQuestionIds = [];
    if ($id) {
        $pdo->prepare('UPDATE quizzes SET title = ?, description = ?, status = ?, time_limit_minutes = ?, show_score = ? WHERE id = ?')
            ->execute([...$data, $id]);

        $qListStmt = $pdo->prepare('SELECT id FROM questions WHERE quiz_id = ?');
        $qListStmt->execute([$id]);
        $existingQuestionIds = array_map('intval', $qListStmt->fetchAll(PDO::FETCH_COLUMN));
    } else {
        $pdo->prepare('INSERT INTO quizzes (title, description, status, time_limit_minutes, show_score, created_by) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([...$data, user()['id']]);
        $id = (int)$pdo->lastInsertId();
    }

    $keptQuestionIds = [];

    foreach (array_values($questions) as $i => $q) {
        $type = ($q['type'] ?? 'single') === 'text' ? 'text' : 'single';
        $text = trim((string)($q['text'] ?? ''));
        if ($text === '') {
            throw new RuntimeException('A Pergunta ' . ($i + 1) . ' precisa de um enunciado preenchido.');
        }
        $pts = $type === 'text' ? 0 : max(0, (int)($q['points'] ?? 1));
        $position = $i + 1;

        $qid = (!empty($q['id']) && in_array((int)$q['id'], $existingQuestionIds, true)) ? (int)$q['id'] : null;

        if ($qid) {
            $pdo->prepare('UPDATE questions SET question_text = ?, type = ?, points = ?, position = ? WHERE id = ? AND quiz_id = ?')
                ->execute([$text, $type, $pts, $position, $qid, $id]);
        } else {
            $pdo->prepare('INSERT INTO questions (quiz_id, question_text, type, points, position) VALUES (?, ?, ?, ?, ?)')
                ->execute([$id, $text, $type, $pts, $position]);
            $qid = (int)$pdo->lastInsertId();
        }

        $keptQuestionIds[] = $qid;

        if ($type === 'single') {
            $rawOptions = $q['options'] ?? [];
            $rawOptionIds = $q['option_ids'] ?? [];
            $rawCorrect = isset($q['correct']) ? (int)$q['correct'] : -1;

            $opts = [];
            $optIds = [];
            $correctIndex = -1;

            foreach ($rawOptions as $optIdx => $optVal) {
                $trimmed = trim((string)$optVal);
                if ($trimmed !== '') {
                    $opts[] = $trimmed;
                    $optIds[] = !empty($rawOptionIds[$optIdx]) ? (int)$rawOptionIds[$optIdx] : null;
                    if ($optIdx === $rawCorrect) {
                        $correctIndex = count($opts) - 1;
                    }
                }
            }

            if (count($opts) < 2) {
                throw new RuntimeException('A Pergunta ' . ($i + 1) . ' de múltipla escolha precisa de pelo menos duas alternativas preenchidas.');
            }

            if ($correctIndex === -1) {
                $correctIndex = 0;
            }

            // Buscar opções existentes dessa questão no banco
            $optListStmt = $pdo->prepare('SELECT id FROM question_options WHERE question_id = ?');
            $optListStmt->execute([$qid]);
            $existingOptionIds = array_map('intval', $optListStmt->fetchAll(PDO::FETCH_COLUMN));

            $keptOptionIds = [];

            foreach ($opts as $j => $opt) {
                $optId = (!empty($optIds[$j]) && in_array($optIds[$j], $existingOptionIds, true)) ? $optIds[$j] : null;
                $isCorrect = ($j === $correctIndex) ? 1 : 0;
                $optPosition = $j + 1;

                if ($optId) {
                    $pdo->prepare('UPDATE question_options SET option_text = ?, is_correct = ?, position = ? WHERE id = ? AND question_id = ?')
                        ->execute([$opt, $isCorrect, $optPosition, $optId, $qid]);
                } else {
                    $pdo->prepare('INSERT INTO question_options (question_id, option_text, is_correct, position) VALUES (?, ?, ?, ?)')
                        ->execute([$qid, $opt, $isCorrect, $optPosition]);
                    $optId = (int)$pdo->lastInsertId();
                }

                $keptOptionIds[] = $optId;
            }

            // Remover opções que foram excluídas dessa pergunta
            if (!empty($existingOptionIds)) {
                $optionsToDelete = array_diff($existingOptionIds, $keptOptionIds);
                if (!empty($optionsToDelete)) {
                    $inOpts = implode(',', array_map('intval', $optionsToDelete));
                    $pdo->exec("DELETE FROM question_options WHERE question_id = $qid AND id IN ($inOpts)");
                }
            }
        } else {
            // Se virou tipo texto, remover quaisquer opções anteriores
            $pdo->prepare('DELETE FROM question_options WHERE question_id = ?')->execute([$qid]);
        }
    }

    // Remover perguntas que foram excluídas do quiz
    if (!empty($existingQuestionIds)) {
        $questionsToDelete = array_diff($existingQuestionIds, $keptQuestionIds);
        if (!empty($questionsToDelete)) {
            $inQ = implode(',', array_map('intval', $questionsToDelete));
            $pdo->exec("DELETE FROM questions WHERE quiz_id = $id AND id IN ($inQ)");
        }
    }

    // Recalcular as notas de todas as tentativas existentes para este quiz
    $recalc = recalculate_quiz_scores($id, $pdo);

    $pdo->commit();

    $msg = 'Quiz salvo com sucesso.';
    if (!empty($recalc['attempts_updated'])) {
        $msg .= ' As notas e porcentagens de ' . $recalc['attempts_updated'] . ' tentativa(s) foram recalculadas automaticamente.';
    }

    flash('success', $msg);
    redirect('admin/');
} catch (Throwable $e) {
    $pdo->rollBack();
    flash('error', $e->getMessage());
    redirect('admin/quiz_form.php' . ($id ? '?id=' . $id : ''));
}
