<?php
session_start();
header('Content-Type: application/json');
require_once 'assets/backend/config.php';

// 1. Verificação de Segurança
if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['tipo_conta'], ['admin', 'lider_dp'])) {
    echo json_encode(['success' => false, 'message' => 'Acesso não autorizado.']);
    exit();
}

// 2. Receber os dados do JavaScript
$coluna = $_POST['coluna'] ?? '';
$valor = $_POST['valor'] ?? null;
$atualizar_todos = isset($_POST['atualizar_todos_meses']) && $_POST['atualizar_todos_meses'] === 'true';

// Recebe os dados condicionais
$id = filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT);
$cnpj = $_POST['cnpj'] ?? null;

// 3. Listas de Colunas Permitidas

$colunas_globais_permitidas = [
    'observacoes_dp',
    'folha_pagamento',
    'data_pagamento',
    'tipo_folha',      // <--- NOVO: Agora replica
    'sd_login',        // <--- NOVO: Agora replica
    'sd_senha',        // <--- NOVO: Agora replica
    // Colunas do 13º
    'ADTO13',
    'FOLHA13',
    'data_calculo_adto13',
    'data_envio_adto13',
    'data_calculo_folha13',
    'data_envio_folha13'
];

$colunas_unicas_permitidas = [
    'adto',
    'qtde_funcionarios',
    'guias_sindicato',
    'dissidio',
    'fgts_digital',
    'e_social',
    'dctf_web_mes',
    'alteracoes_pasta',
    'reinf'
];

// Junta as duas listas
$todas_colunas_permitidas = array_merge($colunas_globais_permitidas, $colunas_unicas_permitidas);

// 4. Validação Inicial
if (empty($coluna) || !in_array($coluna, $todas_colunas_permitidas)) {
    echo json_encode(['success' => false, 'message' => 'Dados inválidos ou coluna não permitida.']);
    exit();
}

// 5. Normalizar string vazia para NULL
if ($valor === '' || $valor === 'null') {
    $valor = NULL;
}

// =======================================================================
// [!] CORREÇÃO 1: LÓGICA HÍBRIDA (DATA ou TEXTO)
// =======================================================================
$colunas_datas = [
    'data_calculo_adto13',
    'data_envio_adto13',
    'data_calculo_folha13',
    'data_envio_folha13'
];

if (in_array($coluna, $colunas_datas) && $valor !== NULL) {
    // Tenta criar um objeto data a partir do formato BR
    $dataObj = DateTime::createFromFormat('d/m/Y', $valor);

    // Se for uma data válida (ex: 25/12/2024), converte para o banco
    if ($dataObj && $dataObj->format('d/m/Y') === $valor) {
        $valor = $dataObj->format('Y-m-d');
    }
    // SE NÃO FOR DATA (ex: "S/ Movimento"), NÃO FAZEMOS NADA.
    // O $valor continua sendo o texto original e será salvo assim.
    // Removemos o 'else { $valor = null; }' que estava apagando seus dados.
}
// =======================================================================


// 6. Preparação e Execução
$sql = "";
$tipos = "";
$params = [];

try {
    // Primeiro, precisamos saber qual é o Mês/Ano da linha que você editou
    // Isso é essencial para a lógica de "Futuro"
    if (!$id) {
        throw new Exception('ID da linha não fornecido.');
    }

    $query_origem = "
        SELECT cm.ano, cm.mes 
        FROM controle_fechamento cf
        JOIN controle_meses cm ON cf.id_mes = cm.id
        WHERE cf.id = ?
    ";
    $stmt_origem = $conexao->prepare($query_origem);
    $stmt_origem->bind_param('i', $id);
    $stmt_origem->execute();
    $resultado_origem = $stmt_origem->get_result()->fetch_assoc();
    $stmt_origem->close();

    if (!$resultado_origem) {
        throw new Exception('Registro original não encontrado.');
    }

    $ano_ref = $resultado_origem['ano'];
    $mes_ref = $resultado_origem['mes'];

    // ---------------------------------------------------------

    if ($atualizar_todos) {
        // --- MODO: ATUALIZAÇÃO GLOBAL (MESES FUTUROS) ---

        // [!] CORREÇÃO 2: Lógica de atualizar apenas do mês atual para frente

        if (!in_array($coluna, $colunas_globais_permitidas)) {
            throw new Exception('Esta coluna não pode ser atualizada globalmente.');
        }
        if (empty($cnpj)) {
            throw new Exception('CNPJ não fornecido para atualização global.');
        }

        // Atualiza onde o CNPJ bate E a data é maior ou igual a atual
        $sql = "
            UPDATE controle_fechamento cf
            INNER JOIN controle_meses cm ON cf.id_mes = cm.id
            SET cf.`{$coluna}` = ?
            WHERE cf.cnpj = ?
            AND (
                cm.ano > ? 
                OR (cm.ano = ? AND cm.mes >= ?)
            )
        ";

        $tipos = "ssiii";
        $params = [$valor, $cnpj, $ano_ref, $ano_ref, $mes_ref];
    } else {
        // --- MODO: ATUALIZAÇÃO ÚNICA (APENAS ESTE MÊS) ---
        $sql = "UPDATE controle_fechamento SET `{$coluna}` = ? WHERE id = ?";
        $tipos = "si";
        $params = [$valor, $id];
    }

    // 8. Execução da Query
    $stmt = $conexao->prepare($sql);
    if ($stmt === false) {
        throw new Exception('Falha ao preparar a query: ' . $conexao->error);
    }

    $stmt->bind_param($tipos, ...$params);

    if ($stmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Atualizado com sucesso.']);
    } else {
        throw new Exception('Falha ao executar a atualização: ' . $stmt->error);
    }

    $stmt->close();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

$conexao->close();
