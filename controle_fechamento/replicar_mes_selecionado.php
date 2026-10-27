<?php
// replicar_mes_selecionado.php (VERSÃO CORRETA E ATUALIZADA)

ini_set('display_errors', 1);
error_reporting(E_ALL);
session_start();

require_once 'assets/backend/config.php';

header('Content-Type: application/json');

// --- VALIDAÇÃO E SEGURANÇA ---
if (!isset($_SESSION['usuario_id']) || $_SESSION['tipo_conta'] !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'Acesso não autorizado. Apenas administradores podem executar esta ação.']);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Método de requisição inválido.']);
    exit();
}

// --- COLETA DE DADOS DO FORMULÁRIO ---
$id_mes_destino = $_POST['id_mes_destino'] ?? null;
$id_mes_base = filter_input(INPUT_POST, 'id_mes_base', FILTER_VALIDATE_INT);
$ids_empresas = $_POST['ids_empresas'] ?? []; // Array com os IDs das empresas a replicar

// Validação básica dos dados recebidos
if (!$id_mes_base || !is_array($ids_empresas) || empty($ids_empresas)) {
    echo json_encode(['success' => false, 'message' => 'Dados inválidos. Mês base e pelo menos uma empresa devem ser selecionados.']);
    exit();
}

$conexao->begin_transaction();

