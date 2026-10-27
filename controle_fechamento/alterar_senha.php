<?php
require_once 'assets/backend/config.php';

session_start();

header('Content-Type: application/json');

$usuario_id = $_SESSION['usuario_id'] ?? 0;

if (!$usuario_id) {
    echo json_encode(['success' => false, 'message' => 'Acesso não autorizado. Faça login novamente.']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Método de requisição inválido.']);
    exit();
}

$senha_atual = $_POST['senha_atual'] ?? '';
$nova_senha = $_POST['nova_senha'] ?? '';
$confirmar_senha = $_POST['confirmar_senha'] ?? '';

if (empty($senha_atual) || empty($nova_senha) || empty($confirmar_senha)) {
    echo json_encode(['success' => false, 'message' => 'Todos os campos são obrigatórios.']);
    exit();
}

if ($nova_senha !== $confirmar_senha) {
    echo json_encode(['success' => false, 'message' => 'As novas senhas não coincidem.']);
    exit();
}

if (strlen($nova_senha) < 8) {
    echo json_encode(['success' => false, 'message' => 'A nova senha deve ter pelo menos 8 caracteres.']);
    exit();
}

$conexao->begin_transaction();
$sucesso = false;
$mensagem = '';

try {
    $stmt_select = $conexao->prepare("SELECT senha FROM usuarios WHERE id = ?");
    if (!$stmt_select) {
        throw new Exception("Erro no prepare SELECT: " . $conexao->error);
    }
    $stmt_select->bind_param('i', $usuario_id);
    $stmt_select->execute();
    $result = $stmt_select->get_result();
    $usuario = $result->fetch_assoc();
    $stmt_select->close();

    if (!$usuario) {
        throw new Exception("Usuário não encontrado.");
    }

    if (!password_verify($senha_atual, $usuario['senha'])) {
        throw new Exception("A senha atual está incorreta.");
    }

    if (password_verify($nova_senha, $usuario['senha'])) {
        throw new Exception("A nova senha não pode ser igual à senha atual.");
    }

    $nova_senha_hash = password_hash($nova_senha, PASSWORD_DEFAULT);

    $update_stmt = $conexao->prepare("UPDATE usuarios SET senha = ? WHERE id = ?");
    if (!$update_stmt) {
        throw new Exception("Erro no prepare UPDATE: " . $conexao->error);
    }
    $update_stmt->bind_param('si', $nova_senha_hash, $usuario_id);
    $update_stmt->execute();

    if ($update_stmt->affected_rows > 0) {
        $conexao->commit(); // Confirma a transação
        session_regenerate_id(true); // Regenera o ID da sessão para segurança
        $sucesso = true;
        $mensagem = 'Senha alterada com sucesso!';
    } else {
        $conexao->rollback();
        throw new Exception("Nenhuma alteração foi realizada.");
    }
    $update_stmt->close();
} catch (Exception $e) {
    $conexao->rollback(); // Desfaz a transação em caso de erro
    $mensagem = $e->getMessage();
}

// 7. Retorna a resposta final para o frontend
echo json_encode([
    'success' => $sucesso,
    'message' => $mensagem
]);

$conexao->close();
