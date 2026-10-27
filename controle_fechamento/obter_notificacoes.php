<?php
require_once 'assets/backend/config.php';

header('Content-Type: application/json');

session_start();
if (!isset($_SESSION['usuario_id'])) {
    echo json_encode(['success' => false, 'message' => 'Não autorizado']);
    exit();
}

try {
    $stmt = $conexao->prepare("
SELECT id, mensagem, data_criacao, status, tipo, lida 
FROM notificacoes 
WHERE id_usuario = ? AND status != 'concluido' 
ORDER BY data_criacao DESC 
LIMIT 10

    ");
    $stmt->bind_param('i', $_SESSION['usuario_id']);
    $stmt->execute();
    $notificacoes = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    $stmt = $conexao->prepare("
        SELECT COUNT(*) as total_pendentes 
        FROM notificacoes 
        WHERE id_usuario = ? AND status = 'pendente'
    ");
    $stmt->bind_param('i', $_SESSION['usuario_id']);
    $stmt->execute();
    $total_pendentes = $stmt->get_result()->fetch_assoc()['total_pendentes'];
    $stmt->close();

    $total_notificacoes = count($notificacoes);

    echo json_encode([
        'success' => true,
        'total_pendentes' => $total_pendentes,
        'total_notificacoes' => $total_notificacoes,
        'notificacoes' => $notificacoes
    ]);
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao carregar notificações: ' . $e->getMessage()
    ]);
}
