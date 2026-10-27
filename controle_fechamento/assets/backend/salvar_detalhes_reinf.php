<?php
session_start();
require_once 'config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['usuario_id'])) {
    echo json_encode(['success' => false, 'message' => 'Não autorizado']);
    exit;
}

$id_controle = filter_input(INPUT_POST, 'id_controle', FILTER_VALIDATE_INT);
$usuario_id = $_SESSION['usuario_id'];

if (!$id_controle) {
    echo json_encode(['success' => false, 'message' => 'ID Inválido']);
    exit;
}

// --- NOVO: Recebe o status forçado pelo JavaScript (N/A, Pendência ou OK - Data) ---
$status_forced = trim($_POST['status_forced'] ?? '');

// Recebe os dados e remove espaços (trim)
$irrf_1708      = trim($_POST['irrf_1708'] ?? '');
$crf_5952       = trim($_POST['crf_5952'] ?? '');
$inss_prestados = trim($_POST['inss_prestados'] ?? '');
$inss_tomados   = trim($_POST['inss_tomados'] ?? '');
$desoneracao    = trim($_POST['desoneracao'] ?? '');
$irrf_3208      = trim($_POST['irrf_3208'] ?? '');
$outros         = trim($_POST['outros'] ?? ''); // Opcional

// 1. Salva os detalhes (Insert ou Update) na tabela auxiliar
// (Isso continua igual, pois queremos salvar os números mesmo que o status seja N/A)
$check = $conexao->prepare("SELECT id FROM reinf_detalhes WHERE id_controle_fechamento = ?");
$check->bind_param('i', $id_controle);
$check->execute();
$res = $check->get_result();

if ($res->num_rows > 0) {
    $sql = "UPDATE reinf_detalhes SET irrf_1708=?, crf_5952=?, inss_prestados=?, inss_tomados=?, desoneracao=?, irrf_3208=?, outros=?, usuario_atualizacao=?, data_atualizacao=NOW() WHERE id_controle_fechamento=?";
    $stmt = $conexao->prepare($sql);
    $stmt->bind_param('sssssssii', $irrf_1708, $crf_5952, $inss_prestados, $inss_tomados, $desoneracao, $irrf_3208, $outros, $usuario_id, $id_controle);
} else {
    $sql = "INSERT INTO reinf_detalhes (id_controle_fechamento, irrf_1708, crf_5952, inss_prestados, inss_tomados, desoneracao, irrf_3208, outros, usuario_atualizacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
    $stmt = $conexao->prepare($sql);
    $stmt->bind_param('isssssssi', $id_controle, $irrf_1708, $crf_5952, $inss_prestados, $inss_tomados, $desoneracao, $irrf_3208, $outros, $usuario_id);
}

if ($stmt->execute()) {

    // 2. Define o Status da Tabela Principal (AQUI ESTÁ A MUDANÇA IMPORTANTE)

    $status_texto = null;

    // Cenário A: O JavaScript mandou um status específico (N/A, Pendência... ou OK - Data)
    if (!empty($status_forced)) {
        $status_texto = $status_forced;
    }
    // Cenário B: Não veio forçado, calculamos se está tudo preenchido (Fallback)
    else {
        $campos_obrigatorios = [
            $irrf_1708,
            $crf_5952,
            $inss_prestados,
            $inss_tomados,
            $desoneracao,
            $irrf_3208
        ];

        $esta_completo = true;
        foreach ($campos_obrigatorios as $valor) {
            if ($valor === '') {
                $esta_completo = false;
                break;
            }
        }

        // Se estiver completo pela verificação manual, salva "Preenchido" (ou usa o OK do JS se preferir)
        // Se faltar algo, salva "Pendente"
        $status_texto = $esta_completo ? "Preenchido" : "Pendente";
    }

    // Atualiza a tabela principal (controle_fechamento)
    $upd = $conexao->prepare("UPDATE controle_fechamento SET reinf = ? WHERE id = ?");
    $upd->bind_param('si', $status_texto, $id_controle);

    if ($upd->execute()) {
        echo json_encode(['success' => true, 'novo_status' => $status_texto]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Erro ao atualizar status: ' . $upd->error]);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Erro ao salvar detalhes: ' . $stmt->error]);
}
