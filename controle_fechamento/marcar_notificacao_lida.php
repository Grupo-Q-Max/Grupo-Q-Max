<?php
require_once 'assets/backend/config.php';

header('Content-Type: application/json');

session_start();
if (!isset($_SESSION['usuario_id'])) {
    echo json_encode(['success' => false, 'message' => 'Não autorizado']);
    exit();
}

$id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT);
if (!$id) {
    echo json_encode(['success' => false, 'message' => 'ID inválido']);
    exit();
}

try {
    $stmt = $conexao->prepare("
        UPDATE notificacoes 
        SET lida = TRUE 
        WHERE id = ? AND id_usuario = ?
    ");
    $stmt->bind_param('ii', $id, $_SESSION['usuario_id']);
    $stmt->execute();
    
    echo json_encode(['success' => true]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Erro ao marcar como lida']);
}