<?php
session_start();
require_once 'assets/backend/config.php';

if (isset($_SESSION['log_id'])) {
    $log_id = $_SESSION['log_id'];

    $stmt = $conexao->prepare(
        "UPDATE logs_acesso SET ultima_atividade = NOW() WHERE id = ? AND data_logout IS NULL"
    );
    $stmt->bind_param('i', $log_id);
    $stmt->execute();
    $stmt->close();

    echo json_encode(['success' => true, 'timestamp' => date('Y-m-d H:i:s')]);
} else {
    echo json_encode(['success' => false, 'message' => 'Sessão não encontrada.']);
}
exit();
