<?php
// 1. Configurações de Cabeçalho e Cache
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");
header('Content-Type: application/json; charset=utf-8');

// 2. Tenta carregar o config de forma inteligente
if (file_exists('config.php')) {
    require_once 'config.php';
} elseif (file_exists('../config.php')) {
    require_once '../config.php';
} else {
    echo json_encode(['success' => false, 'message' => 'Erro crítico: Arquivo config.php não encontrado.']);
    exit;
}

session_start();

// 3. Recebe e Sanitiza os dados
// Usa $_REQUEST para garantir que pegue tanto GET quanto POST se houver confusão, mas foca no POST
$idRaw = $_POST['id_controle'] ?? '';
$id = filter_var($idRaw, FILTER_VALIDATE_INT);

// Corrige o problema do array vazio: Se não vier nada, define como array vazio
$meses = isset($_POST['meses']) ? $_POST['meses'] : [];
if (!is_array($meses)) {
    $meses = []; // Garante que sempre seja array
}

$statusPronto = trim($_POST['status_formatado'] ?? '');

// 4. Validações Básicas
if (!$id) {
    echo json_encode([
        'success' => false,
        'message' => 'ID da empresa não foi recebido ou é inválido.',
        'debug_id_recebido' => $idRaw
    ]);
    exit;
}

// 5. Lógica do Status (Fallback de segurança)
// Se por algum motivo o JS mandou o status vazio, recalculamos aqui.
if (empty($statusPronto)) {
    $qtd = count($meses);
    if ($qtd === 12) {
        $statusPronto = 'OK - ' . date('d/m/Y');
    } else {
        $statusPronto = 'Pendente (' . $qtd . '/12)';
    }
}

// 6. Prepara o JSON dos checkboxes para salvar
// O JSON_UNESCAPED_UNICODE ajuda a não bugar acentos se houver
$jsonDetalhes = json_encode($meses, JSON_UNESCAPED_UNICODE);

// 7. Atualiza no Banco de Dados
// Usamos a conexão que veio do config.php
if (!$conexao) {
    echo json_encode(['success' => false, 'message' => 'Erro de conexão com o banco de dados.']);
    exit;
}

$sql = "UPDATE controle_fechamento SET sped_anual_detalhes = ?, sped_contribuicao = ? WHERE id = ?";
$stmt = $conexao->prepare($sql);

if (!$stmt) {
    echo json_encode(['success' => false, 'message' => 'Erro na preparação da query: ' . $conexao->error]);
    exit;
}

$stmt->bind_param('ssi', $jsonDetalhes, $statusPronto, $id);

if ($stmt->execute()) {
    // Verifica se alguma linha foi realmente alterada (opcional, mas bom pra debug)
    // Se o valor já era o mesmo, affected_rows será 0, mas success é true.

    echo json_encode([
        'success' => true,
        'novo_status' => $statusPronto,
        'completo' => (count($meses) === 12),
        'debug' => [
            'meses_salvos' => $meses,
            'status_recebido' => $statusPronto
        ]
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Erro ao gravar no SQL: ' . $stmt->error]);
}

$stmt->close();
$conexao->close();
