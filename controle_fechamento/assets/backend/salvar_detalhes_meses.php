<?php
session_start();
// Adicione o display_errors para conseguirmos ver o erro real se acontecer de novo
ini_set('display_errors', 0);
error_reporting(E_ALL);

require_once 'config.php';
header('Content-Type: application/json');

if (!isset($_SESSION['usuario_id'])) {
    echo json_encode(['success' => false, 'message' => 'Não autorizado - Sessão inválida']);
    exit;
}

$id = filter_input(INPUT_POST, 'id_controle', FILTER_VALIDATE_INT);

if (!$id) {
    echo json_encode(['success' => false, 'message' => 'ID Inválido']);
    exit;
}

// Lista dos meses
$meses_cols = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
$valores = [];
$types = '';
$completo = true;

// Prepara os dados
foreach ($meses_cols as $mes) {
    // Se o campo estiver disabled no front (não enviado), consideramos vazio ou mantemos o anterior?
    // Por segurança, vamos assumir string vazia se não vier nada.
    $val = trim($_POST[$mes] ?? '');
    $valores[] = $val;
    $types .= 's';

    // Verifica se está vazio para definir o status da bolinha
    if ($val === '') {
        $completo = false;
    }
}

// Adiciona o ID para o WHERE
$valores[] = $id;
$types .= 'i';

// --- CORREÇÃO: Removido usuario_atualizacao e data_atualizacao para evitar erro de coluna inexistente ---
$sql = "UPDATE controle_fechamento SET 
        janeiro=?, fevereiro=?, marco=?, abril=?, maio=?, junho=?, 
        julho=?, agosto=?, setembro=?, outubro=?, novembro=?, dezembro=?
        WHERE id=?";

$stmt = $conexao->prepare($sql);

if (!$stmt) {
    echo json_encode(['success' => false, 'message' => 'Erro na query: ' . $conexao->error]);
    exit;
}

// Bind dinâmico
$bind_names = [];
$bind_names[] = $types;
for ($i = 0; $i < count($valores); $i++) {
    $bind_names[] = &$valores[$i];
}

call_user_func_array([$stmt, 'bind_param'], $bind_names);

if ($stmt->execute()) {
    // Retorna o status calculado na hora
    $novo_status = $completo ? 'Completo' : 'Pendente';
    echo json_encode(['success' => true, 'novo_status' => $novo_status]);
} else {
    echo json_encode(['success' => false, 'message' => 'Erro ao salvar: ' . $stmt->error]);
}
