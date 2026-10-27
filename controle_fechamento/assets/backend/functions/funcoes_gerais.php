<?php

function obterAnosComEmpresas($conexao)
{
    $query = "SELECT DISTINCT YEAR(data_contrato) as ano FROM controle_fechamento ORDER BY ano DESC";
    $result = $conexao->query($query);
    return $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
}

function obterMesesComEmpresas($conexao)
{
    $query = "SELECT DISTINCT id, mes, ano FROM controle_meses ORDER BY ano DESC, mes DESC";
    $result = $conexao->query($query);
    return $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
}

function obterResponsaveisAtivos($conexao)
{
    $query = "SELECT id, nome FROM usuarios WHERE tipo_conta IN ('fiscal', 'dp', 'contabil') ORDER BY nome";
    $result = $conexao->query($query);
    return $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
}

function obterTributacoesDisponiveis($conexao)
{
    $query = "SELECT DISTINCT tributacao FROM controle_fechamento ORDER BY tributacao";
    $result = $conexao->query($query);
    return $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
}
function obterEmpresasUnicas($conexao, $filtros)
{
    $sql = "SELECT 
                MAX(cf.id) as id, 
                cf.codigo, 
                cf.empresa, 
                cf.cnpj, 
                cf.grupo, 
                cf.tributacao,
                cf.data_contrato,
                cf.data_saida,
                cf.setores_permitidos
            FROM controle_fechamento cf
            WHERE 1=1";

    $params = [];
    $types = "";

    // --- SEÇÃO DE FILTROS (maioria mantida igual) ---
    if (!empty($filtros['busca'])) {
        $sql .= " AND (cf.empresa LIKE ? OR cf.cnpj LIKE ? OR cf.codigo LIKE ?)";
        $buscaParam = "%" . $filtros['busca'] . "%";
        array_push($params, $buscaParam, $buscaParam, $buscaParam);
        $types .= "sss";
    }
    if (!empty($filtros['tributacao'])) {
        $sql .= " AND cf.tributacao = ?";
        $params[] = $filtros['tributacao'];
        $types .= "s";
    }
    if (!empty($filtros['grupo'])) {
        $sql .= " AND cf.grupo = ?";
        $params[] = $filtros['grupo'];
        $types .= "s";
    }
    if (!empty($filtros['setor'])) {
        $setor = $filtros['setor'];
        $sql .= " AND (cf.setores_permitidos IS NULL OR cf.setores_permitidos = '' OR FIND_IN_SET(?, cf.setores_permitidos) > 0)";
        $params[] = $setor;
        $types .= "s";
    }

    if (!empty($filtros['status'])) {
        if ($filtros['status'] === 'ativas') {
            $sql .= " AND (cf.data_saida IS NULL OR cf.data_saida > CURDATE())";
        } elseif ($filtros['status'] === 'inativas') {
            $sql .= " AND cf.data_saida IS NOT NULL AND cf.data_saida <= CURDATE()";
        }
    }

    // *** ALTERAÇÃO 2: A MÁGICA PARA REMOVER DUPLICATAS!
    $sql .= " GROUP BY cf.cnpj";

    // --- LÓGICA DE ORDENAÇÃO (mantida igual) ---
    $colunas_permitidas_ordenacao = ['codigo', 'empresa', 'grupo', 'tributacao'];
    $ordenacao_coluna = $filtros['sort'] ?? 'empresa';
    $ordenacao_direcao = isset($filtros['dir']) && strtoupper($filtros['dir']) === 'DESC' ? 'DESC' : 'ASC';

    if (in_array($ordenacao_coluna, $colunas_permitidas_ordenacao)) {
        if ($ordenacao_coluna === 'codigo') {
            $sql .= " ORDER BY CAST(cf.codigo AS UNSIGNED) {$ordenacao_direcao}, cf.codigo {$ordenacao_direcao}";
        } else {
            $sql .= " ORDER BY cf.{$ordenacao_coluna} {$ordenacao_direcao}";
        }
    } else {
        $sql .= " ORDER BY cf.empresa ASC";
    }

    $stmt = $conexao->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}
