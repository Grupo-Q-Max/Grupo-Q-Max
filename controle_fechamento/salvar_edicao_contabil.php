<?php
session_start();
header('Content-Type: application/json');

// Adiciona um log de erros para nos ajudar a depurar, se necessário
ini_set('display_errors', 1);
ini_set('log_errors', 1);
error_reporting(E_ALL);

require_once 'assets/backend/config.php';

// Apenas admin ou líder contábil podem salvar.
if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['tipo_conta'], ['admin', 'lider_contabil'])) {
    echo json_encode(['success' => false, 'message' => 'Acesso não autorizado.']);
    exit();
}

$id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT);
$coluna = $_POST['coluna'] ?? '';
// O valor pode ser vazio, então não o validamos na entrada.
$valor = $_POST['valor'] ?? null;

// Lista de colunas permitidas para edição (essencial para segurança)
$colunas_permitidas = [
    'observacoes_contabil',
    'janeiro',
    'fevereiro',
    'marco',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro',
    'balancete',
    'distribuicao_dirf',
    'defs',
    'dasn',
    'ecd',
    'ecf'
];

if (!$id || empty($coluna) || !in_array($coluna, $colunas_permitidas) || $valor === null) {
    echo json_encode(['success' => false, 'message' => 'Dados inválidos ou coluna não permitida.']);
    exit();
}

try {
    // Usamos backticks (`) para o nome da coluna, pois é uma variável.
    $query = "UPDATE controle_fechamento SET `{$coluna}` = ? WHERE id = ?";
    $stmt = $conexao->prepare($query);

    if ($stmt === false) {
        throw new Exception('Falha ao preparar a consulta: ' . $conexao->error);
    }

    // 's' para o valor (string), 'i' para o id (integer).
    $stmt->bind_param('si', $valor, $id);

    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        throw new Exception('Falha ao executar a atualização: ' . $stmt->error);
    }
} catch (Exception $e) {
    // Retorna um erro 500 para o AJAX e a mensagem de erro
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
