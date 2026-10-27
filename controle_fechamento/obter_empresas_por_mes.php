<?php
// obter_empresas_por_mes.php (VERSÃO 2.0)
require_once 'assets/backend/config.php';
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['usuario_id']) || $_SESSION['tipo_conta'] !== 'admin') {
    echo json_encode(['success' => false, 'data' => []]);
    exit();
}

$id_mes = filter_input(INPUT_GET, 'id_mes', FILTER_VALIDATE_INT);
$modo = $_GET['modo'] ?? 'completo'; // 'completo' ou 'apenas_cnpj'

if (!$id_mes) {
    echo json_encode(['success' => false, 'data' => []]);
    exit();
}

// Se o modo for 'apenas_cnpj', retorna uma lista simples de CNPJs
if ($modo === 'apenas_cnpj') {
    $stmt = $conexao->prepare("SELECT cnpj FROM controle_fechamento WHERE id_mes = ? AND cnpj IS NOT NULL AND cnpj != ''");
    $stmt->bind_param('i', $id_mes);
    $stmt->execute();
    $resultado = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    echo json_encode(['success' => true, 'data' => array_column($resultado, 'cnpj')]);
}
// Senão, retorna os dados completos das empresas como antes
else {
    $stmt = $conexao->prepare("SELECT id, codigo, empresa, cnpj, setores_permitidos FROM controle_fechamento WHERE id_mes = ? AND (data_saida IS NULL OR data_saida > CURDATE()) ORDER BY empresa ASC");
    $stmt->bind_param('i', $id_mes);
    $stmt->execute();
    $resultado = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    echo json_encode(['success' => true, 'data' => $resultado]);
}

$conexao->close();
