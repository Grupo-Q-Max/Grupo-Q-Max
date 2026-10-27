<?php
// assets/backend/functions/progress_functions.php

/**
 * Calcula o progresso de um funcionário em um mês específico, com base na área.
 * @param mysqli $conexao
 * @param int $funcionario_id
 * @param int $mes_id
 * @param string $area_tarefa ('dp', 'fiscal', 'contabil')
 * @return array Um array com o progresso calculado
 */
function calcularProgressoPorFuncionario($conexao, $funcionario_id, $mes_id, $area_tarefa)
{
    // Define os campos obrigatórios para cada área
    $camposObrigatoriosDP = [
        'adto',
        'folha_pagamento',
        'data_pagamento',
        'qtde_funcionarios',
        'guias_sindicato',
        'dissidio',
        'fgts_digital',
        'e_social',
        'dctf_web_mes',
        'sd_login',
        'sd_senha'
    ];
    $camposObrigatoriosFiscal = [
        'reinf',
        'impostos',
        'iss',
        'mit',
        'dec_estadual',
        'sped_fiscal',
        'sped_contribuicao',
        'destda',
        'gia',
        'dctf'
    ];
    $camposObrigatoriosContabil = [
        'janeiro',
        'fevereiro',
        'marco',
        'abril',
        'maio',
        'junho',
        'julho',
        'agosto',
        'setembro',
        'outubro',
        'novembro',
        'dezembro',
        'balancete',
        'distribuicao_dirf',
        'defs',
        'dasn',
        'ecd',
        'ecf'
    ];

    // Seleciona a lista de campos correta
    $camposObrigatorios = [];
    switch ($area_tarefa) {
        case 'dp':
            $camposObrigatorios = $camposObrigatoriosDP;
            break;
        case 'fiscal':
            $camposObrigatorios = $camposObrigatoriosFiscal;
            break;
        case 'contabil':
            $camposObrigatorios = $camposObrigatoriosContabil;
            break;
    }

    if (empty($camposObrigatorios)) {
        return ['progresso_percentual' => 0, 'campos_preenchidos' => 0, 'total_campos_da_carteira' => 0];
    }

    $total_campos_da_carteira = 0;
    $campos_preenchidos = 0;

    $sql = "
        SELECT cf.*
        FROM responsaveis_empresa re
        JOIN controle_fechamento cf ON re.id_empresa = cf.id AND re.id_mes = cf.id_mes
        WHERE re.id_usuario = ? AND re.id_mes = ? AND re.tipo_tarefa = ?
    ";
    $stmt = $conexao->prepare($sql);
    $stmt->bind_param('iis', $funcionario_id, $mes_id, $area_tarefa);
    $stmt->execute();
    $empresas = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    foreach ($empresas as $empresa) {
        foreach ($camposObrigatorios as $campo) {
            $total_campos_da_carteira++;
            if (!empty(trim($empresa[$campo] ?? ''))) {
                $campos_preenchidos++;
            }
        }
    }

    $progresso_percentual = ($total_campos_da_carteira > 0) ? round(($campos_preenchidos / $total_campos_da_carteira) * 100) : 0;

    return [
        'progresso_percentual' => $progresso_percentual,
        'campos_preenchidos' => $campos_preenchidos,
        'total_campos_da_carteira' => $total_campos_da_carteira,
    ];
}