function obterFechamentoCompleto($conexao, $filtros)
{
    $sql = "
        SELECT 
            cf.*,
            re_dp.id_usuario AS responsavel_dp_id,
            u_dp.nome AS responsavel_dp_nome,
            re_fiscal.id_usuario AS responsavel_fiscal_id,
            u_fiscal.nome AS responsavel_fiscal_nome,
            re_contabil.id_usuario AS responsavel_contabil_id,
            u_contabil.nome AS responsavel_contabil_nome
        FROM controle_fechamento cf
        LEFT JOIN responsaveis_empresa re_dp ON cf.id = re_dp.id_empresa AND re_dp.tipo_tarefa = 'dp' AND re_dp.responsavel_atual = 1
        LEFT JOIN usuarios u_dp ON re_dp.id_usuario = u_dp.id
        LEFT JOIN responsaveis_empresa re_fiscal ON cf.id = re_fiscal.id_empresa AND re_fiscal.tipo_tarefa = 'fiscal' AND re_fiscal.responsavel_atual = 1
        LEFT JOIN usuarios u_fiscal ON re_fiscal.id_usuario = u_fiscal.id
        LEFT JOIN responsaveis_empresa re_contabil ON cf.id = re_contabil.id_empresa AND re_contabil.tipo_tarefa = 'contabil' AND re_contabil.responsavel_atual = 1
        LEFT JOIN usuarios u_contabil ON re_contabil.id_usuario = u_contabil.id
        WHERE 1=1
    ";

    $params = [];
    $types = '';

    if ($filtros['mes_id']) {
        $sql .= " AND cf.id_mes = ?";
        $params[] = $filtros['mes_id'];
        $types .= 'i';
    }
    if ($filtros['responsavel_id']) {
        $sql .= " AND (re_dp.id_usuario = ? OR re_fiscal.id_usuario = ? OR re_contabil.id_usuario = ?)";
        $params[] = $filtros['responsavel_id'];
        $params[] = $filtros['responsavel_id'];
        $params[] = $filtros['responsavel_id'];
        $types .= 'iii';
    }
    if ($filtros['busca']) {
        $sql .= " AND (cf.empresa LIKE ? OR cf.cnpj LIKE ? OR cf.codigo LIKE ?)";
        $params[] = "%" . $filtros['busca'] . "%";
        $params[] = "%" . $filtros['busca'] . "%";
        $params[] = "%" . $filtros['busca'] . "%";
        $types .= 'sss';
    }
    if ($filtros['tipo_tarefa']) {
        $sql .= " AND (re_{$filtros['tipo_tarefa']}.id_usuario IS NOT NULL)";
    }
    if ($filtros['tributacao']) {
        $sql .= " AND cf.tributacao = ?";
        $params[] = $filtros['tributacao'];
        $types .= 's';
    }

    $sql .= " ORDER BY cf.empresa ASC";

    $stmt = $conexao->prepare($sql);
    if ($params) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    return $stmt->get_result();
}
function obterEmpresasPrincipais($conexao, $filtros)
{
    // A consulta base agora busca de forma mais simples
    $sql = "SELECT 
                cf.id, cf.codigo, cf.empresa, cf.cnpj, cf.grupo, cf.tributacao,
                DATE_FORMAT(cf.data_contrato, '%d/%m/%Y') as data_contrato,
                DATE_FORMAT(cf.data_saida, '%d/%m/%Y') as data_saida,
                cf.setores_permitidos
            FROM controle_fechamento cf
            WHERE 1=1";

    $params = [];
    $types = "";

    // --- SEÇÃO DE FILTROS ---
    if (!empty($filtros['busca'])) {
        $sql .= " AND (cf.empresa LIKE ? OR cf.cnpj LIKE ? OR cf.codigo LIKE ?)";
        $buscaParam = "%" . $filtros['busca'] . "%";
        array_push($params, $buscaParam, $buscaParam, $buscaParam);
        $types .= "sss";
    }
    if (!empty($filtros['tributacao'])) {
        $sql .= " AND cf.tributacao = ?";
        $params[] = $filtros['tributacao'];
        $types .= "s";
    }
    if (!empty($filtros['grupo'])) {
        $sql .= " AND cf.grupo = ?";
        $params[] = $filtros['grupo'];
        $types .= "s";
    }
    if (!empty($filtros['setor'])) {
        $setor = $filtros['setor'];
        if ($setor === 'cushman') {
            $sql .= " AND FIND_IN_SET(?, cf.setores_permitidos) > 0";
        } else {
            $sql .= " AND (cf.setores_permitidos IS NULL OR cf.setores_permitidos = '' OR FIND_IN_SET(?, cf.setores_permitidos) > 0)";
        }
        $params[] = $setor;
        $types .= "s";
    }

    // ==========================================================
    // ||           LÓGICA DE STATUS ATIVAS/INATIVAS           ||
    // ==========================================================
    if (!empty($filtros['status'])) {
        if ($filtros['status'] === 'ativas') {
            $sql .= " AND (cf.data_saida IS NULL OR cf.data_saida > CURDATE())";
        } elseif ($filtros['status'] === 'inativas') {
            // Mostra empresas cuja data de saída já passou
            $sql .= " AND cf.data_saida IS NOT NULL AND cf.data_saida <= CURDATE()";
        }
        // Se o status for 'todas', nenhum filtro de data_saida é adicionado
    }

    // O filtro de mês só se aplica se um mês for selecionado
    if (!empty($filtros['mes_id'])) {
        $sql .= " AND cf.id_mes = ?";
        $params[] = $filtros['mes_id'];
        $types .= 'i';
    }

    // --- LÓGICA DE ORDENAÇÃO ---
    $colunas_permitidas_ordenacao = ['codigo', 'empresa', 'grupo', 'tributacao'];
    $ordenacao_coluna = $filtros['sort'] ?? 'empresa';
    $ordenacao_direcao = isset($filtros['dir']) && strtoupper($filtros['dir']) === 'DESC' ? 'DESC' : 'ASC';

    if (in_array($ordenacao_coluna, $colunas_permitidas_ordenacao)) {
        if ($ordenacao_coluna === 'codigo') {
            $sql .= " ORDER BY CAST(cf.codigo AS UNSIGNED) {$ordenacao_direcao}, cf.codigo {$ordenacao_direcao}";
        } else {
            $sql .= " ORDER BY cf.{$ordenacao_coluna} {$ordenacao_direcao}";
        }
    } else {
        $sql .= " ORDER BY cf.empresa ASC";
    }

    $stmt = $conexao->prepare($sql);
    if (!empty($params)) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

function obterValoresDistintos($conexao, $coluna)
{
    $valores = [];
    $sql = "SELECT DISTINCT {$coluna} FROM controle_fechamento WHERE {$coluna} IS NOT NULL AND {$coluna} != '' ORDER BY {$coluna} ASC";
    $result = $conexao->query($sql);
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $valores[] = $row[$coluna];
        }
    }
    return $valores;
}
