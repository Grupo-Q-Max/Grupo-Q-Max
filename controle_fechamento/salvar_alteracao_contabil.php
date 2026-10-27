<?php
session_start();
require_once 'assets/backend/config.php';

function registrarLog($conexao, $id_usuario, $acao, $nome_empresa, $id_registro_afetado, $coluna_afetada, $valor_antigo, $valor_novo)
{
    $nome_usuario = $_SESSION['usuario_nome'] ?? 'Não encontrado';
    $tipo_conta = $_SESSION['tipo_conta'] ?? 'Não encontrado';
    $ip_usuario = $_SERVER['REMOTE_ADDR'] ?? 'Não encontrado';

    $query = "INSERT INTO logs (id_usuario, nome_usuario, tipo_conta, acao, nome_empresa, id_registro_afetado, coluna_afetada, valor_antigo, valor_novo, ip_usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    $stmt = $conexao->prepare($query);
    $stmt->bind_param('issssissss', $id_usuario, $nome_usuario, $tipo_conta, $acao, $nome_empresa, $id_registro_afetado, $coluna_afetada, $valor_antigo, $valor_novo, $ip_usuario);
    $stmt->execute();
    $stmt->close();
}

header('Content-Type: application/json');

$usuario_id_logado = $_SESSION['usuario_id'] ?? 0;
$tipo_conta_logado = $_SESSION['tipo_conta'] ?? '';
$permissoes_permitidas = ['contabil', 'lider_contabil', 'admin'];

if (!$usuario_id_logado || !in_array($tipo_conta_logado, $permissoes_permitidas)) {
    echo json_encode(['success' => false, 'message' => 'Acesso não autorizado para esta ação.']);
    exit();
}

if (!isset($_POST['id'], $_POST['coluna'], $_POST['valor'])) {
    echo json_encode(['success' => false, 'message' => 'Parâmetros incompletos.']);
    exit();
}

$id = intval($_POST['id']);
$coluna = trim($_POST['coluna']);
$valor = trim($_POST['valor']);

$colunasContabeis = [
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

if (!in_array($coluna, $colunasContabeis)) {
    echo json_encode(['success' => false, 'message' => 'Coluna não permitida para edição.']);
    exit();
}

try {
    $query_select_antigo = "SELECT empresa, `$coluna` as valor_antigo_coluna FROM controle_fechamento WHERE id = ?";
    $stmt_select = $conexao->prepare($query_select_antigo);
    $stmt_select->bind_param('i', $id);
    $stmt_select->execute();
    $res = $stmt_select->get_result()->fetch_assoc();
    $stmt_select->close();

    if (!$res) {
        echo json_encode(['success' => false, 'message' => 'Registro da empresa não encontrado.']);
        exit();
    }

    $nome_empresa = $res['empresa'];
    $valor_antigo_log = $res['valor_antigo_coluna'];
} catch (Exception $e) {
    error_log('Erro ao buscar dados para log contábil: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Erro ao preparar dados para auditoria.']);
    exit();
}


try {
    $conexao->begin_transaction();

    $query_update = "UPDATE controle_fechamento SET `$coluna` = ? WHERE id = ?";
    $stmt_update = $conexao->prepare($query_update);
    $valorFinal = ($valor === '') ? NULL : $valor;
    $stmt_update->bind_param('si', $valorFinal, $id);
    $stmt_update->execute();
    $stmt_update->close();

    $query_verificacao = "SELECT " . implode(', ', $colunasContabeis) . " FROM controle_fechamento WHERE id = ?";
    $stmt_verificacao = $conexao->prepare($query_verificacao);
    $stmt_verificacao->bind_param('i', $id);
    $stmt_verificacao->execute();
    $dados_empresa = $stmt_verificacao->get_result()->fetch_assoc();
    $stmt_verificacao->close();

    $todos_preenchidos = true;
    foreach ($colunasContabeis as $campo) {
        if (empty($dados_empresa[$campo]) || $dados_empresa[$campo] === 'Não é cliente') {
            $todos_preenchidos = false;
            break;
        }
    }

    $novo_status = $todos_preenchidos ? 'completo' : 'pendente';
    $query_status = "UPDATE controle_fechamento SET status_contabil = ? WHERE id = ?";
    $stmt_status = $conexao->prepare($query_status);
    $stmt_status->bind_param('si', $novo_status, $id);
    $stmt_status->execute();
    $stmt_status->close();

    if ($valor_antigo_log !== $valorFinal) {
        registrarLog(
            $conexao,
            $usuario_id_logado,
            'EDIÇÃO',
            $nome_empresa,
            $id,
            $coluna,
            $valor_antigo_log,
            $valorFinal
        );
    }

    $conexao->commit();

    echo json_encode(['success' => true, 'message' => 'Alteração salva com sucesso!']);
} catch (Exception $e) {
    $conexao->rollback();
    error_log('Erro ao salvar alteração contábil: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Erro no banco de dados. A alteração foi desfeita.']);
}
