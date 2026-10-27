<?php
session_start();
require_once 'assets/backend/config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Método não permitido']);
    exit();
}

if (!$conexao) {
    echo json_encode(['success' => false, 'message' => 'Erro na conexão com o banco de dados']);
    exit();
}

$usuario = trim($_POST['usuario'] ?? '');
$senha = trim($_POST['senha'] ?? '');

if (empty($usuario) || empty($senha)) {
    echo json_encode(['success' => false, 'message' => 'Usuário e senha são obrigatórios']);
    exit();
}

try {
    $stmt = $conexao->prepare("SELECT id, usuario, senha, nome, tipo_conta, ativo FROM usuarios WHERE usuario = ? LIMIT 1");
    $stmt->bind_param("s", $usuario);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Credenciais inválidas']);
        exit();
    }

    $user = $result->fetch_assoc();

    if (!password_verify($senha, $user['senha'])) {
        echo json_encode(['success' => false, 'message' => 'Credenciais inválidas']);
        exit();
    }

    if ($user['ativo'] != 1) {
        echo json_encode(['success' => false, 'message' => 'Conta desativada']);
        exit();
    }

    $_SESSION['usuario'] = $user['usuario'];
    $_SESSION['usuario_id'] = $user['id'];
    $_SESSION['usuario_nome'] = $user['nome'];
    $_SESSION['tipo_conta'] = $user['tipo_conta'];

    $id_usuario = $user['id'];
    $nome_usuario = $user['nome'];
    $ip_acesso = $_SERVER['REMOTE_ADDR']; 

    $log_stmt = $conexao->prepare(
        "INSERT INTO logs_acesso (id_usuario, usuario_nome, ip_acesso, data_login) VALUES (?, ?, ?, NOW())"
    );
    $log_stmt->bind_param('iss', $id_usuario, $nome_usuario, $ip_acesso);
    $log_stmt->execute();

    $_SESSION['log_id'] = $log_stmt->insert_id;
    $log_stmt->close();

    $paginas = [
        'contabil' => 'contabil.php',
        'fiscal' => 'fiscal.php',
        'dp' => 'dp.php',
        'admin' => 'dashboard.php',
        'cadastro' => 'cadastrar.php',
        'cs' => 'cadastrar.php',
        'lider_fiscal' => 'painel_lider.php',
        'lider_dp' => 'painel_lider.php',
        'lider_contabil' => 'painel_lider.php'
    ];

    $redirect = $paginas[$user['tipo_conta']] ?? 'dashboard.php';

    echo json_encode([
        'success' => true,
        'message' => 'Login realizado com sucesso!',
        'redirect' => $redirect
    ]);
} catch (Exception $e) {
    error_log('Erro no login: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Erro no servidor: ' . $e->getMessage()
    ]);
}
