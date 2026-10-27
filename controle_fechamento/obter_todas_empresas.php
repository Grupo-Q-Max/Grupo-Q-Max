<?php
// obter_todas_empresas.php
session_start();
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once 'assets/backend/config.php';

header('Content-Type: application/json');

// Verifica se o usuário tem permissão de acesso
if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['tipo_conta'], ['admin', 'lider_fiscal'])) {
    echo json_encode(['success' => false, 'message' => 'Acesso não autorizado.']);
    exit();
}

try {
    // Busca todas as empresas ativas na tabela controle_fechamento
    $sql = "
        SELECT id, codigo, empresa, cnpj
        FROM controle_fechamento
        ORDER BY empresa ASC
    ";

    $stmt = $conexao->prepare($sql);
    $stmt->execute();
    $empresas = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    // Retorna os dados como JSON
    echo json_encode(['success' => true, 'empresas' => $empresas]);

    $stmt->close();
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Erro ao buscar empresas: ' . $e->getMessage()]);
}

$conexao->close();