try {
    $id_mes_final = 0; // Variável que guardará o ID do mês de destino

    // --- LÓGICA CONDICIONAL: CRIAR NOVO MÊS OU USAR UM EXISTENTE ---

    // CENÁRIO 1: O usuário escolheu "CRIAR NOVO MÊS"
    if ($id_mes_destino === 'criar_novo') {
        $novo_mes = filter_input(INPUT_POST, 'novo_mes', FILTER_VALIDATE_INT);
        $novo_ano = filter_input(INPUT_POST, 'novo_ano', FILTER_VALIDATE_INT);

        if (!$novo_mes || !$novo_ano) {
            throw new Exception("Mês ou ano para criação não foram fornecidos.");
        }

        // Verifica se o mês/ano já não existe
        $stmt_check = $conexao->prepare("SELECT id FROM controle_meses WHERE mes = ? AND ano = ?");
        $stmt_check->bind_param('ii', $novo_mes, $novo_ano);
        $stmt_check->execute();
        if ($stmt_check->get_result()->num_rows > 0) {
            throw new Exception("O mês {$novo_mes}/{$novo_ano} já existe no sistema.");
        }
        $stmt_check->close();

        // Insere o novo mês na tabela de meses
        $stmt_mes = $conexao->prepare("INSERT INTO controle_meses (mes, ano, status) VALUES (?, ?, 'fechado')");
        $stmt_mes->bind_param('ii', $novo_mes, $novo_ano);
        $stmt_mes->execute();
        $id_mes_final = $conexao->insert_id;
        if ($id_mes_final === 0) {
            throw new Exception("Falha ao criar o registro para o novo mês.");
        }

        // CENÁRIO 2: O usuário escolheu um MÊS JÁ EXISTENTE
    } else {
        $id_mes_final = filter_var($id_mes_destino, FILTER_VALIDATE_INT);
        if (!$id_mes_final) {
            throw new Exception("O mês de destino selecionado é inválido.");
        }
    }

    // --- LÓGICA DE REPLICAÇÃO (COMUM A AMBOS OS CENÁRIOS) ---

    // Cria os placeholders (?) para a cláusula IN da query, de forma segura
    $placeholders = implode(',', array_fill(0, count($ids_empresas), '?'));

    // 1. Replicar os dados das EMPRESAS selecionadas
    $tipos_emp = 'i' . str_repeat('i', count($ids_empresas)) . 'i';
    $params_emp = array_merge([$id_mes_final], $ids_empresas, [$id_mes_final]);
    $query_empresas = "
        INSERT INTO controle_fechamento (
            codigo, empresa, cnpj, grupo, insc_estadual, insc_municipal, 
            login_prefeitura, senha_prefeitura_ginfes, senha_giss_online, 
            link_prefeitura, tributacao, tipo, envio, municipio, 
            data_contrato, data_obrigacao, data_saida, observacoes,
            observacoes_dp, observacoes_fiscal, observacoes_contabil, observacoes_cushman,
            setores_permitidos, certificado_cliente, tipo_certificado, 
            senha_certificado, data_emissao_certificado, data_vencimento_certificado,
            data_procuracao_target, qtde_funcionarios, id_mes, 
            status, adto, folha_pagamento, data_pagamento, 
            guias_sindicato, dissidio, fgts_digital, e_social, 
            dctf_web_mes, reinf,
            iss_cushman, devec_cushman, sped_fiscal_cushman, reinf_cushman, esocial_cushman
        )
        SELECT 
            antiga.codigo, antiga.empresa, antiga.cnpj, antiga.grupo, antiga.insc_estadual, antiga.insc_municipal, 
            antiga.login_prefeitura, antiga.senha_prefeitura_ginfes, antiga.senha_giss_online, 
            antiga.link_prefeitura, antiga.tributacao, antiga.tipo, antiga.envio, antiga.municipio, 
            antiga.data_contrato, antiga.data_obrigacao, antiga.data_saida, antiga.observacoes,
            antiga.observacoes_dp, antiga.observacoes_fiscal, antiga.observacoes_contabil, antiga.observacoes_cushman,
            antiga.setores_permitidos, antiga.certificado_cliente, antiga.tipo_certificado, 
            antiga.senha_certificado, antiga.data_emissao_certificado, antiga.data_vencimento_certificado,
            antiga.data_procuracao_target, antiga.qtde_funcionarios, 
            ?, -- id_mes_final
            'Pendente', NULL, NULL, NULL, 
            NULL, antiga.dissidio, NULL, NULL, 
            NULL, NULL,

            -- LÓGICA CONDICIONAL PARA CAMPOS CUSHMAN
            CASE WHEN TRIM(UPPER(antiga.iss_cushman)) = 'N/TEM' THEN 'N/TEM' ELSE NULL END,
            CASE WHEN TRIM(UPPER(antiga.devec_cushman)) = 'N/TEM' THEN 'N/TEM' ELSE NULL END,
            CASE WHEN TRIM(UPPER(antiga.sped_fiscal_cushman)) = 'N/TEM' THEN 'N/TEM' ELSE NULL END,
            CASE WHEN TRIM(UPPER(antiga.reinf_cushman)) = 'N/TEM' THEN 'N/TEM' ELSE NULL END,
            CASE WHEN TRIM(UPPER(antiga.esocial_cushman)) = 'N/TEM' THEN 'N/TEM' ELSE NULL END

        FROM controle_fechamento AS antiga
        WHERE antiga.id IN ($placeholders) AND (antiga.data_saida IS NULL OR antiga.data_saida > CURDATE())
        AND NOT EXISTS (SELECT 1 FROM controle_fechamento existente WHERE existente.cnpj = antiga.cnpj AND existente.id_mes = ?)";
    // ==============================================================================
        
    $stmt_empresas = $conexao->prepare($query_empresas);
    $stmt_empresas->bind_param($tipos_emp, ...$params_emp);
    $stmt_empresas->execute();
    $empresas_replicadas = $stmt_empresas->affected_rows;

    // 2. Replicar os RESPONSÁVEIS das empresas selecionadas
    $tipos_resp = 'ii' . str_repeat('i', count($ids_empresas));
    $params_resp = array_merge([$id_mes_final, $id_mes_final], $ids_empresas);
    $query_responsaveis = "
        INSERT INTO responsaveis_empresa (id_empresa, id_usuario, id_mes, responsavel_atual, tipo_tarefa, data_atribuicao)
        SELECT nova_empresa.id, re.id_usuario, ?, re.responsavel_atual, re.tipo_tarefa, NOW()
        FROM responsaveis_empresa re
        JOIN controle_fechamento empresa_antiga ON re.id_empresa = empresa_antiga.id
        JOIN controle_fechamento nova_empresa ON TRIM(empresa_antiga.cnpj) = TRIM(nova_empresa.cnpj) AND nova_empresa.id_mes = ?
        WHERE re.id_empresa IN ($placeholders)
        GROUP BY nova_empresa.id, re.id_usuario, re.responsavel_atual, re.tipo_tarefa";

    $stmt_responsaveis = $conexao->prepare($query_responsaveis);
    $stmt_responsaveis->bind_param($tipos_resp, ...$params_resp);
    $stmt_responsaveis->execute();
    $responsaveis_replicados = $stmt_responsaveis->affected_rows;

    // Se tudo deu certo, confirma as alterações no banco de dados
    $conexao->commit();

    echo json_encode(['success' => true, 'message' => "Operação concluída! {$empresas_replicadas} novas empresas e {$responsaveis_replicados} atribuições foram adicionadas com sucesso."]);
} catch (Exception $e) {
    // Se algo deu errado, desfaz todas as alterações
    $conexao->rollback();
    echo json_encode(['success' => false, 'message' => 'Erro: ' . $e->getMessage()]);
}

$conexao->close();
