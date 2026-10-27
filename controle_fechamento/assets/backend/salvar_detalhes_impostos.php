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

// --- NOVO: Recebe o status forçado pelo JavaScript ---
$status_forced = trim($_POST['status_forced'] ?? '');

// Recebe dados com trim
$faturamento      = trim($_POST['faturamento'] ?? '');
$iss_prestados    = trim($_POST['iss_prestados'] ?? '');
$iss_tomados      = trim($_POST['iss_tomados'] ?? '');
$das              = trim($_POST['das'] ?? '');
$darf_pis_cofins  = trim($_POST['darf_pis_cofins'] ?? '');
$darf_irpj_csll   = trim($_POST['darf_irpj_csll'] ?? '');
$icms             = trim($_POST['icms'] ?? '');
$outros           = trim($_POST['outros'] ?? '');

// 1. Salva Detalhes (Insert ou Update na tabela auxiliar)
// Mantemos isso igual para salvar os números digitados mesmo se for N/A
$check = $conexao->prepare("SELECT id FROM impostos_detalhes WHERE id_controle_fechamento = ?");
$check->bind_param('i', $id_controle);
$check->execute();
$res = $check->get_result();

if ($res->num_rows > 0) {
    // ATUALIZAÇÃO (UPDATE)
    $sql = "UPDATE impostos_detalhes SET 
            faturamento=?, 
            iss_prestados=?, 
            iss_tomados=?, 
            das=?, 
            darf_pis_cofins=?, 
            darf_irpj_csll=?, 
            icms=?, 
            outros=?, 
            usuario_atualizacao=?, 
            data_atualizacao=NOW() 
            WHERE id_controle_fechamento=?";

    $stmt = $conexao->prepare($sql);
    $stmt->bind_param('ssssssssii', $faturamento, $iss_prestados, $iss_tomados, $das, $darf_pis_cofins, $darf_irpj_csll, $icms, $outros, $usuario_id, $id_controle);
} else {
    // INSERÇÃO (INSERT)
    $sql = "INSERT INTO impostos_detalhes 
            (id_controle_fechamento, faturamento, iss_prestados, iss_tomados, das, darf_pis_cofins, darf_irpj_csll, icms, outros, usuario_atualizacao) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

    $stmt = $conexao->prepare($sql);
    $stmt->bind_param('issssssssi', $id_controle, $faturamento, $iss_prestados, $iss_tomados, $das, $darf_pis_cofins, $darf_irpj_csll, $icms, $outros, $usuario_id);
}

if ($stmt->execute()) {

    // 2. Define o Status (AQUI MUDOU A LÓGICA)

    $status_texto = null;

    // Cenário A: Veio status forçado do botão (N/A, Pendência ou OK - Data)
    if (!empty($status_forced)) {
        $status_texto = $status_forced;
    }
    // Cenário B: Cálculo automático (Verifica se campos obrigatórios estão cheios)
    else {
        $campos_obrigatorios = [
            $faturamento,
            $iss_prestados,
            $iss_tomados,
            $das,
            $darf_pis_cofins,
            $darf_irpj_csll,
            $icms
        ];

        $esta_completo = true;
        foreach ($campos_obrigatorios as $valor) {
            if ($valor === '') {
                $esta_completo = false;
                break;
            }
        }

        // Se estiver tudo preenchido, define "Preenchido" (ou Pendente se faltar algo)
        $status_texto = $esta_completo ? "Preenchido" : "Pendente";
    }

    // Atualiza tabela principal (controle_fechamento)
    $upd = $conexao->prepare("UPDATE controle_fechamento SET impostos = ? WHERE id = ?");
    $upd->bind_param('si', $status_texto, $id_controle);

    if ($upd->execute()) {
        echo json_encode(['success' => true, 'novo_status' => $status_texto]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Erro ao atualizar status: ' . $upd->error]);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Erro ao salvar detalhes: ' . $stmt->error]);
}
