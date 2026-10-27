<?php
require_once 'config.php';
header('Content-Type: application/json');

$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);

if (!$id) {
    echo json_encode(['success' => false, 'message' => 'ID inválido']);
    exit;
}

// 1. Busca os detalhes numéricos (tabela impostos_detalhes)
$stmt = $conexao->prepare("SELECT * FROM impostos_detalhes WHERE id_controle_fechamento = ?");
$stmt->bind_param('i', $id);
$stmt->execute();
$result = $stmt->get_result();
$dados = $result->fetch_assoc();

if (!$dados) {
    $dados = [
        'faturamento' => '',
        'iss_prestados' => '',
        'iss_tomados' => '',
        'das' => '',
        'darf_pis_cofins' => '',
        'darf_irpj_csll' => '',
        'icms' => '',
        'outros' => ''
    ];
} else {
    // Garante que chaves existam mesmo se o banco retornar null
    $dados['icms'] = $dados['icms'] ?? '';
    $dados['outros'] = $dados['outros'] ?? '';
}

// 2. [NOVO] Busca o status atual na tabela principal (controle_fechamento)
// Isso permite mostrar "Status Atual: Pendência - Nome" dentro do modal
$stmt2 = $conexao->prepare("SELECT impostos FROM controle_fechamento WHERE id = ?");
$stmt2->bind_param('i', $id);
$stmt2->execute();
$resMain = $stmt2->get_result()->fetch_assoc();

// Adiciona o status ao array de resposta
$dados['status_atual'] = $resMain['impostos'] ?? '';

echo json_encode(['success' => true, 'dados' => $dados]);
