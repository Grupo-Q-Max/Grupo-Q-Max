<?php
// ... (funções obterMesesDisponiveisDPAdmin, obterResponsaveisDP, etc... permanecem iguais) ...
function obterMesesDisponiveisDPAdmin($conexao)
{
    $query = "SELECT DISTINCT cm.id, cm.mes, cm.ano FROM controle_meses cm ORDER BY cm.ano DESC, cm.mes DESC";
    $stmt = $conexao->prepare($query);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

function obterResponsaveisDP($conexao)
{
    $query = "SELECT id, nome FROM usuarios WHERE tipo_conta IN ('dp', 'lider_dp', 'admin') ORDER BY nome ASC";
    $stmt = $conexao->prepare($query);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}
function obterTributacoesDistintasDP($conexao)
{
    // [!] CORREÇÃO DE LÓGICA v3 (para incluir espaços, nulos e vazios)
    $query = "
        SELECT DISTINCT tributacao 
        FROM controle_fechamento 
        WHERE tributacao IS NOT NULL AND tributacao != '' 
          AND (
                setores_permitidos IS NULL 
                OR setores_permitidos = '' 
                OR FIND_IN_SET('dp', REPLACE(setores_permitidos, ' ', '')) > 0
            )
        ORDER BY tributacao
    ";
    $stmt = $conexao->prepare($query);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}
function obterGruposDistintosDP($conexao)
{
    // [!] CORREÇÃO DE LÓGICA v3 (para incluir espaços, nulos e vazios)
    $query = "
        SELECT DISTINCT grupo 
        FROM controle_fechamento 
        WHERE grupo IS NOT NULL AND grupo != '' 
          AND (
                setores_permitidos IS NULL 
                OR setores_permitidos = '' 
                OR FIND_IN_SET('dp', REPLACE(setores_permitidos, ' ', '')) > 0
            )
        ORDER BY grupo
    ";
    $stmt = $conexao->prepare($query);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}
function obterEmpresasDPAdmin($conexao, $mes_id, $filtros = [])
{
    $query_base = "
        SELECT 
            cf.*,
            cm.id as id_mes,
            u.id as responsavel_id,
            u.nome as responsavel_nome
        FROM controle_fechamento cf
        JOIN controle_meses cm ON cf.id_mes = cm.id
        LEFT JOIN responsaveis_empresa re 
            ON cf.id = re.id_empresa 
            AND cm.id = re.id_mes 
            AND re.tipo_tarefa = 'dp'
        LEFT JOIN usuarios u ON re.id_usuario = u.id
        WHERE cf.id_mes = ?
        
        AND (
            cf.setores_permitidos IS NULL 
            OR cf.setores_permitidos = '' 
            OR FIND_IN_SET('dp', REPLACE(cf.setores_permitidos, ' ', '')) > 0
        )

        AND (
            cf.data_obrigacao IS NULL
            OR cf.data_obrigacao = '0000-00-00'
            OR cf.data_obrigacao <= LAST_DAY(
                STR_TO_DATE(CONCAT(cm.ano, '-', LPAD(cm.mes, 2, '0'), '-01'), '%Y-%m-%d')
            )
        )

        AND (
            cf.data_saida IS NULL
            OR cf.data_saida = '0000-00-00'
            OR cf.data_saida >= STR_TO_DATE(
                CONCAT(cm.ano, '-', LPAD(cm.mes, 2, '0'), '-01'),
                '%Y-%m-%d'
            )
        )
    ";

    $params = [$mes_id];
    $types = "i";
    $where_clauses = [];

    if (!empty($filtros['busca'])) {
        $where_clauses[] = "(cf.empresa LIKE ? OR cf.cnpj LIKE ? OR cf.codigo LIKE ?)";
        $busca_param = "%" . $filtros['busca'] . "%";
        array_push($params, $busca_param, $busca_param, $busca_param);
        $types .= "sss";
    }

    if (isset($filtros['responsavel_id']) && $filtros['responsavel_id'] !== '') {
        if ($filtros['responsavel_id'] === '0') {
            $where_clauses[] = "u.id IS NULL";
        } else {
            $where_clauses[] = "u.id = ?";
            $params[] = $filtros['responsavel_id'];
            $types .= "i";
        }
    }

    if (!empty($filtros['grupo'])) {
        $where_clauses[] = "cf.grupo = ?";
        $params[] = $filtros['grupo'];
        $types .= "s";
    }

    if (!empty($filtros['tributacao'])) {
        $where_clauses[] = "cf.tributacao = ?";
        $params[] = $filtros['tributacao'];
        $types .= "s";
    }

    $query_final = $query_base;
    if (!empty($where_clauses)) {
        $query_final .= " AND " . implode(" AND ", $where_clauses);
    }

    $query_final .= " GROUP BY cf.id ORDER BY cf.empresa ASC";

    $stmt = $conexao->prepare($query_final);

    if ($stmt === false) {
        return null;
    }

    if (!empty($params)) {
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
