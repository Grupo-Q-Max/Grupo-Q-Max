<?php
// =======================================================================
// == FORÇAR O NAVEGADOR A NÃO FAZER CACHE DESTA RESPOSTA (IMPORTANTE) ==
// =======================================================================
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");
// =======================================================================

require_once 'config.php'; // Ajuste o caminho se necessário
header('Content-Type: application/json');

$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);

if (!$id) {
    echo json_encode(['success' => false, 'message' => 'ID inválido']);
    exit;
}

// Prepara a consulta
$stmt = $conexao->prepare("SELECT sped_anual_detalhes FROM controle_fechamento WHERE id = ?");
$stmt->bind_param('i', $id);
$stmt->execute();
$res = $stmt->get_result()->fetch_assoc();

// Garante que se o campo for nulo, decodifica uma string JSON vazia '{}'
$dados_json = $res['sped_anual_detalhes'] ?? '{}';

// Verifica se o dado no banco já é um JSON válido ou se está vazio
if (empty($dados_json)) {
    $dados_json = '{}';
}

// Retorna o JSON salvo
echo json_encode(['success' => true, 'dados' => json_decode($dados_json)]);
