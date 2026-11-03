<?php
declare(strict_types=1);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_set_cookie_params([
        'httponly' => true,
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https'),
        'samesite' => 'Lax',
        'path' => '/',
    ]);
    session_start();
}

function load_env(string $file): void {
    if (!is_file($file)) return;
    foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;
        [$key, $value] = array_map('trim', explode('=', $line, 2));
        $value = trim($value, "\"'");
        if (getenv($key) === false) putenv("{$key}={$value}");
    }
}
load_env(dirname(__DIR__) . '/.env');

function env(string $key, ?string $default = null): ?string {
    $value = getenv($key);
    return $value === false ? $default : $value;
}

function db(): PDO {
    static $pdo;
    if ($pdo instanceof PDO) return $pdo;
    $host = env('DB_HOST', '127.0.0.1');
    $port = env('DB_PORT', '3306');
    $name = env('DB_NAME', 'quiz');
    $user = env('DB_USER', 'quiz');
    $pass = env('DB_PASS', '');

    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $name);
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];
    if (str_contains($host, 'azure.com') || env('DB_SSL') === 'true') {
        if (defined('PDO::MYSQL_ATTR_SSL_CA')) {
            $options[PDO::MYSQL_ATTR_SSL_CA] = true;
        }
        if (defined('PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT')) {
            $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = false;
        }
    }
    $pdo = new PDO($dsn, $user, $pass, $options);
    return $pdo;
}

function url(string $path = '', bool $absolute = false): string {
    $path = ltrim($path, '/');
    $subpath = $path === '' ? '/quiz' : '/quiz/' . $path;

    if (!$absolute) {
        return $subpath;
    }

    $baseUrl = env('APP_URL');
    if ($baseUrl && !str_contains($baseUrl, '127.0.0.1') && !str_contains($baseUrl, 'localhost')) {
        $scheme = parse_url($baseUrl, PHP_URL_SCHEME) ?: 'https';
        $host = parse_url($baseUrl, PHP_URL_HOST) ?: 'grupoqmax.com.br';
        return $scheme . '://' . $host . $subpath;
    }

    $forwardedHost = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? null;
    $forwardedProto = $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? 'https';
    if ($forwardedHost && !str_contains($forwardedHost, '127.0.0.1') && !str_contains($forwardedHost, 'localhost')) {
        return $forwardedProto . '://' . $forwardedHost . $subpath;
    }

    return 'https://grupoqmax.com.br' . $subpath;
}

function redirect(string $path): never {
    if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
        header('Location: ' . $path);
    } else {
        $path = ltrim($path, '/');
        header('Location: /quiz/' . $path);
    }
    exit;
}

function e(?string $value): string { return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8'); }
function csrf_token(): string { return $_SESSION['csrf'] ??= bin2hex(random_bytes(32)); }
function verify_csrf(): void {
    if (!hash_equals($_SESSION['csrf'] ?? '', (string)($_POST['csrf'] ?? ''))) {
        http_response_code(419); exit('Sessão expirada. Atualize a página e tente novamente.');
    }
}
function flash(string $type, string $message): void { $_SESSION['flash'] = compact('type','message'); }
function pull_flash(): ?array { $f = $_SESSION['flash'] ?? null; unset($_SESSION['flash']); return $f; }

/**
 * Recalcula as notas e status de acerto de todas as tentativas de um quiz
 * com base nas questões e alternativas corretas atuais.
 */
function recalculate_quiz_scores(int $quizId, ?PDO $pdo = null): array {
    $pdo ??= db();

    // 1. Obter todas as perguntas do quiz
    $qStmt = $pdo->prepare('SELECT id, type, points FROM questions WHERE quiz_id = ?');
    $qStmt->execute([$quizId]);
    $questions = $qStmt->fetchAll();

    $maxScore = 0.0;
    $questionPoints = [];
    $questionTypes = [];
    foreach ($questions as $q) {
        $qid = (int)$q['id'];
        $pts = (float)$q['points'];
        $questionPoints[$qid] = $pts;
        $questionTypes[$qid] = $q['type'];
        if ($q['type'] === 'single') {
            $maxScore += $pts;
        }
    }

    // 2. Obter as alternativas corretas para as perguntas single deste quiz
    $optStmt = $pdo->prepare('
        SELECT qo.id, qo.question_id 
        FROM question_options qo
        JOIN questions q ON q.id = qo.question_id
        WHERE q.quiz_id = ? AND qo.is_correct = 1
    ');
    $optStmt->execute([$quizId]);
    $correctOptions = [];
    foreach ($optStmt->fetchAll() as $row) {
        $correctOptions[(int)$row['question_id']] = (int)$row['id'];
    }

    // 3. Buscar todas as tentativas deste quiz
    $attStmt = $pdo->prepare('SELECT id, submitted_at FROM attempts WHERE quiz_id = ?');
    $attStmt->execute([$quizId]);
    $attempts = $attStmt->fetchAll();

    $updatedCount = 0;

    foreach ($attempts as $att) {
        $attemptId = (int)$att['id'];
        $ansStmt = $pdo->prepare('SELECT id, question_id, selected_option_id, text_answer FROM answers WHERE attempt_id = ?');
        $ansStmt->execute([$attemptId]);
        $answers = $ansStmt->fetchAll();

        $attemptScore = 0.0;

        foreach ($answers as $ans) {
            $qid = (int)$ans['question_id'];
            $type = $questionTypes[$qid] ?? 'text';
            $ptsPossible = $questionPoints[$qid] ?? 0.0;

            if ($type === 'single') {
                $chosenOpt = $ans['selected_option_id'] !== null ? (int)$ans['selected_option_id'] : null;
                $correctOpt = $correctOptions[$qid] ?? null;

                $isCorrect = ($chosenOpt !== null && $correctOpt !== null && $chosenOpt === $correctOpt) ? 1 : 0;
                $ptsAwarded = $isCorrect ? $ptsPossible : 0.0;

                $updAns = $pdo->prepare('UPDATE answers SET is_correct = ?, points_awarded = ? WHERE id = ?');
                $updAns->execute([$isCorrect, $ptsAwarded, $ans['id']]);

                $attemptScore += $ptsAwarded;
            } else {
                // Dissertativa
                $curPtsStmt = $pdo->prepare('SELECT points_awarded FROM answers WHERE id = ?');
                $curPtsStmt->execute([$ans['id']]);
                $attemptScore += (float)$curPtsStmt->fetchColumn();
            }
        }

        $updAtt = $pdo->prepare('UPDATE attempts SET score = ?, max_score = ? WHERE id = ?');
        $updAtt->execute([$attemptScore, $maxScore, $attemptId]);
        $updatedCount++;
    }

    return [
        'attempts_updated' => $updatedCount,
        'max_score' => $maxScore
    ];
}

