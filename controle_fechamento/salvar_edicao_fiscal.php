<?php
session_start();
header('Content-Type: application/json');
require_once 'assets/backend/config.php';

if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['tipo_conta'], ['admin','fiscal', 'lider_fiscal'])) {
    echo json_encode(['success' => false, 'message' => 'Acesso não autorizado.']);
    exit();
}

$id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT);
$coluna = $_POST['coluna'] ?? '';
$valor = $_POST['valor'] ?? null;
if ($valor === '') {
    $valor = null;
}
$colunas_permitidas = [
    'observacoes_fiscal',
    'reinf',
    'impostos',
    'iss',
    'mit',
    'dec_estadual',
    'sped_fiscal',
    'sped_contribuicao',
    'destda',
    'gia',
    'dctf',
    'dasnmei',
    'taxa_fiscal',
	'distribuicao_dirf',
'alteracoes_pasta'
];

if (!$id || empty($coluna) || !in_array($coluna, $colunas_permitidas)) {
    echo json_encode(['success' => false, 'message' => 'Dados inválidos ou coluna não permitida.']);
    exit();
}

try {
    $query = "UPDATE controle_fechamento SET `{$coluna}` = ? WHERE id = ?";
    $stmt = $conexao->prepare($query);
    $stmt->bind_param('si', $valor, $id);

    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        throw new Exception('Falha ao executar a atualização: ' . $stmt->error);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
