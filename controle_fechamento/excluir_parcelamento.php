<?php
// excluir_parcelamento.php
session_start();
require_once 'assets/backend/config.php';

// =======================================================================
// 1. VERIFICAÇÃO DE SEGURANÇA ATUALIZADA
// =======================================================================
// Definimos quem tem permissão para excluir
$permissoes_excluir = ['admin', 'lider_fiscal', 'fiscal'];

if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['tipo_conta'], $permissoes_excluir)) {
    $_SESSION['mensagem_erro'] = 'Você não tem permissão para realizar esta ação.';
    header('Location: tabela_parcelamento.php');
    exit();
}

// 2. Validação do ID recebido via GET
$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
if (!$id) {
    $_SESSION['mensagem_erro'] = 'ID do parcelamento inválido.';
    header('Location: tabela_parcelamento.php');
    exit();
}

try {
    // 3. Buscar as chaves de identificação do parcelamento a partir do ID
    $stmt_select = $conexao->prepare("
        SELECT codigo_empresa, parcelamento, data_efetivacao, valor 
        FROM parcelamentos 
        WHERE id = ?");
    if (!$stmt_select) throw new Exception('Falha ao preparar a consulta de seleção.');

    $stmt_select->bind_param('i', $id);
    $stmt_select->execute();
    $result = $stmt_select->get_result();

    if ($result->num_rows === 0) {
        $_SESSION['mensagem_erro'] = 'Parcelamento não encontrado.';
        header('Location: tabela_parcelamento.php');
        exit();
    }

    $parcelamento_info = $result->fetch_assoc();
    $codigo_empresa = $parcelamento_info['codigo_empresa'];
    $parcelamento_desc = trim($parcelamento_info['parcelamento']);
    $data_efetivacao = $parcelamento_info['data_efetivacao'];
    $valor = $parcelamento_info['valor'];
    $stmt_select->close();

    // 4. Preparar e executar a exclusão de TODOS os registros correspondentes
    // (Exclui todas as parcelas do mesmo acordo)
    $stmt_delete = $conexao->prepare("
        DELETE FROM parcelamentos 
        WHERE codigo_empresa = ? 
        AND TRIM(parcelamento) = ? 
        AND data_efetivacao = ?
        AND valor = ?");
    if (!$stmt_delete) throw new Exception('Falha ao preparar a consulta de exclusão.');

    $stmt_delete->bind_param('sssd', $codigo_empresa, $parcelamento_desc, $data_efetivacao, $valor);

    if ($stmt_delete->execute()) {
        $linhas_afetadas = $stmt_delete->affected_rows;
        $_SESSION['mensagem_sucesso'] = "Parcelamento excluído com sucesso ({$linhas_afetadas} registros removidos).";
    } else {
        throw new Exception('Falha ao executar a exclusão: ' . $stmt_delete->error);
    }
    $stmt_delete->close();
} catch (Exception $e) {
    error_log('Erro ao excluir parcelamento: ' . $e->getMessage());
    $_SESSION['mensagem_erro'] = 'Erro ao excluir o parcelamento. Tente novamente.';
}

// Redireciona de volta para a tabela, tentando manter o ano selecionado
$ano_selecionado = date('Y'); // Padrão
if (isset($_SERVER['HTTP_REFERER'])) {
    $url_anterior = parse_url($_SERVER['HTTP_REFERER']);
    if (isset($url_anterior['query'])) {
        parse_str($url_anterior['query'], $query_params);
        if (isset($query_params['ano'])) {
            $ano_selecionado = $query_params['ano'];
        }
    }
}
header('Location: tabela_parcelamento.php?ano=' . $ano_selecionado);
exit();
