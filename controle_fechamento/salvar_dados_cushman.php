<?php
// salvar_dados_cushman.php

require_once 'assets/backend/config.php';
session_start();
header('Content-Type: application/json');

// --- Validações de Segurança ---
$tipo_conta_logado = $_SESSION['tipo_conta'] ?? '';
if ($tipo_conta_logado !== 'admin' && $tipo_conta_logado !== 'cadastro') {
    echo json_encode(['success' => false, 'message' => 'Acesso não autorizado.']);
    exit();
}

if (!isset($_POST['id']) || !isset($_POST['coluna']) || !isset($_POST['valor'])) {
    echo json_encode(['success' => false, 'message' => 'Dados incompletos.']);
    exit();
}

// --- Listas de Colunas ---
// (Esta seção permanece inalterada)
$colunas_especificas_mes = [
    'iss_cushman',
    'devec_cushman',
    'sped_fiscal_cushman',
    'reinf_cushman',
    'esocial_cushman'
];
$colunas_cadastro_global = [
    'municipio',
    'certificado_cliente',
    'tipo_certificado',
    'senha_certificado',
    'data_emissao_certificado',
    'data_vencimento_certificado',
    'data_procuracao_target',
    'insc_municipal',
    'login_prefeitura',
    'senha_prefeitura_ginfes',
    'link_prefeitura',
    'senha_giss_online',
    'insc_estadual',
    'observacoes',
    'data_contrato',
    'data_obrigacao',
    'data_saida'
];
$colunas_permitidas = array_merge($colunas_especificas_mes, $colunas_cadastro_global);

// --- Limpeza e Validação dos Dados ---
$id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT);
$coluna = trim($_POST['coluna']);
$valor = trim($_POST['valor']); // O valor é limpo aqui. Se estiver vazio, será ''.

if (!$id || !in_array($coluna, $colunas_permitidas)) {
    echo json_encode(['success' => false, 'message' => 'Parâmetros inválidos ou coluna não permitida.']);
    exit();
}

// --- Conversão de Datas (Lógica da correção anterior) ---
$colunas_de_data = [
    'data_emissao_certificado',
    'data_vencimento_certificado',
    'data_procuracao_target',
    'data_contrato', // Adicionado
    'data_obrigacao', // Adicionado
    'data_saida' // Adicionado
];
if (in_array($coluna, $colunas_de_data) && !empty($valor)) {
    $dateObj = DateTime::createFromFormat('d/m/Y', $valor);
    if ($dateObj) {
        $valor = $dateObj->format('Y-m-d');
    } else {
        echo json_encode(['success' => false, 'message' => 'Formato de data inválido. Use DD/MM/AAAA.']);
        exit();
    }
}


// ===================================================================
// INÍCIO DA NOVA CORREÇÃO: Converter string vazia para NULL
// ===================================================================

/**
 * DOCUMENTAÇÃO DA MUDANÇA:
 * 1. Após toda a limpeza e formatação, verificamos se a variável `$valor`
 * é uma string estritamente vazia ('').
 * 2. Se for, nós a redefinimos para o valor `null` do PHP.
 * 3. Isso se aplica a TODOS os campos (texto, data, etc.). Quando o
 * usuário apagar o conteúdo de qualquer célula, ela será salva
 * como NULL no banco de dados.
 */
if ($valor === '') {
    $valor = null;
}

// ===================================================================
// FIM DA NOVA CORREÇÃO
// ===================================================================


// --- Lógica de Atualização Híbrida ---
$conexao->begin_transaction();
try {
    // Se a coluna editada for um DADO GLOBAL...
    if (in_array($coluna, $colunas_cadastro_global)) {
        // 1. Precisamos do CNPJ para atualizar todos os registros da empresa
        $stmt_find_cnpj = $conexao->prepare("SELECT cnpj FROM controle_fechamento WHERE id = ?");
        $stmt_find_cnpj->bind_param('i', $id);
        $stmt_find_cnpj->execute();
        $resultado = $stmt_find_cnpj->get_result()->fetch_assoc();
        $stmt_find_cnpj->close();

        if (!$resultado || empty($resultado['cnpj'])) {
            throw new Exception('CNPJ da empresa não encontrado.');
        }
        $cnpj_empresa = $resultado['cnpj'];

        // 2. Atualiza TODAS as linhas com esse CNPJ
        $query = "UPDATE controle_fechamento SET `{$coluna}` = ? WHERE cnpj = ?";
        $stmt_update = $conexao->prepare($query);
        // O 's' no bind_param funciona corretamente com strings e com null
        $stmt_update->bind_param('ss', $valor, $cnpj_empresa);
    } else { // Se a coluna for um DADO ESPECÍFICO DO MÊS...
        // Atualiza apenas a linha específica pelo ID
        $query = "UPDATE controle_fechamento SET `{$coluna}` = ? WHERE id = ?";
        $stmt_update = $conexao->prepare($query);
        // O 's' no bind_param funciona corretamente com strings e com null
        $stmt_update->bind_param('si', $valor, $id);
    }

    // Executa a query preparada
    if ($stmt_update->execute()) {
        $conexao->commit();
        echo json_encode(['success' => true, 'message' => 'Dados salvos com sucesso!']);
    } else {
        throw new Exception($stmt_update->error);
    }

    $stmt_update->close();
} catch (Exception $e) {
    $conexao->rollback();
    echo json_encode(['success' => false, 'message' => 'Erro no banco de dados: ' . $e->getMessage()]);
}

$conexao->close();
