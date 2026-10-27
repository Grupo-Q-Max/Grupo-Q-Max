<?php
// salvar_parcela.php
session_start();
header('Content-Type: application/json'); // Define que a resposta será em JSON

require_once 'assets/backend/config.php';

// Array de resposta padrão
$response = ['success' => false, 'message' => 'Acesso não autorizado.'];

// 1. Validação de segurança e permissão
$tipos_permitidos = ['admin', 'lider_fiscal', 'fiscal'];
if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['tipo_conta'], $tipos_permitidos)) {
    echo json_encode($response);
    exit();
}

// 2. Validação dos dados recebidos via POST
if (!isset($_POST['id']) || !isset($_POST['coluna']) || !isset($_POST['valor'])) {
    $response['message'] = 'Dados incompletos.';
    echo json_encode($response);
    exit();
}

$id = filter_var($_POST['id'], FILTER_VALIDATE_INT);
$coluna = $_POST['coluna'];
$valor = trim($_POST['valor']);

// 3. Whitelist para o nome da coluna para evitar SQL Injection
$colunas_permitidas = [
    'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

if (!$id || !in_array($coluna, $colunas_permitidas)) {
    $response['message'] = 'Dados inválidos.';
    echo json_encode($response);
    exit();
}

// 4. Preparar e executar a atualização no banco de dados
try {
    // A coluna é segura pois foi validada contra a whitelist
    $sql = "UPDATE parcelamentos SET `{$coluna}` = ? WHERE id = ?";
    $stmt = $conexao->prepare($sql);
    
    if ($stmt === false) {
        throw new Exception('Falha ao preparar a query: ' . $conexao->error);
    }

    $stmt->bind_param('si', $valor, $id);

    if ($stmt->execute()) {
        $response['success'] = true;
        $response['message'] = 'Dados salvos com sucesso!';
    } else {
        $response['message'] = 'Erro ao executar a atualização.';
    }

    $stmt->close();
    $conexao->close();

} catch (Exception $e) {
    $response['message'] = 'Erro no servidor: ' . $e->getMessage();
}

echo json_encode($response);