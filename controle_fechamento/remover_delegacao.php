<?php
require 'assets/backend/config.php';
session_start();

if ($_SESSION['tipo_conta'] !== 'admin') {
    header('HTTP/1.1 403 Forbidden');
    echo json_encode(['success' => false, 'message' => 'Acesso não autorizado']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delegacao_id'])) {
    $delegacao_id = intval($_POST['delegacao_id']);
    
    $sql = "DELETE FROM responsaveis_empresa WHERE id = ?";
    $stmt = $conexao->prepare($sql);
    
    if ($stmt === false) {
        header('HTTP/1.1 500 Internal Server Error');
        echo json_encode(['success' => false, 'message' => 'Erro ao preparar a query: ' . $conexao->error]);
        exit();
    }
    
    $stmt->bind_param('i', $delegacao_id);
    
    if ($stmt->execute()) {
        if ($stmt->affected_rows > 0) {
            echo json_encode(['success' => true, 'message' => 'Delegação removida com sucesso']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Nenhuma delegação encontrada com o ID fornecido']);
        }
    } else {
        header('HTTP/1.1 500 Internal Server Error');
        echo json_encode(['success' => false, 'message' => 'Erro ao executar a query: ' . $stmt->error]);
    }
    
    $stmt->close();
} else {
    header('HTTP/1.1 400 Bad Request');
    echo json_encode(['success' => false, 'message' => 'Requisição inválida']);
}

$conexao->close();
?>