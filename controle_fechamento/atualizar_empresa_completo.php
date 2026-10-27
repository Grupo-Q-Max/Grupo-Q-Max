<?php
// atualizar_empresa_completo.php

session_start();
header('Content-Type: application/json');

require_once 'assets/backend/config.php';

if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['tipo_conta'], ['admin', 'cs', 'cadastro','lider_fiscal'])) { // Adicionado 'cs' e 'cadastro'
    $_SESSION['mensagem'] = 'Acesso restrito.'; // Mensagem mais genérica
    header('Location: index.php');
    exit();
}

// Usamos uma transação para garantir a integridade dos dados
$conexao->begin_transaction();

try {
    // 1. Pega o ID da linha editada (obrigatório para encontrar o CNPJ)
    if (!isset($_POST['id']) || !filter_input(INPUT_POST, 'id', FILTER_VALIDATE_INT)) {
        throw new Exception('ID da empresa inválido ou ausente.');
    }
    $id_linha_editada = (int)$_POST['id'];

    // 2. Busca o CNPJ da empresa usando o ID da linha. O CNPJ será nossa chave de atualização.
    $stmt_find_cnpj = $conexao->prepare("SELECT cnpj FROM controle_fechamento WHERE id = ?");
    if ($stmt_find_cnpj === false) {
        throw new Exception('Erro ao preparar a busca pelo CNPJ: ' . $conexao->error);
    }
    $stmt_find_cnpj->bind_param('i', $id_linha_editada);
    $stmt_find_cnpj->execute();
    $resultado = $stmt_find_cnpj->get_result()->fetch_assoc();
    $stmt_find_cnpj->close();

    if (!$resultado || empty($resultado['cnpj'])) {
        throw new Exception('Não foi possível encontrar a empresa ou o CNPJ está em branco.');
    }
    $cnpj_da_empresa = $resultado['cnpj'];


    // 3. Lista de colunas que podem ser editadas
    $colunas_permitidas = [
        'codigo',
        'empresa',
        'cnpj',
        'grupo',
        'insc_municipal',
        'insc_estadual',
        'municipio',
        'tributacao',
        'login_prefeitura',
        'senha_prefeitura_ginfes',
        'senha_giss_online',
        'data_contrato',
        'data_obrigacao',
        'data_saida',
        'observacoes_fiscal',
        'setores_permitidos',
        'certificado_cliente',
        'tipo_certificado',
        'senha_certificado',
        'data_emissao_certificado',
        'data_vencimento_certificado',
        'data_procuracao_target'
    ];

    $update_fields = [];
    $params = [];
    $types = '';

    // 4. Monta a query dinamicamente com os campos enviados
    foreach ($colunas_permitidas as $coluna) {
        if (isset($_POST[$coluna])) {
            $update_fields[] = "`{$coluna}` = ?";
            $valor = trim($_POST[$coluna]);

            // Lista de colunas de data que devem ser NULAS se vazias
            $colunas_de_data = [
                'data_contrato',
                'data_obrigacao',
                'data_saida',
                'data_emissao_certificado',
                'data_vencimento_certificado',
                'data_procuracao_target'
            ];

            if ($valor === '' && in_array($coluna, $colunas_de_data)) {
                $params[] = null;
            } else {
                $params[] = $valor;
            }
            // Define o tipo como string 's' para todos, MySQL faz a conversão
            $types .= 's';
        }
    }
    $setores_validos_obs = ['fiscal', 'dp', 'contabil', 'cushman'];

    if (isset($_POST['observacao_setor'], $_POST['observacao_texto'])) {
        $setor_observacao = $_POST['observacao_setor'];
        $texto_observacao = trim($_POST['observacao_texto']);

        // Validação de segurança: verifica se o setor enviado é um dos permitidos
        if (in_array($setor_observacao, $setores_validos_obs)) {
            // Se for válido, monta o nome da coluna dinamicamente
            $coluna_observacao = "observacoes_" . $setor_observacao;

            // Adiciona à query de atualização
            $update_fields[] = "`{$coluna_observacao}` = ?";
            $params[] = $texto_observacao;
            $types .= 's';
        }
    }
    if (empty($update_fields)) {
        throw new Exception('Nenhum dado válido para atualizar foi enviado.');
    }

    // 5. Constrói a query SQL final usando `WHERE cnpj = ?`
    $sql = "UPDATE controle_fechamento SET " . implode(', ', $update_fields) . " WHERE cnpj = ?";

    // Adiciona o CNPJ (string) ao final dos parâmetros
    $params[] = $cnpj_da_empresa;
    $types .= 's'; // 's' para string (CNPJ)

    // 6. Prepara e executa a query
    $stmt = $conexao->prepare($sql);
    if ($stmt === false) {
        throw new Exception('Erro ao preparar a consulta de atualização: ' . $conexao->error);
    }

    $stmt->bind_param($types, ...$params);

    if ($stmt->execute()) {
        // Se a execução foi bem-sucedida, confirmamos as alterações no banco
        $conexao->commit();
        echo json_encode(['success' => true, 'message' => 'Dados atualizados com sucesso para todos os meses!']);
    } else {
        throw new Exception('Falha ao atualizar no banco de dados: ' . $stmt->error);
    }

    $stmt->close();
} catch (Exception $e) {
    // Se qualquer erro ocorrer, desfazemos todas as alterações
    $conexao->rollback();
    echo json_encode(['success' => false, 'message' => 'Erro no servidor: ' . $e->getMessage()]);
}

$conexao->close();
