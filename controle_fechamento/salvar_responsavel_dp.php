<?php
session_start();
header('Content-Type: application/json');
require_once 'assets/backend/config.php';

if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['tipo_conta'], ['admin', 'lider_dp'])) {
    echo json_encode(['success' => false, 'message' => 'Acesso não autorizado.']);
    exit();
}

$id_empresa = filter_input(INPUT_POST, 'id_empresa', FILTER_VALIDATE_INT);
$id_mes = filter_input(INPUT_POST, 'id_mes', FILTER_VALIDATE_INT);
$novo_responsavel_id = filter_input(INPUT_POST, 'novo_responsavel_id', FILTER_VALIDATE_INT);
$tipo_tarefa = 'dp'; 

if (!$id_empresa || !$id_mes || $novo_responsavel_id === null) {
    echo json_encode(['success' => false, 'message' => 'Dados inválidos ou ausentes.']);
    exit();
}

$conexao->begin_transaction();
try {
    $query_delete = "DELETE FROM responsaveis_empresa WHERE id_empresa = ? AND id_mes = ? AND tipo_tarefa = ?";
    $stmt_delete = $conexao->prepare($query_delete);
    $stmt_delete->bind_param('iis', $id_empresa, $id_mes, $tipo_tarefa);
    $stmt_delete->execute();

    if ($novo_responsavel_id > 0) {
        $query_insert = "INSERT INTO responsaveis_empresa (id_empresa, id_usuario, id_mes, tipo_tarefa, responsavel_atual) VALUES (?, ?, ?, ?, 1)";
        $stmt_insert = $conexao->prepare($query_insert);
        $stmt_insert->bind_param('iiis', $id_empresa, $novo_responsavel_id, $id_mes, $tipo_tarefa);
        $stmt_insert->execute();
    }
    $conexao->commit();
    echo json_encode(['success' => true]);
} catch (Exception $e) {
    $conexao->rollback();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro no banco de dados: ' . $e->getMessage()]);
}
?>