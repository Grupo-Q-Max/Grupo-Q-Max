<?php
// obter_dados_empresa_completo.php

require_once 'assets/backend/config.php';
session_start();

header('Content-Type: application/json');

if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['tipo_conta'], ['admin', 'cs', 'cadastro','lider_fiscal'])) { // Inclui 'cs' e 'cadastro'
    echo json_encode(['success' => false, 'message' => 'Acesso não autorizado para carregar dados da empresa.']);
    exit();
}

$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
if (!$id) {
    echo json_encode(['success' => false, 'message' => 'ID da empresa inválido.']);
    exit();
}

try {
    // A query agora seleciona TODAS as colunas necessárias
    $stmt = $conexao->prepare("SELECT * FROM controle_fechamento WHERE id = ?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $empresa = $result->fetch_assoc();
        echo json_encode(['success' => true, 'empresa' => $empresa]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Empresa não encontrada.']);
    }

    $stmt->close();
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Erro no servidor: ' . $e->getMessage()]);
}

$conexao->close();
