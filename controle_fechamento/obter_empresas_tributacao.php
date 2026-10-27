<?php
require 'assets/backend/config.php';

header('Content-Type: application/json');

if (!isset($_GET['mes_id'])) {
    echo json_encode(['success' => false, 'message' => 'ID do mês não fornecido']);
    exit();
}

if (!isset($_GET['tributacao'])) {
    echo json_encode(['success' => false, 'message' => 'Tributação não fornecida']);
    exit();
}

$mes_id = intval($_GET['mes_id']);
$tributacao = $_GET['tributacao'];

// ✅ BLOCO DE VERIFICAÇÃO REMOVIDO DAQUI
// A consulta agora é flexível e aceita qualquer tributação.

// Verifica se o mês existe no banco de dados
$sql_verificar_mes = "SELECT id FROM controle_meses WHERE id = ?";
$stmt_check = $conexao->prepare($sql_verificar_mes);
$stmt_check->bind_param('i', $mes_id);
$stmt_check->execute();
if ($stmt_check->get_result()->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'Mês não encontrado']);
    exit();
}
$stmt_check->close();

// Consulta principal para buscar as empresas
$sql = "SELECT 
    empresa, 
    DATE_FORMAT(data_contrato, '%d/%m/%Y') as data_contrato,
    DATE_FORMAT(data_obrigacao, '%d/%m/%Y') as data_obrigacao
FROM controle_fechamento
WHERE id_mes = ? AND tributacao = ? AND (data_saida IS NULL OR data_saida > CURDATE())
ORDER BY empresa";

$stmt = $conexao->prepare($sql);
$stmt->bind_param('is', $mes_id, $tributacao);
$stmt->execute();
$result = $stmt->get_result();

$empresas = $result->fetch_all(MYSQLI_ASSOC);

echo json_encode([
    'success' => true,
    'empresas' => $empresas
]);
