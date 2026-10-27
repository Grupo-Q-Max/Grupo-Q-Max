<?php
// assets/backend/functions/progress_logic.php

function calcularProgressoDP($conexao, $id_mes)
{
    $campos_obrigatórios = ['adto', 'folha_pagamento', 'data_pagamento', 'qtde_funcionarios', 'guias_sindicato', 'dissidio', 'fgts_digital', 'e_social', 'dctf_web_mes', 'sd_login', 'sd_senha'];
    $total_campos = 0;
    $campos_preenchidos = 0;

    $stmt = $conexao->prepare("SELECT * FROM controle_fechamento WHERE id_mes = ?");
    $stmt->bind_param('i', $id_mes);
    $stmt->execute();
    $result = $stmt->get_result();

    while ($empresa = $result->fetch_assoc()) {
        foreach ($campos_obrigatórios as $campo) {
            $total_campos++;
            if (!empty(trim($empresa[$campo] ?? ''))) {
                $campos_preenchidos++;
            }
        }
    }
    $progresso_percentual = $total_campos > 0 ? round(($campos_preenchidos / $total_campos) * 100) : 0;
    return ['media_geral' => $progresso_percentual];
}

function calcularProgressoFiscal($conexao, $id_mes)
{
    $campos_obrigatórios = ['reinf', 'impostos', 'iss', 'mit', 'dec_estadual', 'sped_fiscal', 'sped_contribuicao', 'destda', 'gia', 'dctf'];
    $total_campos = 0;
    $campos_preenchidos = 0;

    $stmt = $conexao->prepare("SELECT * FROM controle_fechamento WHERE id_mes = ?");
    $stmt->bind_param('i', $id_mes);
    $stmt->execute();
    $result = $stmt->get_result();

    while ($empresa = $result->fetch_assoc()) {
        foreach ($campos_obrigatórios as $campo) {
            $total_campos++;
            if (!empty(trim($empresa[$campo] ?? ''))) {
                $campos_preenchidos++;
            }
        }
    }
    $progresso_percentual = $total_campos > 0 ? round(($campos_preenchidos / $total_campos) * 100) : 0;
    return ['media_geral' => $progresso_percentual];
}

function calcularProgressoContabil($conexao, $id_mes)
{
    $campos_obrigatórios = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro', 'balancete', 'distribuicao_dirf', 'defs', 'dasn', 'ecd', 'ecf'];
    $total_campos = 0;
    $campos_preenchidos = 0;

    $stmt = $conexao->prepare("SELECT * FROM controle_fechamento WHERE id_mes = ?");
    $stmt->bind_param('i', $id_mes);
    $stmt->execute();
    $result = $stmt->get_result();
    
    while ($empresa = $result->fetch_assoc()) {
        foreach ($campos_obrigatórios as $campo) {
            $total_campos++;
            if (!empty(trim($empresa[$campo] ?? ''))) {
                $campos_preenchidos++;
            }
        }
    }
    $progresso_percentual = $total_campos > 0 ? round(($campos_preenchidos / $total_campos) * 100) : 0;
    return ['media_geral' => $progresso_percentual];
}
?>