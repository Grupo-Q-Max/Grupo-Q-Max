<?php
session_start();
ini_set('display_errors', 1);
error_reporting(E_ALL);

// O config.php já contém a conexão E a função obterMesAtualAberto.
require_once 'assets/backend/config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_POST['salvar_parcelamento'])) {
    echo json_encode(['success' => false, 'message' => 'Requisição inválida.']);
    exit();
}

// 1. Obter o ID do mês atualmente aberto
$id_mes_atual = obterMesAtualAberto($conexao);
if ($id_mes_atual === false) {
    echo json_encode(['success' => false, 'message' => 'ERRO CRÍTICO: Não há um mês aberto no sistema. Contate o administrador.']);
    exit();
}

// 2. CORREÇÃO: Buscar o ANO correspondente ao mês aberto
$ano_atual = null;
$stmt_ano = $conexao->prepare("SELECT ano FROM controle_meses WHERE id = ?");
if ($stmt_ano) {
    $stmt_ano->bind_param('i', $id_mes_atual);
    $stmt_ano->execute();
    $result_ano = $stmt_ano->get_result()->fetch_assoc();
    if ($result_ano) {
        $ano_atual = $result_ano['ano'];
    }
    $stmt_ano->close();
}

if ($ano_atual === null) {
    echo json_encode(['success' => false, 'message' => 'ERRO CRÍTICO: Não foi possível determinar o ano para o mês aberto.']);
    exit();
}

// 3. Recebe todos os dados do formulário
$codigo_empresa = $_POST['codigo_empresa'] ?? '';
$nome_empresa = $_POST['nome_empresa'] ?? '';
$cnpj_empresa = $_POST['cnpj_empresa'] ?? '';
$parcelamento = $_POST['parcelamento'] ?? '';
$qtde_parcelas = $_POST['qtde_parcelas'] ?? null;
$data_efetivacao = $_POST['data_efetivacao'] ?? '';
$data_final = $_POST['data_final'] ?? '';
$valor = $_POST['valor'] ?? '';
$id_usuario = $_POST['id_usuario'] ?? null;

// Lógica de validação básica
if (empty($codigo_empresa) || empty($nome_empresa) || empty($cnpj_empresa) || empty($data_efetivacao) || empty($data_final) || empty($valor)) {
    echo json_encode(['success' => false, 'message' => 'Campos obrigatórios do parcelamento não preenchidos.']);
    exit();
}

$qtde_parcelas = !empty($qtde_parcelas) ? (int)$qtde_parcelas : null;
$id_usuario = !empty($id_usuario) ? (int)$id_usuario : null;

// 4. Query SQL atualizada para incluir a coluna 'ano'
$sql = "
    INSERT INTO parcelamentos 
    (codigo_empresa, nome_empresa, cnpj_empresa, parcelamento, qtde_parcelas, data_efetivacao, data_final, valor, id_usuario, id_mes, ano)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
";

$stmt = $conexao->prepare($sql);
if ($stmt === false) {
    echo json_encode(['success' => false, 'message' => 'Erro ao preparar a consulta: ' . $conexao->error]);
    exit();
}

// 5. bind_param atualizado com o tipo 'i' para o ano
$stmt->bind_param(
    'ssssissdiii', // s(string), i(integer), d(double)
    $codigo_empresa,
    $nome_empresa,
    $cnpj_empresa,
    $parcelamento,
    $qtde_parcelas,
    $data_efetivacao,
    $data_final,
    $valor,
    $id_usuario,
    $id_mes_atual,
    $ano_atual // Passando o ano do mês atual
);

if ($stmt->execute()) {
    echo json_encode(['success' => true, 'message' => 'Parcelamento salvo com sucesso!']);
} else {
    echo json_encode(['success' => false, 'message' => 'Erro ao salvar parcelamento: ' . $stmt->error]);
}

$stmt->close();
$conexao->close();
