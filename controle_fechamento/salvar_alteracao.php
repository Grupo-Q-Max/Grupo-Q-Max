<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
require_once 'assets/backend/config.php';
session_start();

// --- Função de Log ---
function registrarLog($conexao, $id_usuario, $acao, $nome_empresa, $id_registro, $coluna, $v_antigo, $v_novo, $cnpj = null)
{
    $usuario = $_SESSION['usuario_nome'] ?? 'N/A';
    $tipo = $_SESSION['tipo_conta'] ?? 'N/A';
    $ip = $_SERVER['REMOTE_ADDR'];
    $detalhe = $cnpj ? " (Futuro/CNPJ: $cnpj)" : "";
    $acao_full = $acao . $detalhe;

    $sql = "INSERT INTO logs (id_usuario, nome_usuario, tipo_conta, acao, nome_empresa, id_registro_afetado, coluna_afetada, valor_antigo, valor_novo, ip_usuario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    $stmt = $conexao->prepare($sql);
    // Se for replicação futura, id_registro pode ser o ID gatilho ou NULL. Vamos usar o ID gatilho se disponível.
    $reg_id = $id_registro ?: 0;
    $stmt->bind_param('issssissss', $id_usuario, $usuario, $tipo, $acao_full, $nome_empresa, $reg_id, $coluna, $v_antigo, $v_novo, $ip);
    $stmt->execute();
}

header('Content-Type: application/json');

// --- 1. Verificações ---
$uid = $_SESSION['usuario_id'] ?? 0;
$tipo = $_SESSION['tipo_conta'] ?? '';
if (!$uid || !in_array($tipo, ['dp', 'lider_dp', 'admin'])) {
    echo json_encode(['success' => false, 'message' => 'Acesso negado.']);
    exit();
}

// --- 2. Recebimento ---
$coluna = $_POST['coluna'] ?? '';
$valor = $_POST['valor'] ?? null;
// Força conversão para booleano real
$atualizar_todos = (isset($_POST['atualizar_todos_meses']) && $_POST['atualizar_todos_meses'] === 'true');
$id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT);
$cnpj = $_POST['cnpj'] ?? null;

// --- 3. Validação ---
if (empty($coluna) || !$id) {
    echo json_encode(['success' => false, 'message' => 'Dados incompletos.']);
    exit();
}

// --- 4. Colunas Permitidas (Todas juntas para validar primeiro) ---
$globais = [
    'observacoes_dp',
    'folha_pagamento',
    'data_pagamento',
    'ADTO13',
    'FOLHA13',
    'data_calculo_adto13',
    'tipo_folha',
    'sd_login',
    'sd_senha',
    'data_envio_adto13',
    'data_calculo_folha13',
    'data_envio_folha13',
    'alteracoes_pasta'
];

$unicas = [
    'adto',
    'qtde_funcionarios',
    'guias_sindicato',
    'dissidio',
    'fgts_digital',
    'e_social',
    'dctf_web_mes',
    'reinf'
];

if (!in_array($coluna, array_merge($globais, $unicas))) {
    echo json_encode(['success' => false, 'message' => 'Coluna inválida.']);
    exit();
}

// --- 5. Tratamento de Valor (Data/Texto Híbrido) ---
$valorFinal = ($valor === '' || $valor === 'null') ? NULL : $valor;
$colunas_datas = ['data_calculo_adto13', 'data_envio_adto13', 'data_calculo_folha13', 'data_envio_folha13'];

if (in_array($coluna, $colunas_datas) && $valorFinal !== NULL) {
    // Tenta converter data BR -> SQL. Se falhar, mantém como texto.
    $dataObj = DateTime::createFromFormat('d/m/Y', $valorFinal);
    if ($dataObj && $dataObj->format('d/m/Y') === $valorFinal) {
        $valorFinal = $dataObj->format('Y-m-d');
    }
}

// --- 6. Execução ---
try {
    // A. Busca info do registro original (para saber Ano/Mês base)
    $q_origem = "SELECT cf.id_mes, cf.empresa, cf.`$coluna` as antigo, cm.mes, cm.ano 
                 FROM controle_fechamento cf 
                 JOIN controle_meses cm ON cf.id_mes = cm.id 
                 WHERE cf.id = ?";
    $stmt = $conexao->prepare($q_origem);
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $origem = $stmt->get_result()->fetch_assoc();

    if (!$origem) throw new Exception('Registro original não encontrado.');

    $ano_ref = $origem['ano'];
    $mes_ref = $origem['mes'];
    $empresa_nome = $origem['empresa'];
    $valor_antigo = $origem['antigo'];

    // B. Define a Query de Update
    if ($atualizar_todos) {
        // --- MODO REPLICAÇÃO FUTURA ---

        // Segurança extra: só permite se estiver na lista global e tiver CNPJ
        if (!in_array($coluna, $globais)) throw new Exception("Coluna não permite replicação.");
        if (empty($cnpj)) throw new Exception("CNPJ necessário para replicação.");

        // Query Otimizada para MySQL
        $sql = "UPDATE controle_fechamento cf
                JOIN controle_meses cm ON cf.id_mes = cm.id
                SET cf.`{$coluna}` = ?
                WHERE cf.cnpj = ? 
                AND (cm.ano > ? OR (cm.ano = ? AND cm.mes >= ?))";

        $stmt_up = $conexao->prepare($sql);
        $stmt_up->bind_param('ssiii', $valorFinal, $cnpj, $ano_ref, $ano_ref, $mes_ref);
        $acao = 'EDIÇÃO (FUTURO)';
    } else {
        // --- MODO SIMPLES (Só este mês) ---

        // Verifica se mês está liberado (apenas para edição simples, geralmente)
        if ($tipo !== 'admin') { // Admin sempre pode
            $q_status = "SELECT edicao_status FROM controle_meses WHERE id = ?";
            $stmt_s = $conexao->prepare($q_status);
            $stmt_s->bind_param('i', $origem['id_mes']);
            $stmt_s->execute();
            $status = $stmt_s->get_result()->fetch_assoc();
            if (($status['edicao_status'] ?? '') !== 'liberada') {
                throw new Exception('Mês fechado para edição.');
            }
        }

        $sql = "UPDATE controle_fechamento SET `{$coluna}` = ? WHERE id = ?";
        $stmt_up = $conexao->prepare($sql);
        $stmt_up->bind_param('si', $valorFinal, $id);
        $acao = 'EDIÇÃO';
    }

    // C. Executa
    if (!$stmt_up->execute()) {
        throw new Exception("Erro SQL: " . $stmt_up->error);
    }

    $afetados = $stmt_up->affected_rows;

    if ($afetados > 0) {
        registrarLog($conexao, $uid, $acao, $empresa_nome, $id, $coluna, $valor_antigo, $valorFinal, ($atualizar_todos ? $cnpj : null));
        echo json_encode(['success' => true, 'message' => "Salvo com sucesso ($afetados registros)."]);
    } else {
        echo json_encode(['success' => true, 'message' => 'Valor idêntico, nada alterado.']);
    }
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Erro: ' . $e->getMessage()]);
}
$conexao->close();
