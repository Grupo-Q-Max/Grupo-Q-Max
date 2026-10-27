<?php
session_start();
ini_set('display_errors', 1);
error_reporting(E_ALL);
require_once 'assets/backend/config.php';
require_once 'funcoes_dp_admin.php';

// =======================================================================
// == CORREÇÃO DO ERRO: VERIFICA SE A FUNÇÃO JÁ EXISTE ANTES DE CRIAR ==
// =======================================================================
if (!function_exists('formatarDataBR')) {
    function formatarDataBR($data)
    {
        if (empty($data) || $data === '0000-00-00') {
            return '';
        }
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $data)) {
            try {
                $dateObj = new DateTime($data);
                return $dateObj->format('d/m/Y');
            } catch (Exception $e) {
                return $data;
            }
        }
        return $data;
    }
}
// =======================================================================

// 1. VERIFICAÇÃO DE ACESSO
if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['tipo_conta'], ['admin', 'lider_dp', 'dp'])) {
    $_SESSION['mensagem'] = 'Acesso restrito à área de gestão do DP.';
    header('Location: index.php');
    exit();
}

$user_type = $_SESSION['tipo_conta'];
$usuario_id = $_SESSION['usuario_id']; // Necessário para o header

// Pega nome do usuário (opcional, para o header)
$stmt_nome = $conexao->prepare("SELECT nome FROM usuarios WHERE id = ?");
$stmt_nome->bind_param('i', $usuario_id);
$stmt_nome->execute();
$usuario_nome = $stmt_nome->get_result()->fetch_assoc()['nome'] ?? 'Usuário DP';
$stmt_nome->close();

// 2. CARREGAMENTO DE DADOS INICIAIS
$meses_disponiveis = obterMesesDisponiveisDPAdmin($conexao);
$mes_selecionado_id = isset($_GET['mes_id']) ? (int)$_GET['mes_id'] : ($meses_disponiveis[0]['id'] ?? null);

// --- [LÓGICA DO 13º SALÁRIO] ---
// Descobre o número do mês (1-12) baseado no ID selecionado
$mes_numero_selecionado = 0;
if ($mes_selecionado_id && !empty($meses_disponiveis)) {
    foreach ($meses_disponiveis as $m) {
        if ($m['id'] == $mes_selecionado_id) {
            $mes_numero_selecionado = (int)$m['mes'];
            break;
        }
    }
}

// =======================================================================
// == ALTERAÇÃO AQUI: LÓGICA DE EXIBIÇÃO DO 13º SALÁRIO ==
// =======================================================================
// Define a flag: exibe apenas se o mês selecionado for 12 (Dezembro).
// De janeiro (1) a novembro (11), isso retornará falso e esconderá as colunas.
$exibir_colunas_13 = ($mes_numero_selecionado == 12);
$exibir_alteracoes_pasta = ($mes_numero_selecionado == 5);
// ------------------------------

$filtros = [
    'busca'          => $_GET['busca'] ?? '',
    'responsavel_id' => $_GET['responsavel_id'] ?? '',
    'grupo'          => $_GET['grupo'] ?? '',
    'tributacao'     => $_GET['tributacao'] ?? ''
];

$resultado_empresas = $mes_selecionado_id ? obterEmpresasDPAdmin($conexao, $mes_selecionado_id, $filtros) : null;
$empresas = $resultado_empresas ? $resultado_empresas->fetch_all(MYSQLI_ASSOC) : [];
$status_reinf_real = []; // Array para guardar o status real de cada empresa

if (!empty($empresas)) {
    // 1. Pega todos os IDs das empresas listadas na tela
    $ids_empresas = array_column($empresas, 'id');
    $ids_string = implode(',', array_map('intval', $ids_empresas)); // Proteção básica

    // 2. Busca os detalhes na tabela reinf_detalhes
    $query_detalhes = "SELECT * FROM reinf_detalhes WHERE id_controle_fechamento IN ($ids_string)";
    $res_detalhes = $conexao->query($query_detalhes);

    if ($res_detalhes) {
        while ($row = $res_detalhes->fetch_assoc()) {
            // 3. Verifica se está preenchido (IGNORANDO O CAMPO 'OUTROS')
            $campos_para_checar = [
                $row['irrf_1708'],
                $row['crf_5952'],
                $row['inss_prestados'],
                $row['inss_tomados'],
                $row['desoneracao'],
                $row['irrf_3208']
            ];

            $esta_preenchido = true;
            foreach ($campos_para_checar as $valor) {
                // Se algum campo numérico estiver vazio, marca como pendente
                if (trim($valor ?? '') === '') {
                    $esta_preenchido = false;
                    break;
                }
            }

            // Salva o resultado no array usando o ID da empresa como chave
            $status_reinf_real[$row['id_controle_fechamento']] = $esta_preenchido ? 'Preenchido' : 'Pendente';
        }
    }
}
$num_empresas_filtradas = count($empresas);
$responsaveis_disponiveis = obterResponsaveisDP($conexao);
$grupos_disponiveis = obterGruposDistintosDP($conexao);
$tributacoes_disponiveis = obterTributacoesDistintasDP($conexao);

// =======================================================================
// == CÁLCULO DE VENCIMENTOS ==
// =======================================================================
$certificados_a_vencer = 0;
$procuracoes_a_vencer = 0;
$empresas_certificados_vencendo = [];
$empresas_procuracoes_vencendo = [];
$alerta_certificado_iminente = false;
$alerta_procuracao_iminente = false;

$hoje_obj = new DateTime('today');
$limite_vencimento_obj = (new DateTime('today'))->modify('+30 days');
$hoje_sql = $hoje_obj->format('Y-m-d');

$query_vencimentos = "
    SELECT 
        sub.empresa,
        sub.data_vencimento_certificado,
        sub.data_procuracao_target
    FROM (
        SELECT 
            empresa, 
            cnpj,
            data_vencimento_certificado,
            data_procuracao_target,
            ROW_NUMBER() OVER(PARTITION BY cnpj ORDER BY id_mes DESC) as rn
        FROM controle_fechamento
        WHERE 
            (
                setores_permitidos IS NULL 
                OR setores_permitidos = ''
                OR setores_permitidos LIKE '%dp%'
                OR setores_permitidos LIKE '%fiscal%'
                OR setores_permitidos LIKE '%cushman%'
                OR setores_permitidos LIKE '%contabil%'
            )
            AND (data_vencimento_certificado IS NOT NULL OR data_procuracao_target IS NOT NULL)
    ) as sub
    WHERE 
        sub.rn = 1
        AND (
            (sub.data_vencimento_certificado >= ?) OR 
            (sub.data_procuracao_target >= ?)
        )
";

$stmt_vencimentos = $conexao->prepare($query_vencimentos);
$stmt_vencimentos->bind_param("ss", $hoje_sql, $hoje_sql);
$stmt_vencimentos->execute();
$resultado_vencimentos = $stmt_vencimentos->get_result();
$empresas_com_vencimentos = $resultado_vencimentos->fetch_all(MYSQLI_ASSOC);
$stmt_vencimentos->close();

