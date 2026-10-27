<?php
require_once 'config.php';
header('Content-Type: application/json');

$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);

if (!$id) {
    echo json_encode(['success' => false, 'message' => 'ID inválido']);
    exit;
}

// 1. Busca os dados numéricos (tabela reinf_detalhes)
$stmt = $conexao->prepare("SELECT * FROM reinf_detalhes WHERE id_controle_fechamento = ?");
$stmt->bind_param('i', $id);
$stmt->execute();
$result = $stmt->get_result();
$dados = $result->fetch_assoc();

// Se não tiver detalhes salvos ainda, cria o array vazio
if (!$dados) {
    $dados = [
        'irrf_1708' => '',
        'crf_5952' => '',
        'inss_prestados' => '',
        'inss_tomados' => '',
        'desoneracao' => '',
        'irrf_3208' => '',
        'outros' => ''
    ];
}

// 2. [NOVO] Busca o status atual na tabela principal (controle_fechamento)
// Precisamos disso para saber se existe uma "Pendência - Nome" salva
$stmt2 = $conexao->prepare("SELECT reinf FROM controle_fechamento WHERE id = ?");
$stmt2->bind_param('i', $id);
$stmt2->execute();
$resMain = $stmt2->get_result()->fetch_assoc();

// Adiciona o status ao array de resposta
$dados['status_atual'] = $resMain['reinf'] ?? '';

echo json_encode(['success' => true, 'dados' => $dados]);
