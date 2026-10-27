<?php
function obterGruposDistintosContabil($conexao)
{
    $query = "
        SELECT DISTINCT grupo 
        FROM controle_fechamento 
        WHERE grupo IS NOT NULL AND grupo != '' 
          AND (
                setores_permitidos IS NULL 
                OR setores_permitidos = '' 
                OR FIND_IN_SET('contabil', REPLACE(setores_permitidos, ' ', '')) > 0
            )
        ORDER BY grupo
    ";
    $stmt = $conexao->prepare($query);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

function obterTributacoesDistintasContabil($conexao)
{
    $query = "
        SELECT DISTINCT tributacao 
        FROM controle_fechamento 
        WHERE tributacao IS NOT NULL AND tributacao != '' 
          AND (
                setores_permitidos IS NULL 
                OR setores_permitidos = '' 
                OR FIND_IN_SET('contabil', REPLACE(setores_permitidos, ' ', '')) > 0
            )
        ORDER BY tributacao
    ";
    $stmt = $conexao->prepare($query);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

function obterEmpresasContabeisAdmin($conexao, $ano_selecionado, $mes_selecionado_id, $filtros = [])
{
    // Partes da query
    $select_clause = "
        SELECT 
            cf.*,
            cm.id as id_mes,
            cm.mes as mes_numero,
            u.id as responsavel_id,
            u.nome as responsavel_nome
    ";
    $from_clause = "
        FROM controle_fechamento cf
        JOIN controle_meses cm ON cf.id_mes = cm.id
        LEFT JOIN responsaveis_empresa re ON cf.id = re.id_empresa AND cm.id = re.id_mes AND re.tipo_tarefa = 'contabil'
        LEFT JOIN usuarios u ON re.id_usuario = u.id
    ";
    $where_conditions = [];
    $params = [];
    $types = '';

    // 1. Condição do Ano (Fundamental)
    $where_conditions[] = "cm.ano = ?";
    $params[] = $ano_selecionado;
    $types .= 'i';

    // 2. Filtro de Setores
    $where_conditions[] = "(
        cf.setores_permitidos IS NULL 
        OR cf.setores_permitidos = '' 
        OR FIND_IN_SET('contabil', REPLACE(cf.setores_permitidos, ' ', '')) > 0
    )";

    // 3. Remove MEI
    $where_conditions[] = "cf.tributacao != 'mei'";

    // ==========================================================
    // ||       CORREÇÃO CRÍTICA: SELEÇÃO DO MÊS CORRETO       ||
    // ==========================================================
    // Em vez de filtrar por "cf.id_mes = ?", que esconde empresas que saíram antes
    // do mês selecionado, usamos uma subquery para pegar o ID_MES mais recente
    // disponível para aquela empresa dentro do ano selecionado.

    $where_conditions[] = "cf.id_mes = (
        SELECT MAX(sub_cf.id_mes)
        FROM controle_fechamento sub_cf
        JOIN controle_meses sub_cm ON sub_cf.id_mes = sub_cm.id
        WHERE sub_cf.cnpj = cf.cnpj 
          AND sub_cm.ano = ?
    )";
    $params[] = $ano_selecionado;
    $types .= 'i';

    // ==========================================================
    // ||             LÓGICA DE FILTRO DE STATUS               ||
    // ==========================================================
    $status = $filtros['status'] ?? 'ativas';

    if ($status === 'ativas') {
        // Mostra empresas ativas OU que saíram APÓS o início do ano
        $where_conditions[] = "YEAR(cf.data_contrato) <= ? AND (cf.data_saida IS NULL OR YEAR(cf.data_saida) >= ?)";
        $params[] = $ano_selecionado;
        $params[] = $ano_selecionado;
        $types .= 'ii';
    } elseif ($status === 'inativas') {
        // Mostra APENAS empresas cuja data de saída foi no ano selecionado
        $where_conditions[] = "YEAR(cf.data_saida) = ?";
        $params[] = $ano_selecionado;
        $types .= 'i';
    }
    // Se for 'todas', não aplica filtro extra de data_saida

    // Filtros de busca textual
    if (!empty($filtros['busca'])) {
        $where_conditions[] = "(cf.empresa LIKE ? OR cf.cnpj LIKE ? OR cf.codigo LIKE ?)";
        $busca_param = "%" . $filtros['busca'] . "%";
        array_push($params, $busca_param, $busca_param, $busca_param);
        $types .= "sss";
    }

    // Filtro de Responsável
    if (isset($filtros['responsavel_id']) && $filtros['responsavel_id'] !== '') {
        if ($filtros['responsavel_id'] == '0') {
            $where_conditions[] = "u.id IS NULL";
        } else {
            $where_conditions[] = "u.id = ?";
            $params[] = $filtros['responsavel_id'];
            $types .= "i";
        }
    }

    // Filtro de Tributação
    if (!empty($filtros['tributacao'])) {
        $where_conditions[] = "cf.tributacao = ?";
        $params[] = $filtros['tributacao'];
        $types .= "s";
    }

    // Filtro de Grupo
    if (!empty($filtros['grupo'])) {
        $where_conditions[] = "cf.grupo = ?";
        $params[] = $filtros['grupo'];
        $types .= "s";
    }

    // --- ORDENAÇÃO ---
    $colunas_permitidas = ['codigo' => 'CAST(cf.codigo AS UNSIGNED)', 'empresa' => 'cf.empresa', 'tributacao' => 'cf.tributacao'];
    $sort_column = $filtros['sort'] ?? 'empresa';
    $sort_dir = (strtoupper($filtros['dir'] ?? 'ASC') === 'DESC') ? 'DESC' : 'ASC';
    $coluna_ordenacao = $colunas_permitidas[$sort_column] ?? $colunas_permitidas['empresa'];

    $orderByClause = "ORDER BY {$coluna_ordenacao} {$sort_dir}";

    // Montagem final da query
    $query_final = $select_clause . $from_clause . " WHERE " . implode(" AND ", $where_conditions) . " " . $orderByClause;

    $stmt = $conexao->prepare($query_final);
    if ($stmt === false) {
        die("Erro na preparação da query: " . $conexao->error);
    }

    // Bind dinâmico de parâmetros
    if (!empty($types) && !empty($params)) {
        $bind_names = [];
        $bind_names[] = $types;
        for ($i = 0; $i < count($params); $i++) {
            $bind_names[] = &$params[$i];
        }
        call_user_func_array([$stmt, 'bind_param'], $bind_names);
    }

    $stmt->execute();
    return $stmt->get_result();
}