foreach ($empresas_com_vencimentos as $empresa_vencimento) {
    // Certificados
    if (!empty($empresa_vencimento['data_vencimento_certificado'])) {
        try {
            $data_vencimento_cert = new DateTime($empresa_vencimento['data_vencimento_certificado']);
            if ($data_vencimento_cert >= $hoje_obj) {
                $certificados_a_vencer++;
                if ($data_vencimento_cert < $limite_vencimento_obj) {
                    $alerta_certificado_iminente = true;
                }
                $intervalo_cert = $hoje_obj->diff($data_vencimento_cert);
                $empresas_certificados_vencendo[] = [
                    'empresa' => $empresa_vencimento['empresa'],
                    'data_vencimento' => formatarDataBR($empresa_vencimento['data_vencimento_certificado']),
                    'dias_restantes' => $intervalo_cert->days
                ];
            }
        } catch (Exception $e) {
        }
    }
    // Procurações
    if (!empty($empresa_vencimento['data_procuracao_target'])) {
        try {
            $data_vencimento_proc = new DateTime($empresa_vencimento['data_procuracao_target']);
            if ($data_vencimento_proc >= $hoje_obj) {
                $procuracoes_a_vencer++;
                if ($data_vencimento_proc < $limite_vencimento_obj) {
                    $alerta_procuracao_iminente = true;
                }
                $intervalo_proc = $hoje_obj->diff($data_vencimento_proc);
                $empresas_procuracoes_vencendo[] = [
                    'empresa' => $empresa_vencimento['empresa'],
                    'data_vencimento' => formatarDataBR($empresa_vencimento['data_procuracao_target']),
                    'dias_restantes' => $intervalo_proc->days
                ];
            }
        } catch (Exception $e) {
        }
    }
}

$compararPorDias = function ($a, $b) {
    return $a['dias_restantes'] <=> $b['dias_restantes'];
};
usort($empresas_certificados_vencendo, $compararPorDias);
usort($empresas_procuracoes_vencendo, $compararPorDias);
// =======================================================================
// == CÁLCULO DE PROGRESSO DETALHADO (NOVO) ==
// =======================================================================
$colunas_monitoradas = [
    'adto'              => 'ADTO',
    'folha_pagamento'   => 'Folha',
    'guias_sindicato'   => 'Guias Sind.',
    'fgts_digital'      => 'FGTS Digital',
    'e_social'          => 'eSocial',
    'dctf_web_mes'      => 'DCTF Web',
    'reinf'             => 'REINF'
];
if ($exibir_alteracoes_pasta) {
    $colunas_monitoradas['alteracoes_pasta'] = 'Alterações Pasta';
}
// Se for época de 13º, monitora também
if ($exibir_colunas_13) {
    $colunas_monitoradas['ADTO13'] = 'ADTO 13º';
    $colunas_monitoradas['FOLHA13'] = 'Folha 13º';
}

// Inicializa contadores
$stats_detalhadas = [];
foreach ($colunas_monitoradas as $key => $label) {
    $stats_detalhadas[$key] = ['label' => $label, 'total' => 0, 'feitos' => 0, 'pendentes' => 0, 'porcentagem' => 0];
}

$total_campos_geral = 0;
$preenchidos_geral = 0;
$empresas_100_porcento = 0;

foreach ($empresas as $empresa) {
    $empresa_completa = true;
    foreach ($colunas_monitoradas as $key => $label) {
        $stats_detalhadas[$key]['total']++;
        $total_campos_geral++;

$valor = trim($empresa[$key] ?? '');

if ($key === 'alteracoes_pasta') {
    $isPreenchido = ($valor === 'Concluído');
} else {
    $isPreenchido = !empty($valor);

    if ($key === 'folha_pagamento' && ($valor === 'Selecione' || $valor === '')) {
        $isPreenchido = false;
    }
}
        if ($isPreenchido) {
            $stats_detalhadas[$key]['feitos']++;
            $preenchidos_geral++;
        } else {
            $stats_detalhadas[$key]['pendentes']++;
            $empresa_completa = false;
        }
    }
    if ($empresa_completa) {
        $empresas_100_porcento++;
    }
}

// Calcula as porcentagens finais
foreach ($stats_detalhadas as $key => &$stat) {
    if ($stat['total'] > 0) {
        $stat['porcentagem'] = round(($stat['feitos'] / $stat['total']) * 100);
    }
}
unset($stat);

$porcentagem_geral = ($total_campos_geral > 0) ? round(($preenchidos_geral / $total_campos_geral) * 100) : 0;

// Opcional: Remove colunas que não têm uso (total 0)
$stats_detalhadas = array_filter($stats_detalhadas, function ($item) {
    return $item['total'] > 0;
});
?>

