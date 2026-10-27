<?php

function obterMesesDisponiveisFiscalAdmin($conexao)
{
    $query = "SELECT DISTINCT cm.id, cm.mes, cm.ano FROM controle_meses cm ORDER BY cm.ano DESC, cm.mes DESC";
    $stmt = $conexao->prepare($query);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

function obterResponsaveisFiscal($conexao)
{
    $query = "SELECT id, nome FROM usuarios WHERE tipo_conta IN ('fiscal', 'lider_fiscal', 'admin') ORDER BY nome ASC";
    $stmt = $conexao->prepare($query);
    $stmt->execute();
    $result = $stmt->get_result();
    return $result->fetch_all(MYSQLI_ASSOC);
}

function obterEmpresasFiscalAdmin($conexao, $mes_id, $filtros = [])
{
    $sort_column = $filtros['sort'] ?? 'empresa';
    $sort_dir = $filtros['dir'] ?? 'ASC';

    $colunas_permitidas = [
        'codigo' => 'CAST(cf.codigo AS UNSIGNED)',
        'empresa' => 'cf.empresa'
    ];

    $coluna_ordenacao = $colunas_permitidas[$sort_column] ?? $colunas_permitidas['empresa'];
    $direcao_ordenacao = (strtoupper($sort_dir) === 'DESC') ? 'DESC' : 'ASC';

    $query = "
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
            AND re.tipo_tarefa = 'fiscal'
        LEFT JOIN usuarios u ON re.id_usuario = u.id
        WHERE cf.id_mes = ?
        AND (
            cf.setores_permitidos IS NULL 
            OR cf.setores_permitidos = ''
            OR FIND_IN_SET('fiscal', REPLACE(cf.setores_permitidos, ' ', '')) > 0
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
    $types = 'i';

    if (!empty($filtros['busca'])) {
        $query .= " AND (cf.empresa LIKE ? OR cf.cnpj LIKE ? OR cf.codigo LIKE ?)";
        $searchTerm = '%' . $filtros['busca'] . '%';
        array_push($params, $searchTerm, $searchTerm, $searchTerm);
        $types .= 'sss';
    }

    if (isset($filtros['responsavel_id']) && $filtros['responsavel_id'] !== '') {
        if ($filtros['responsavel_id'] === '0') {
            $query .= " AND u.id IS NULL";
        } else {
            $query .= " AND u.id = ?";
            $params[] = $filtros['responsavel_id'];
            $types .= 'i';
        }
    }

    $query .= " GROUP BY cf.id";
    $query .= " ORDER BY {$coluna_ordenacao} {$direcao_ordenacao}";

    $stmt = $conexao->prepare($query);

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
    $resultado = $stmt->get_result();

    if ($resultado === false) {
        return null;
    }

    return $resultado;
}