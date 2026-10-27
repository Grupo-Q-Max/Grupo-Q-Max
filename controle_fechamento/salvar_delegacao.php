<?php
require 'assets/backend/config.php'; // Inclui sua conexão com o banco
session_start();
header('Content-Type: application/json');

// --- 1. Segurança e Validação de Acesso ---
// (Estou usando a mesma lógica de segurança do seu script de parcelamento)
if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['tipo_conta'], ['admin', 'lider_fiscal'])) {
    echo json_encode(['success' => false, 'message' => 'Acesso não autorizado para delegar tarefas.']);
    exit();
}

// --- 2. Validação da Requisição ---
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Requisição inválida.']);
    exit();
}

// --- 3. Coleta dos Dados ---
// Recebemos os dados que o JavaScript enviou
$id_empresa           = (int)($_POST['id_empresa'] ?? 0);
$id_usuario           = (int)($_POST['id_usuario'] ?? 0);
$id_mes               = (int)($_POST['id_mes'] ?? 0);
$tipo_tarefa          = $_POST['tipo_tarefa'] ?? ''; // "fiscal_parcelamento"
$nome_empresa_avulsa  = $_POST['nome_empresa_avulsa'] ?? ''; // Nome da empresa (para o caso avulso)


// --- 4. Lógica Principal (A Mágica está aqui) ---

// CASO 1: PARCELAMENTO AVULSO (id_empresa = 0)
// Se for "Avulso", o parcelamento foi salvo, mas não podemos criar uma
// delegação na tabela 'responsaveis_empresa', pois ela exige um ID de empresa válido.
// Retornamos 'success' para o usuário não ver um erro, pois o parcelamento FOI salvo.
if ($id_empresa === 0) {
    echo json_encode([
        'success' => true,
        'message' => 'Parcelamento avulso salvo. A delegação de tarefa não se aplica, pois não está vinculada a uma empresa interna.'
    ]);
    exit();
}


// CASO 2: PARCELAMENTO PADRÃO (id_empresa > 0)
// Validamos se temos todos os dados para criar a delegação
if (empty($id_usuario) || empty($id_mes) || empty($tipo_tarefa)) {
    echo json_encode(['success' => false, 'message' => 'Dados incompletos para delegar (usuário, mês ou tipo).']);
    exit();
}

// Usamos a mesma lógica do seu arquivo de exemplo (delegar_tarefa):
// Tenta INSERIR a delegação.
// Se já existir uma chave duplicada (mesma empresa, mês e tipo de tarefa),
// ele apenas ATUALIZA o 'id_usuario' para o novo responsável selecionado.
$sql_upsert = "
    INSERT INTO responsaveis_empresa 
        (id_empresa, id_usuario, tipo_tarefa, id_mes) 
    VALUES 
        (?, ?, ?, ?) 
    ON DUPLICATE KEY UPDATE 
        id_usuario = VALUES(id_usuario)
";

$stmt = $conexao->prepare($sql_upsert);

if ($stmt === false) {
    // Log de erro (idealmente)
    echo json_encode(['success' => false, 'message' => 'Erro interno ao preparar a consulta (SQL).']);
    exit();
}

// "iisi" = Integer, Integer, String, Integer
$stmt->bind_param('iisi', $id_empresa, $id_usuario, $tipo_tarefa, $id_mes);

if ($stmt->execute()) {
    // Verificamos se algo foi alterado (affected_rows)
    // Se for 0, a tarefa já estava delegada para aquele usuário.
    // Se for 1, foi uma nova inserção.
    // Se for 2, foi uma atualização (delete + insert, comum no 'ON DUPLICATE KEY UPDATE').
    $message = "Tarefa de parcelamento delegada com sucesso!";
    if ($stmt->affected_rows === 0) {
        $message = "Tarefa já estava delegada para este usuário.";
    }

    echo json_encode(['success' => true, 'message' => $message]);
} else {
    // Log de erro (idealmente)
    echo json_encode(['success' => false, 'message' => 'Erro ao executar a delegação no banco de dados.']);
}

$stmt->close();
$conexao->close();