<!DOCTYPE html>
<html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <title>Gestão Departamento Pessoal</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/contabil.css">
    <style>
                .badge-na {
                    background-color: #fd7e14 !important;
                    /* Laranja */
                    color: white;
                }

                .badge-pendencia {
                    background-color: #dc3545 !important;
                    /* Vermelho */
                    color: white;
                }

                .badge-ok {
                    background-color: #198754 !important;
                    /* Verde */
                    color: white;
                }
        .table-container {
            max-height: 75vh;
            overflow: auto;
            position: relative;
        }

        .data-table {
            min-width: 100%;
            border-collapse: collapse;
        }

        .data-table thead th {
            position: sticky;
            top: 0;
            z-index: 20;
            background-color: var(--primary-color);
            padding: 8px 10px;
            text-align: left;
        }

        .data-table tbody td {
            padding: 8px 10px;
            vertical-align: top;
        }

        /* Larguras das colunas */
        .data-table th:nth-child(2),
        .data-table td:nth-child(2) {
            min-width: 250px;
        }

        /* Empresa */
        .data-table th:nth-child(7),
        .data-table td:nth-child(7) {
            min-width: 300px;
        }

        /* Tributação */

        /* Sticky Columns */
        .data-table thead th:nth-child(1),
        .data-table tbody td:nth-child(1) {
            position: sticky;
            left: 0;
            z-index: 15;
            min-width: 80px;
        }

        .data-table thead th:nth-child(2),
        .data-table tbody td:nth-child(2) {
            position: sticky;
            left: 80px;
            z-index: 15;
        }

        .data-table thead th:nth-child(3),
        .data-table tbody td:nth-child(3) {
            position: sticky;
            left: 330px;
            z-index: 15;
            min-width: 200px;
        }

        .data-table thead th:nth-child(4),
        .data-table tbody td:nth-child(4) {
            position: sticky;
            left: 530px;
            z-index: 15;
            border-right: 2px solid var(--border-color);
            min-width: 180px;
        }

        .data-table thead th:nth-child(-n+4) {
            z-index: 30;
        }

        .data-table tbody td:nth-child(-n+4) {
            background-color: var(--card-bg);
        }

        .data-table tr:hover td:nth-child(-n+4) {
            background-color: var(--card-bg) !important;
        }

        /* Outros estilos */
        .data-table td[contenteditable="true"]:focus {
            background-color: #e8f0fe;
            outline: 2px solid #1a73e8;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        /* --- ESTILOS DO PAINEL DE PROGRESSO --- */
        .detail-card {
            background: #fff;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 25px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
            border: 1px solid #f0f0f0;
        }

        .detail-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 1px solid #eee;
            padding-bottom: 15px;
        }

        .detail-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 15px;
        }

        .detail-item {
            background: #f8f9fa;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid #e9ecef;
            transition: transform 0.2s;
        }

        .detail-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
        }

        .detail-title {
            font-size: 0.85rem;
            font-weight: 700;
            color: #555;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
        }

        .mini-progress {
            height: 6px;
            background: #e0e0e0;
            border-radius: 3px;
            overflow: hidden;
            margin-bottom: 6px;
        }

        .mini-fill {
            height: 100%;
            border-radius: 3px;
            transition: width 1s ease-in-out;
        }

        /* Cores das barras */
        .fill-low {
            background-color: #dc3545;
        }

        /* Vermelho */
        .fill-mid {
            background-color: #ffc107;
        }

        /* Amarelo */
        .fill-high {
            background-color: #198754;
        }

        /* Verde */
        .btn-voltar {
            color: var(--text-color);
            background-color: var(--background-color);
            border: 1px solid var(--primary-color);
            padding: 8px 15px;
            border-radius: 5px;
            text-decoration: none;
            transition: all 0.3s ease;
        }

        .btn-voltar:hover {
            background-color: var(--primary-color);
            color: #fff;
        }

        /* Estilos de Filtro e Modais */
        .filter-panel {
            background-color: var(--card-bg-color, #fff);
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        }

        .filter-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            align-items: flex-end;
        }

        .filter-group {
            display: flex;
            flex-direction: column;
        }

        .filter-buttons-action {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }

        .column-filter-icon {
            cursor: pointer;
            font-size: 0.8em;
            color: #b0c4de;
            margin-left: 5px;
        }

        .column-filter-icon:hover {
            color: #ffffff;
        }

        #column-filter-dropdown {
            display: none;
            position: absolute;
            background: #fff;
            border: 1px solid #ddd;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 50;
            max-height: 300px;
            overflow-y: auto;
            border-radius: 4px;
        }

        .filter-option {
            padding: 8px 12px;
            cursor: pointer;
            border-bottom: 1px solid #eee;
            white-space: nowrap;
            font-size: 0.9em;
        }

        .filter-option:hover {
            background-color: var(--primary-color);
            color: #fff;
        }

        /* Cards */
        .stats-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }

        .stats-box {
            background-color: var(--card-bg-color);
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
            position: relative;
        }

        .stats-box h3 {
            font-size: 1rem;
            color: var(--text-muted-color);
            margin-bottom: 5px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .stats-box .stats-numbers {
            font-size: 1.75rem;
            font-weight: 700;
            color: var(--text-color);
        }

        .stats-box.alert {
            background-color: #fff3cd;
            color: #664d03;
            border: 1px solid #ffecb5;
        }

        .stats-box.alert h3,
        .stats-box.alert .stats-numbers,
        .stats-box.alert p {
            color: #664d03;
        }

        .btn-exportar-dp {
            position: absolute;
            bottom: 10px;
            right: 15px;
            background-color: #1D6F42;
            color: white;
            border: none;
            border-radius: 50%;
            width: 35px;
            height: 35px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            font-size: 1rem;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
            transition: all 0.2s ease-in-out;
        }

        .btn-exportar-dp:hover {
            background-color: #165934;
            color: white;
            transform: scale(1.1);
        }

        /* Estilo 13º Salário */
        .th-13 {
            background: linear-gradient(45deg, #1e3c72, #2a5298) !important;
        }
    </style>
</head>

<body>

    <div id="modalCertificados" class="modal-overlay">
        <div class="modal-container" style="max-width: 90vw; width: 1200px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-id-card"></i> Informações de Certificados</h3><button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="search-box-modal" style="margin-bottom: 15px; position: relative;">
                    <i class="fas fa-search" style="position: absolute; left: 10px; top: 10px; color: #aaa;"></i>
                    <input type="text" id="searchCertificadosInput" placeholder="Pesquisar..." style="width: 100%; padding: 8px 8px 8px 35px; border: 1px solid #ccc; border-radius: 4px;">
                </div>
                <?php if (!empty($empresas)) : ?>
                    <table class="modal-table" id="tableCertificados">
                        <thead>
                            <tr>
                                <th>Empresa</th>
                                <th>CNPJ</th>
                                <th>Cert. Cliente</th>
                                <th>Tipo Cert.</th>
                                <th>Senha Cert.</th>
                                <th>Emissão Cert.</th>
                                <th>Venc. Cert.</th>
                                <th>Proc. Target</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($empresas as $empresa) : ?>
                                <tr>
                                    <td><?= htmlspecialchars($empresa['empresa']) ?></td>
                                    <td><?= htmlspecialchars($empresa['cnpj']) ?></td>
                                    <td><?= htmlspecialchars($empresa['certificado_cliente'] ?? '') ?></td>
                                    <td><?= htmlspecialchars($empresa['tipo_certificado'] ?? '') ?></td>
                                    <td><?= htmlspecialchars($empresa['senha_certificado'] ?? '') ?></td>
                                    <td><?= htmlspecialchars(formatarDataBR($empresa['data_emissao_certificado'] ?? '')) ?></td>
                                    <td><?= htmlspecialchars(formatarDataBR($empresa['data_vencimento_certificado'] ?? '')) ?></td>
                                    <td><?= htmlspecialchars(formatarDataBR($empresa['data_procuracao_target'] ?? '')) ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php else : ?><div class="empty-message">
                        <p>Nenhuma empresa encontrada</p>
                    </div><?php endif; ?>
            </div>
        </div>
    </div>

    <div id="modalCertificadosVencendo" class="modal-overlay">
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-exclamation-triangle"></i> Certificados a Vencer</h3><button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <?php if (!empty($empresas_certificados_vencendo)) : ?>
                    <table class="modal-table">
                        <thead>
                            <tr>
                                <th>Empresa</th>
                                <th>Data Vencimento</th>
                                <th>Dias Restantes</th>
                            </tr>
                        </thead>
                        <tbody><?php foreach ($empresas_certificados_vencendo as $item) : ?>
                                <tr>
                                    <td><?= htmlspecialchars($item['empresa']) ?></td>
                                    <td><?= htmlspecialchars($item['data_vencimento']) ?></td>
                                    <td><span class="badge <?= ($item['dias_restantes'] <= 7 ? 'badge-danger' : 'badge-warning') ?>"><?= $item['dias_restantes'] ?> dia(s)</span></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php else : ?><div class="empty-message">
                        <p>Nenhum certificado vencendo.</p>
                    </div><?php endif; ?>
            </div>
        </div>
    </div>

    <div id="modalProcuracoesVencendo" class="modal-overlay">
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-user-clock"></i> Procurações a Vencer</h3><button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <?php if (!empty($empresas_procuracoes_vencendo)) : ?>
                    <table class="modal-table">
                        <thead>
                            <tr>
                                <th>Empresa</th>
                                <th>Data Vencimento</th>
                                <th>Dias Restantes</th>
                            </tr>
                        </thead>
                        <tbody><?php foreach ($empresas_procuracoes_vencendo as $item) : ?>
                                <tr>
                                    <td><?= htmlspecialchars($item['empresa']) ?></td>
                                    <td><?= htmlspecialchars($item['data_vencimento']) ?></td>
                                    <td><span class="badge <?= ($item['dias_restantes'] <= 7 ? 'badge-danger' : 'badge-warning') ?>"><?= $item['dias_restantes'] ?> dia(s)</span></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php else : ?><div class="empty-message">
                        <p>Nenhuma procuração vencendo.</p>
                    </div><?php endif; ?>
            </div>
        </div>
    </div>

    <header class="header">
        <h1>Gestão Departamento Pessoal</h1>
        <div>
            <?php if ($user_type === 'dp') : ?>
                <a href="dp.php" class="btn-voltar"><i class="fas fa-arrow-left"></i> Voltar ao Fechamento</a>
            <?php else : ?>
                <a href="painel_lider.php?area=dp" class="btn-voltar"><i class="fas fa-arrow-left"></i> Voltar</a>
            <?php endif; ?>
        </div>
    </header>

    <div class="main-content">
        <div id="column-filter-dropdown"></div>
        <div class="filter-panel">
            <form method="GET" action="dp_admin.php">
                <div class="filter-grid">
                    <div class="filter-group">
                        <label for="mes_id"><i class="fas fa-calendar-alt"></i> Mês de Referência</label>
                        <select id="mes_id" name="mes_id" class="form-select form-select-sm" onchange="this.form.submit()">
                            <?php foreach ($meses_disponiveis as $mes) : ?>
                                <option value="<?= $mes['id'] ?>" <?= ($mes['id'] == $mes_selecionado_id) ? 'selected' : '' ?>>
                                    <?= str_pad($mes['mes'], 2, '0', STR_PAD_LEFT) . '/' . $mes['ano'] ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label for="busca"><i class="fas fa-search"></i> Buscar Empresa</label>
                        <input type="text" id="busca" name="busca" class="form-control form-control-sm" placeholder="Nome, CNPJ ou Código" value="<?= htmlspecialchars($filtros['busca']) ?>">
                    </div>
                    <div class="filter-group">
                        <label for="responsavel_id"><i class="fas fa-user"></i> Responsável</label>
                        <select id="responsavel_id" name="responsavel_id" class="form-select form-select-sm">
                            <option value="">Todos</option>
                            <option value="0" <?= ($filtros['responsavel_id'] === '0') ? 'selected' : '' ?>>Sem Responsável</option>
                            <?php foreach ($responsaveis_disponiveis as $responsavel) : ?>
                                <option value="<?= $responsavel['id'] ?>" <?= ($filtros['responsavel_id'] == $responsavel['id']) ? 'selected' : '' ?>><?= htmlspecialchars($responsavel['nome']) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label for="tributacao"><i class="fas fa-balance-scale"></i> Tributação</label>
                        <select id="tributacao" name="tributacao" class="form-select form-select-sm">
                            <option value="">Todas</option>
                            <?php foreach ($tributacoes_disponiveis as $item) : ?>
                                <option value="<?= htmlspecialchars($item['tributacao']) ?>" <?= ($filtros['tributacao'] == $item['tributacao']) ? 'selected' : '' ?>><?= htmlspecialchars($item['tributacao']) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label for="grupo"><i class="fas fa-layer-group"></i> Grupo</label>
                        <select id="grupo" name="grupo" class="form-select form-select-sm">
                            <option value="">Todos</option>
                            <?php foreach ($grupos_disponiveis as $item) : ?>
                                <option value="<?= htmlspecialchars($item['grupo']) ?>" <?= ($filtros['grupo'] == $item['grupo']) ? 'selected' : '' ?>><?= htmlspecialchars($item['grupo']) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="filter-buttons-action">
                        <button type="submit" class="btn btn-primary btn-sm"><i class="fas fa-filter"></i> Filtrar</button>
                        <a href="dp_admin.php?mes_id=<?= $mes_selecionado_id ?>" class="btn btn-secondary btn-sm">Limpar</a>
                        <button type="button" id="btn-preparar-exportacao-dp" class="btn btn-success btn-sm" data-mes-id="<?= $mes_selecionado_id ?>"><i class="fas fa-file-excel"></i> Exportar</button>
                        <button type="button" class="btn btn-info btn-sm" id="btnAbrirModalCertificados" style="background-color: #6c757d; color: white; border:none;"><i class="fas fa-id-card"></i> Info. Certificados</button>
                    </div>
                </div>
            </form>
        </div>
        <div class="detail-card">
            <div class="detail-header">
                <div>
                    <h4 style="margin:0; color: #333; font-weight: 700;"><i class="fas fa-chart-pie"></i> Desempenho do Mês</h4>
                    <small class="text-muted">Progresso Geral: <strong><?= $porcentagem_geral ?>%</strong> (<?= $empresas_100_porcento ?> empresas finalizadas)</small>
                </div>
                <div style="width: 200px;">
                    <div class="progress" style="height: 10px; background-color: #e9ecef; border-radius: 5px;">
                        <?php
                        $cor_geral = 'fill-low';
                        if ($porcentagem_geral >= 50) $cor_geral = 'fill-mid';
                        if ($porcentagem_geral >= 90) $cor_geral = 'fill-high';
                        ?>
                        <div class="progress-bar mini-fill <?= $cor_geral ?>" role="progressbar" style="width: <?= $porcentagem_geral ?>%"></div>
                    </div>
                </div>
            </div>

            <div class="detail-grid">
                <?php foreach ($stats_detalhadas as $stat):
                    $perc = $stat['porcentagem'];
                    $mini_cor = 'fill-low';
                    if ($perc >= 50) $mini_cor = 'fill-mid';
                    if ($perc >= 90) $mini_cor = 'fill-high';
                ?>
                    <div class="detail-item">
                        <div class="detail-title">
                            <span><?= $stat['label'] ?></span>
                            <span><?= $perc ?>%</span>
                        </div>
                        <div class="mini-progress">
                            <div class="mini-fill <?= $mini_cor ?>" style="width: <?= $perc ?>%;"></div>
                        </div>
                        <div style="font-size: 0.75rem; color: #777; text-align: right; margin-top:5px;">
                            Feitos: <strong><?= $stat['feitos'] ?></strong> / <?= $stat['total'] ?>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>
        <div class="stats-container">
            <div class="stats-box <?= ($alerta_certificado_iminente) ? 'alert' : '' ?>" id="btnCertificadosVencendo" style="cursor: pointer;">
                <h3><i class="<?= $alerta_certificado_iminente ? 'fas fa-exclamation-triangle' : 'fas fa-id-card' ?>"></i> Certificados a Vencer</h3>
                <div class="stats-numbers"><?= $certificados_a_vencer ?> certificados</div>
                <p>Vencimentos futuros</p>
                <?php if ($certificados_a_vencer > 0) : ?>
                    <a href="exportar_certificados.php" class="btn-exportar-dp" title="Exportar lista"><i class="fas fa-file-excel"></i></a>
                <?php endif; ?>
            </div>
            <div class="stats-box <?= ($alerta_procuracao_iminente) ? 'alert' : '' ?>" id="btnProcuracoesVencendo" style="cursor: pointer;">
                <h3><i class="<?= $alerta_procuracao_iminente ? 'fas fa-exclamation-triangle' : 'fas fa-user-clock' ?>"></i> Procurações a Vencer</h3>
                <div class="stats-numbers"><?= $procuracoes_a_vencer ?> procurações</div>
                <p>Vencimentos futuros</p>
            </div>
        </div>

        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Código <i class="fas fa-filter column-filter-icon"></i> <span class="sort-icon" data-column-index="0" data-sort-type="numeric"><i class="fas fa-sort"></i></span></th>
                        <th>Empresa <span class="sort-icon" data-column-index="1" data-sort-type="text"><i class="fas fa-sort"></i></span></th>
                        <th>Responsável <i class="fas fa-filter column-filter-icon"></i></th>
                        <th>CNPJ</th>
                                        <?php if ($exibir_alteracoes_pasta): ?>
    <th style="min-width: 150px;">
        Alterações Pasta <i class="fas fa-filter column-filter-icon"></i>
    </th>
<?php endif; ?>
                        <th>Status <i class="fas fa-filter column-filter-icon"></i></th>

                        <th>Grupo <i class="fas fa-filter column-filter-icon"></i></th>

                        <th>Insc. Estadual</th>
                        <th>Insc. Municipal</th>
                        <th>Login Pref.</th>
                        <th>Senha Pref.</th>
                        <th>Senha Giss</th>
                        <th>Link Pref.</th>
                        <th style="min-width: 100px;">Tributação <i class="fas fa-filter column-filter-icon"></i></th>
                        <th>Tipo <i class="fas fa-filter column-filter-icon"></i> </th>
                        <th>Envio <i class="fas fa-filter column-filter-icon"></i></th>
                        <th>Munícipio <i class="fas fa-filter column-filter-icon"></i></th>
                        <th>Observações <i class="fas fa-filter column-filter-icon"></i></th>
                        <th style="min-width: 100px;">ADTO <i class="fas fa-filter column-filter-icon"></i></th>
                        <th style="min-width: 100px;">Folha Pagto <i class="fas fa-filter column-filter-icon"></i></th>
                                            <th class="th-13" style="min-width: 120px;">Data Calc. Folha <i class="fas fa-filter column-filter-icon"></i></th>
    <th class="th-13" style="min-width: 120px;">Data Envio Folha <i class="fas fa-filter column-filter-icon"></i></th>
                        <th style="min-width: 100px;">Tipo Folha <i class="fas fa-filter column-filter-icon"></i></th>
                        <th style="min-width: 100px;">Data Pagto <i class="fas fa-filter column-filter-icon"></i></th>
                        <th style="min-width: 80px;">Qtde Func. </th>
                        <th style="min-width: 100px;">Guias Sind. <i class="fas fa-filter column-filter-icon"></i></th>
                        <th style="min-width: 100px;">FGTS Dig. <i class="fas fa-filter column-filter-icon"></i></th>
                        <th style="min-width: 100px;">E-Social <i class="fas fa-filter column-filter-icon"></i></th>
                        <th style="min-width: 100px;">DCTF Web <i class="fas fa-filter column-filter-icon"></i></th>
                        <th style="min-width: 100px;">SD Login <i class="fas fa-filter column-filter-icon"></i></th>
                        <th style="min-width: 100px;">SD Senha <i class="fas fa-filter column-filter-icon"></i></th>

                        <?php if ($exibir_colunas_13): ?>
    <th class="th-13" style="min-width: 120px;">ADTO 13º <i class="fas fa-filter column-filter-icon"></i></th>
    <th class="th-13" style="min-width: 120px;">Data Calc. 13º <i class="fas fa-filter column-filter-icon"></i></th>
    <th class="th-13" style="min-width: 120px;">Data Envio 13º <i class="fas fa-filter column-filter-icon"></i></th>
    
    <th class="th-13" style="min-width: 120px;">Folha 13º <i class="fas fa-filter column-filter-icon"></i></th>

<?php endif; ?>

                        <th style="min-width: 100px;">REINF <i class="fas fa-filter column-filter-icon"></i></th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($empresas)) : ?>
                        <tr>
                            <td colspan="32" style="text-align:center; padding: 20px;">Nenhuma empresa encontrada.</td>
                        </tr>
                    <?php else : ?>
                        <?php foreach ($empresas as $empresa) : ?>
                            <tr data-id="<?= $empresa['id']; ?>" data-id-mes="<?= $empresa['id_mes']; ?>" data-cnpj="<?= htmlspecialchars($empresa['cnpj'] ?? ''); ?>">
                                <td><?= htmlspecialchars($empresa['codigo'] ?? ''); ?></td>
                                <td title="<?= htmlspecialchars($empresa['empresa']); ?>"><?= htmlspecialchars($empresa['empresa']); ?></td>
                                <td>
                                    <select class="form-select form-select-sm select-responsavel">
                                        <option value="0">Nenhum</option>
                                        <?php foreach ($responsaveis_disponiveis as $responsavel) : ?>
                                            <option value="<?= $responsavel['id']; ?>" <?= ($responsavel['id'] == $empresa['responsavel_id']) ? 'selected' : ''; ?>><?= htmlspecialchars($responsavel['nome']); ?></option>
                                        <?php endforeach; ?>
                                    </select>
                                </td>
                                <td><?= htmlspecialchars($empresa['cnpj'] ?? ''); ?></td>
                                        <?php if ($exibir_alteracoes_pasta): ?>
    <td class="editable" data-coluna="alteracoes_pasta">
        <select class="form-select form-select-sm editable-select">
            <option value="Pendente" <?= (($empresa['alteracoes_pasta'] ?? 'Pendente') == 'Pendente') ? 'selected' : '' ?>>
                Pendente
            </option>
            <option value="Concluído" <?= (($empresa['alteracoes_pasta'] ?? '') == 'Concluído') ? 'selected' : '' ?>>
                Concluído
            </option>
        </select>
    </td>
<?php endif; ?>
                                <td><?= htmlspecialchars($empresa['status_dp']); ?></td>
                                <td><?= htmlspecialchars($empresa['grupo'] ?? ''); ?> </td>
                                <td><?= htmlspecialchars($empresa['insc_estadual'] ?? ''); ?></td>
                                <td><?= htmlspecialchars($empresa['insc_municipal'] ?? ''); ?></td>
                                <td><?= htmlspecialchars($empresa['login_prefeitura'] ?? ''); ?></td>
                                <td><?= htmlspecialchars($empresa['senha_prefeitura_ginfes'] ?? ''); ?></td>
                                <td><?= htmlspecialchars($empresa['senha_giss_online'] ?? ''); ?></td>
                                <td><?= htmlspecialchars($empresa['link_prefeitura'] ?? ''); ?></td>
                                <td><?= htmlspecialchars($empresa['tributacao'] ?? ''); ?></td>
                                <td><?= htmlspecialchars($empresa['tipo'] ?? ''); ?></td>
                                <td><?= htmlspecialchars($empresa['envio'] ?? ''); ?></td>
                                <td><?= htmlspecialchars($empresa['municipio'] ?? ''); ?></td>
                                <td class="editable" contenteditable="true" data-coluna="observacoes_dp"><?= htmlspecialchars($empresa['observacoes_dp'] ?? ''); ?></td>
                                <td class="editable" contenteditable="true" data-coluna="adto"><?= htmlspecialchars($empresa['adto'] ?? ''); ?></td>
                                <td class="editable" data-coluna="folha_pagamento">
                                    <select class="form-select form-select-sm editable-select">
                                        <option value="" <?= (!isset($empresa['folha_pagamento']) || $empresa['folha_pagamento'] === '') ? 'selected' : '' ?>>Selecione</option>
                                        <option value="5º dia útil" <?= (($empresa['folha_pagamento'] ?? '') == '5º dia útil') ? 'selected' : '' ?>>5º dia útil</option>
                                        <option value="Ultimo dia" <?= (($empresa['folha_pagamento'] ?? '') == 'Ultimo dia') ? 'selected' : '' ?>>Ultimo dia</option>
                                        <option value="N/A" <?= (($empresa['folha_pagamento'] ?? '') == 'N/A') ? 'selected' : '' ?>>N/A</option>
                                    </select>
                                </td>
                                            <td class="editable" contenteditable="true" data-coluna="data_calculo_folha13">
        <?= htmlspecialchars(formatarDataBR($empresa['data_calculo_folha13'] ?? '')); ?>
    </td>
    <td class="editable" contenteditable="true" data-coluna="data_envio_folha13">
        <?= htmlspecialchars(formatarDataBR($empresa['data_envio_folha13'] ?? '')); ?>
    </td>
                                <td class="editable" data-coluna="tipo_folha">
                                    <select class="form-select form-select-sm editable-select">
                                        <option value="" <?= (!isset($empresa['tipo_folha']) || $empresa['tipo_folha'] === '') ? 'selected' : '' ?>>Selecione</option>
                                        <option value="Pro Labore" <?= (($empresa['tipo_folha'] ?? '') == 'Pro Labore') ? 'selected' : '' ?>>Pro Labore</option>
                                        <option value="Normal" <?= (($empresa['tipo_folha'] ?? '') == 'Normal') ? 'selected' : '' ?>>Normal</option>
                                        <option value="Doméstico" <?= (($empresa['tipo_folha'] ?? '') == 'Doméstico') ? 'selected' : '' ?>>Doméstico</option>
                                        <option value="MEI" <?= (($empresa['tipo_folha'] ?? '') == 'MEI') ? 'selected' : '' ?>>MEI</option>
                                        <option value="Sem Movimento" <?= (($empresa['tipo_folha'] ?? '') == 'Sem Movimento') ? 'selected' : '' ?>>Sem Movimento</option>
                                    </select>
                                </td>
                                <td class="editable" data-coluna="data_pagamento">
                                    <select class="form-select form-select-sm editable-select">
                                        <option value="" <?= (!isset($empresa['data_pagamento']) || $empresa['data_pagamento'] === '') ? 'selected' : '' ?>>Selecione</option>
                                        <option value="N/A" <?= (($empresa['data_pagamento'] ?? '') == 'N/A') ? 'selected' : '' ?>>N/A</option>
                                        <option value="15" <?= (($empresa['data_pagamento'] ?? '') == '15') ? 'selected' : '' ?>>Dia 15</option>
                                        <option value="20" <?= (($empresa['data_pagamento'] ?? '') == '20') ? 'selected' : '' ?>>Dia 20</option>
                                    </select>
                                </td>
                                <td class="editable" contenteditable="true" data-coluna="qtde_funcionarios"><?= htmlspecialchars($empresa['qtde_funcionarios'] ?? ''); ?></td>
                                <td class="editable" contenteditable="true" data-coluna="guias_sindicato"><?= htmlspecialchars($empresa['guias_sindicato'] ?? ''); ?></td>
                                <td class="editable" contenteditable="true" data-coluna="fgts_digital"><?= htmlspecialchars($empresa['fgts_digital'] ?? ''); ?></td>
                                <td class="editable" contenteditable="true" data-coluna="e_social"><?= htmlspecialchars($empresa['e_social'] ?? ''); ?></td>
                                <td class="editable" contenteditable="true" data-coluna="dctf_web_mes"><?= htmlspecialchars($empresa['dctf_web_mes'] ?? ''); ?></td>
                                <td class="editable" contenteditable="true" data-coluna="sd_login"><?= htmlspecialchars($empresa['sd_login'] ?? ''); ?></td>
                                <td class="editable" contenteditable="true" data-coluna="sd_senha"><?= htmlspecialchars($empresa['sd_senha'] ?? ''); ?></td>

                              <?php if ($exibir_colunas_13): ?>
    <td class="editable" contenteditable="true" data-coluna="ADTO13">
        <?= htmlspecialchars($empresa['ADTO13'] ?? ''); ?>
    </td>
    <td class="editable" contenteditable="true" data-coluna="data_calculo_adto13">
        <?= htmlspecialchars(formatarDataBR($empresa['data_calculo_adto13'] ?? '')); ?>
    </td>
    <td class="editable" contenteditable="true" data-coluna="data_envio_adto13">
        <?= htmlspecialchars(formatarDataBR($empresa['data_envio_adto13'] ?? '')); ?>
    </td>

    <td class="editable" contenteditable="true" data-coluna="FOLHA13">
        <?= htmlspecialchars($empresa['FOLHA13'] ?? ''); ?>
    </td>

<?php endif; ?>

<td class="reinf-trigger text-center" data-coluna="reinf" style="cursor: pointer;" title="Clique para ver detalhes">
    <?php
    $statusBanco = htmlspecialchars($empresa['reinf'] ?? '');
    if (empty($statusBanco)) {
        echo '<span class="badge bg-secondary">Pendente</span>';
    } elseif ($statusBanco === 'N/A') {
        echo '<span class="badge badge-na">N/A</span>';
    } elseif (stripos($statusBanco, 'Pendência') === 0) {
        echo '<span class="badge badge-pendencia" title="' . $statusBanco . '">Pendência</span>';
    } elseif (stripos($statusBanco, 'OK') === 0) {
        // Pega OK - Data ou OK - SEM MOVIMENTO e pinta de verde
        echo '<span class="badge badge-ok">' . $statusBanco . '</span>';
    } else {
        // Caso tenha algum texto antigo/diferente
        echo '<span class="badge bg-info text-dark">' . $statusBanco . '</span>';
    }
    ?>
</td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>

    <div id="modalRelatorioExportacaoDP" class="modal-overlay">
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-clipboard-check"></i> Análise da Exportação (DP)</h3><button class="modal-close">&times;</button>
            </div>
            <div class="modal-body" id="feedback-exportacao-body-dp">
                <div class="loading-content" style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin fa-2x"></i>
                    <p style="margin-top: 10px;">Analisando dados para exportação...</p>
                </div>
            </div>
        </div>
    </div>

    <div id="modalDetalhesReinf" class="modal-overlay">
        <div class="modal-container" style="width: 500px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-eye"></i> Visualizar Detalhes REINF</h3><button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <form id="formReinfDetalhes">
                    <div class="row g-2">
                        <div class="col-6 mb-2"><label class="form-label small">IRRF 1708</label><input type="text" class="form-control form-control-sm" id="reinf_irrf_1708" readonly></div>
                        <div class="col-6 mb-2"><label class="form-label small">CRF 5952</label><input type="text" class="form-control form-control-sm" id="reinf_crf_5952" readonly></div>
                        <div class="col-6 mb-2"><label class="form-label small">INSS Prestados</label><input type="text" class="form-control form-control-sm" id="reinf_inss_prestados" readonly></div>
                        <div class="col-6 mb-2"><label class="form-label small">INSS Tomados</label><input type="text" class="form-control form-control-sm" id="reinf_inss_tomados" readonly></div>
                        <div class="col-6 mb-2"><label class="form-label small">Desoneração</label><input type="text" class="form-control form-control-sm" id="reinf_desoneracao" readonly></div>
                        <div class="col-6 mb-2"><label class="form-label small">IRRF 3208</label><input type="text" class="form-control form-control-sm" id="reinf_irrf_3208" readonly></div>
                        <div class="col-12 mb-3"><label class="form-label small">Outros</label><input type="text" class="form-control form-control-sm" id="reinf_outros" readonly></div>
                    </div>
                    <div class="alert alert-info small mb-0"><i class="fas fa-info-circle"></i> Apenas leitura.</div>
                </form>
            </div>
        </div>
    </div>

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="scripts_globais.js"></script>
    <script>
        function setupModalSearchBars() {
            $('#searchCertificadosInput').on('keyup', function() {
                const termo = $(this).val().toLowerCase();
                $('#tableCertificados tbody tr').each(function() {
                    const linha = $(this);
                    const textoLinha = linha.text().toLowerCase();
                    linha.toggle(textoLinha.includes(termo));
                });
            });
        }

        function setupModais() {
            const modais = {
                'btnCertificadosVencendo': 'modalCertificadosVencendo',
                'btnProcuracoesVencendo': 'modalProcuracoesVencendo',
                'btnAbrirModalCertificados': 'modalCertificados',
                'btn-preparar-exportacao-dp': 'modalRelatorioExportacaoDP'
            };
            Object.keys(modais).forEach(botaoId => {
                const botao = document.getElementById(botaoId);
                if (botao) {
                    botao.addEventListener('click', () => {
                        const modal = document.getElementById(modais[botaoId]);
                        if (modal) {
                            modal.classList.add('active');
                            document.body.style.overflow = 'hidden';
                            if (botaoId === 'btn-preparar-exportacao-dp') {
                                chamarAnaliseExportacaoDP(botao.dataset.mesId);
                            }
                        }
                    });
                }
            });
            document.querySelectorAll('.modal-close').forEach(btn => {
                btn.addEventListener('click', function() {
                    const modal = this.closest('.modal-overlay');
                    if (modal) {
                        modal.classList.remove('active');
                        if (!document.querySelector('.modal-overlay.active')) document.body.style.overflow = '';
                    }
                });
            });
            document.querySelectorAll('.modal-overlay').forEach(modal => {
                modal.addEventListener('click', function(e) {
                    if (e.target === this) {
                        this.classList.remove('active');
                        if (!document.querySelector('.modal-overlay.active')) document.body.style.overflow = '';
                    }
                });
            });
        }

        $(document).ready(function() {
            setupModais();
            setupModalSearchBars();
            setupTableSorting();
            setupEnterKeyNavigation();

            let columnFilters = {};

            $('.data-table').on('click', '.column-filter-icon', function(event) {
                event.stopPropagation();
                const th = $(this).closest('th');
                const colIndex = th.index();
                const uniqueValues = new Set();

                $('.data-table tbody tr').each(function() {
                    const cell = $(this).find('td').eq(colIndex);
                    let cellValue = '';
                    if (cell.find('select').length > 0) {
                        cellValue = cell.find('select option:selected').text().trim();
                    } else {
                        cellValue = cell.text().trim();
                    }
                    uniqueValues.add(cellValue === '' ? '(Vazias)' : cellValue);
                });

                let dropdownHTML = `<div class="filter-option" data-col="${colIndex}" data-value="*">-- Todos --</div>`;
                [...uniqueValues].sort((a, b) => a.localeCompare(b, 'pt-BR')).forEach(value => {
                    const escapedValue = $('<div>').text(value).html();
                    dropdownHTML += `<div class="filter-option" data-col="${colIndex}" data-value="${escapedValue}">${escapedValue}</div>`;
                });

                const dropdown = $('#column-filter-dropdown');
                dropdown.html(dropdownHTML).show();
                const iconPos = $(this).offset();
                const iconHeight = $(this).outerHeight();
                dropdown.css({
                    top: iconPos.top + iconHeight + 5,
                    left: iconPos.left - (dropdown.outerWidth() / 2) + ($(this).outerWidth() / 2)
                });
            });

            $(document).on('click', '.filter-option', function() {
                const colIndex = $(this).data('col');
                const value = $(this).data('value');
                if (value === '*') {
                    delete columnFilters[colIndex];
                    $('.data-table th').eq(colIndex).find('.column-filter-icon').css('color', '');
                } else {
                    columnFilters[colIndex] = String(value);
                    $('.data-table th').eq(colIndex).find('.column-filter-icon').css('color', '#3498db');
                }
                applyTableFilters();
                $('#column-filter-dropdown').hide();
            });

            function applyTableFilters() {
                $('.data-table tbody tr').each(function() {
                    const row = $(this);
                    let isVisible = true;
                    for (const colIndex in columnFilters) {
                        const requiredValue = columnFilters[colIndex];
                        const cell = row.find('td').eq(colIndex);
                        let rowValue = cell.find('select').length > 0 ? cell.find('select option:selected').text().trim() : cell.text().trim();
                        if (requiredValue === '(Vazias)' && rowValue !== '') {
                            isVisible = false;
                            break;
                        } else if (requiredValue !== '(Vazias)' && rowValue !== requiredValue) {
                            isVisible = false;
                            break;
                        }
                    }
                    row.toggle(isVisible);
                });
            }

            $(document).on('click', function(event) {
                if (!$(event.target).closest('#column-filter-dropdown').length && !$(event.target).hasClass('column-filter-icon')) {
                    $('#column-filter-dropdown').hide();
                }
            });

            // Ordenação
let currentSort = {
    index: -1,
    direction: 'none'
};

function setupTableSorting() {
    $('.data-table thead').on('click', '.sort-icon', function() {
        const iconElement = $(this);
        const colIndex = parseInt(iconElement.data('column-index'), 10);
        const sortType = iconElement.data('sort-type');
        let newDirection = (currentSort.index !== colIndex || currentSort.direction === 'desc') ? 'asc' : 'desc';

        currentSort.index = colIndex;
        currentSort.direction = newDirection;

        $('.sort-icon i').removeClass('fa-sort-up fa-sort-down').addClass('fa-sort');
        iconElement.find('i')
            .removeClass('fa-sort')
            .addClass(newDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down');

        const tbody = $('.data-table tbody');
        const rows = tbody.find('tr').toArray();

        rows.sort(function(rowA, rowB) {
            const cellA = $(rowA).find('td').eq(colIndex).text().trim();
            const cellB = $(rowB).find('td').eq(colIndex).text().trim();

            let comparison = sortType === 'numeric'
                ? cellA.localeCompare(cellB, undefined, {
                    numeric: true,
                    sensitivity: 'base'
                })
                : cellA.localeCompare(cellB, 'pt-BR', {
                    sensitivity: 'base'
                });

            return (newDirection === 'asc') ? comparison : -comparison;
        });

        // NÃO usar empty()
        tbody.append(rows);
    });
}

            function setupEnterKeyNavigation() {
                const selector = 'td.editable[contenteditable="true"], select.editable-select, select.select-responsavel';
                $('.data-table tbody').on('keydown', selector, function(event) {
                    if (event.key === 'Enter' || event.key === 'Tab') {
                        event.preventDefault();
                        const currentCell = $(this).closest('td');
                        const currentRow = currentCell.closest('tr');
                        let targetCell;

                        if (event.key === 'Enter') {
                            if (event.shiftKey) {
                                targetCell = currentRow.prev('tr:visible').find('td').eq(currentCell.index());
                            } else {
                                targetCell = currentRow.next('tr:visible').find('td').eq(currentCell.index());
                            }
                        } else {
                            if (event.shiftKey) {
                                targetCell = currentCell.prevAll('td.editable:visible, td:has(select.select-responsavel):visible').first();
                                if (!targetCell.length) targetCell = currentRow.prev('tr:visible').find('td.editable:visible, td:has(select.select-responsavel):visible').last();
                            } else {
                                targetCell = currentCell.nextAll('td.editable:visible, td:has(select.select-responsavel):visible').first();
                                if (!targetCell.length) targetCell = currentRow.next('tr:visible').find('td.editable:visible, td:has(select.select-responsavel):visible').first();
                            }
                        }

                        if (targetCell && targetCell.length) {
                            let focusable = targetCell.find('select.editable-select, select.select-responsavel, [contenteditable="true"]');
                            if (!focusable.length && targetCell.is('[contenteditable="true"]')) focusable = targetCell;
                            if (focusable.length) {
                                focusable.focus();
                                if (focusable.is('[contenteditable="true"]')) document.execCommand('selectAll', false, null);
                            }
                        }
                    }
                });
            }

            // Salvar Edição
            function salvarEdicao(elemento) {
                const cell = $(elemento).closest('.editable');
                const row = cell.closest('tr');
                const id = row.data('id');
                const cnpj = row.data('cnpj');
                const coluna = cell.data('coluna');
                const valor = $(elemento).is('[contenteditable]') ? $(elemento).text().trim() : $(elemento).val();

                const colunasGlobais = ['folha_pagamento', 'data_pagamento', 'tipo_folha', 'sd_login', 'sd_senha', 'ADTO13', 'FOLHA13', 'data_calculo_adto13', 'data_envio_adto13', 'data_calculo_folha13', 'data_envio_folha13'];
                let atualizarTodos = colunasGlobais.includes(coluna);

                if (atualizarTodos && !cnpj) {
                    alert('Erro: CNPJ não encontrado.');
                    return;
                }

                cell.css('opacity', 0.5);
                if (atualizarTodos) cell.css('border', '2px solid orange');

                $.ajax({
                    url: 'salvar_edicao_dp.php',
                    method: 'POST',
                    data: {
                        atualizar_todos_meses: atualizarTodos,
                        id: id,
                        cnpj: cnpj,
                        coluna: coluna,
                        valor: valor
                    },
                    dataType: 'json',
                    success: function(response) {
                        if (response.success) {
                            cell.css('border', '2px solid green');
                            if ($(elemento).is('[contenteditable]')) elemento.dataset.originalValue = valor;
                            else elemento.dataset.originalValueSelect = valor;
                        } else {
                            cell.css('border', '2px solid red');
                            alert('Erro ao salvar: ' + (response.message || 'Erro desconhecido'));
                        }
                    },
                    error: function() {
                        cell.css('border', '2px solid red');
                        alert('Erro de comunicação.');
                    },
                    complete: function() {
                        cell.css('opacity', 1);
                        setTimeout(() => cell.css('border', ''), 2000);
                    }
                });
            }

$('.data-table tbody')
    .on('focus', 'td[contenteditable="true"]', function() {
        this.dataset.originalValue = $(this).text().trim();
    })
    .on('blur', 'td[contenteditable="true"]', function() {
        if ($(this).text().trim() !== this.dataset.originalValue) {
            salvarEdicao(this);
        }
    });

$('.data-table tbody')
    .on('focus', '.editable-select', function() {
        this.dataset.originalValueSelect = $(this).val();
    })
    .on('change', '.editable-select', function() {
        if ($(this).val() !== this.dataset.originalValueSelect) {
            salvarEdicao(this);
        }
    });

$('.data-table tbody')
    .on('change', '.select-responsavel', function() {
        const select = $(this);
        const row = select.closest('tr');
        select.css('opacity', 0.5);

        $.ajax({
            url: 'salvar_responsavel_dp.php',
            method: 'POST',
            data: {
                id_empresa: row.data('id'),
                id_mes: row.data('id-mes'),
                novo_responsavel_id: select.val()
            },
            dataType: 'json',
            success: function(res) {
                if (res.success) {
                    select.css('border', '2px solid green');
                } else {
                    select.css('border', '2px solid red');
                    alert('Erro: ' + res.message);
                }
            },
            error: function() {
                select.css('border', '2px solid red');
                alert('Erro de comunicação.');
            },
            complete: function() {
                select.css('opacity', 1);
                setTimeout(() => select.css('border', ''), 2000);
            }
        });
    });

            // REINF
            $('.data-table').on('click', '.reinf-trigger', function() {
                const row = $(this).closest('tr');
                $('#modalDetalhesReinf').addClass('active');
                $('#formReinfDetalhes input').val('Carregando...');
                $.ajax({
                    url: 'assets/backend/obter_detalhes_reinf.php',
                    method: 'GET',
                    data: {
                        id: row.data('id')
                    },
                    dataType: 'json',
                    success: function(res) {
                        if (res.success) {
                            $('#reinf_irrf_1708').val(res.dados.irrf_1708 || '-');
                            $('#reinf_crf_5952').val(res.dados.crf_5952 || '-');
                            $('#reinf_inss_prestados').val(res.dados.inss_prestados || '-');
                            $('#reinf_inss_tomados').val(res.dados.inss_tomados || '-');
                            $('#reinf_desoneracao').val(res.dados.desoneracao || '-');
                            $('#reinf_irrf_3208').val(res.dados.irrf_3208 || '-');
                            $('#reinf_outros').val(res.dados.outros || '-');
                        } else {
                            alert('Erro ao buscar detalhes.');
                            $('#modalDetalhesReinf').removeClass('active');
                        }
                    },
                    error: function() {
                        alert('Erro de comunicação.');
                        $('#modalDetalhesReinf').removeClass('active');
                    }
                });
            });
        });

        function chamarAnaliseExportacaoDP(mes_id) {
            const modalBody = $('#feedback-exportacao-body-dp');
            modalBody.html('<div class="loading-content" style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 10px;">Analisando dados...</p></div>');
            $.ajax({
                url: 'analisar_exportacao_dp.php',
                method: 'GET',
                data: {
                    mes_id: mes_id
                },
                dataType: 'json',
                success: function(response) {
                    if (response.success) {
                        let html = `<p><strong>${response.validas} de ${response.total} empresas serão exportadas.</strong></p>`;
                        if (response.falhas.length > 0) {
                            html += `<p class="text-danger">${response.falhas.length} empresas NÃO serão incluídas:</p>`;
                            html += '<ul style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; padding: 15px; background: #f9f9f9; border-radius: 4px;">';
                            response.falhas.forEach(function(falha) {
                                html += `<li style="margin-bottom: 5px;"><strong>${falha.codigo} - ${falha.empresa}</strong><br><small>Motivo: ${falha.motivo}</small></li>`;
                            });
                            html += '</ul><p style="margin-top: 10px;"><small><strong>Possível Solução:</strong> Verifique se "setores_permitidos" contém "dp".</small></p>';
                        } else {
                            html += '<p class="text-success">Tudo certo! Todas as empresas da competência serão exportadas.</p>';
                        }
                        html += `<div class="modal-footer" style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px; text-align: right;"><a href="exportar_dp.php?mes_id=${mes_id}" class="btn btn-success"><i class="fas fa-download"></i> Baixar Relatório (${response.validas} empresas)</a></div>`;
                        modalBody.html(html);
                    } else {
                        modalBody.html('<p class="text-danger"><strong>Erro ao analisar:</strong> ' + (response.message || 'Erro desconhecido') + '</p>');
                    }
                },
                error: function() {
                    modalBody.html('<p class="text-danger">Erro de comunicação com o servidor.</p>');
                }
            });
        }
    </script>
</body>

</html>