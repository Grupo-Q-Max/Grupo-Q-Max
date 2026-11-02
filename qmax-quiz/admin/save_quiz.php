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

    if ($id) {
        $check = $pdo->prepare('SELECT id FROM attempts WHERE quiz_id = ? AND submitted_at IS NOT NULL LIMIT 1 FOR UPDATE');
        $check->execute([$id]);
        if ($check->fetchColumn()) {
            throw new RuntimeException('Este quiz já recebeu respostas e está bloqueado para edição para preservar o histórico.');
        }
        $pdo->prepare('UPDATE quizzes SET title = ?, description = ?, status = ?, time_limit_minutes = ?, show_score = ? WHERE id = ?')
            ->execute([...$data, $id]);
        $pdo->prepare('DELETE FROM questions WHERE quiz_id = ?')->execute([$id]);
    } else {
        $pdo->prepare('INSERT INTO quizzes (title, description, status, time_limit_minutes, show_score, created_by) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([...$data, user()['id']]);
        $id = (int)$pdo->lastInsertId();
    }

    foreach (array_values($questions) as $i => $q) {
        $type = ($q['type'] ?? 'single') === 'text' ? 'text' : 'single';
        $text = trim((string)($q['text'] ?? ''));
        if ($text === '') {
            throw new RuntimeException('A Pergunta ' . ($i + 1) . ' precisa de um enunciado preenchido.');
        }
        $pts = $type === 'text' ? 0 : max(0, (int)($q['points'] ?? 1));

        $pdo->prepare('INSERT INTO questions (quiz_id, question_text, type, points, position) VALUES (?, ?, ?, ?, ?)')
            ->execute([$id, $text, $type, $pts, $i + 1]);
        $qid = (int)$pdo->lastInsertId();

        if ($type === 'single') {
            $rawOptions = $q['options'] ?? [];
            $rawCorrect = isset($q['correct']) ? (int)$q['correct'] : -1;

            $opts = [];
            $correctIndex = -1;

            foreach ($rawOptions as $optIdx => $optVal) {
                $trimmed = trim((string)$optVal);
                if ($trimmed !== '') {
                    $opts[] = $trimmed;
                    if ($optIdx === $rawCorrect) {
                        $correctIndex = count($opts) - 1;
                    }
                }
            }

            if (count($opts) < 2) {
                throw new RuntimeException('A Pergunta ' . ($i + 1) . ' de múltipla escolha precisa de pelo menos duas alternativas preenchidas.');
            }

            // Fallback to first option if no valid correct index was identified
            if ($correctIndex === -1) {
                $correctIndex = 0;
            }

            foreach ($opts as $j => $opt) {
                $pdo->prepare('INSERT INTO question_options (question_id, option_text, is_correct, position) VALUES (?, ?, ?, ?)')
                    ->execute([$qid, $opt, $j === $correctIndex ? 1 : 0, $j + 1]);
            }
        }
    }

    $pdo->commit();
    flash('success', 'Quiz salvo com sucesso.');
    redirect('admin/');
} catch (Throwable $e) {
    $pdo->rollBack();
    flash('error', $e->getMessage());
    redirect('admin/quiz_form.php' . ($id ? '?id=' . $id : ''));
}
