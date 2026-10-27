<?php
// cushman.php

ini_set('display_errors', 1);
error_reporting(E_ALL);
require_once 'assets/backend/config.php';
session_start();

if (!isset($_SESSION['usuario_id'])) {
    header('Location: index.php');
    exit();
}

$tipo_conta_logado = $_SESSION['tipo_conta'] ?? '';
if ($tipo_conta_logado !== 'admin' && $tipo_conta_logado !== 'cadastro') {
    $_SESSION['mensagem'] = 'Acesso não autorizado a esta página.';
    header('Location: dashboard.php');
    exit();
}

function obterMesesDisponiveis($conexao)
{
    $query = "SELECT id, mes, ano FROM controle_meses ORDER BY ano DESC, mes DESC";
    $resultado = $conexao->query($query);
    return $resultado ? $resultado->fetch_all(MYSQLI_ASSOC) : [];
}

$meses_disponiveis = obterMesesDisponiveis($conexao);
$mes_selecionado_id = isset($_GET['mes_id']) ? (int)$_GET['mes_id'] : ($meses_disponiveis[0]['id'] ?? null);

function obterDadosCushman($conexao, $id_mes)
{
    if (!$id_mes) {
        return [];
    }

    $query = "SELECT 
                cf.id, cf.codigo, cf.empresa, cf.cnpj, cf.municipio, cf.certificado_cliente, 
                cf.tipo_certificado, cf.senha_certificado, cf.data_emissao_certificado, 
                cf.data_vencimento_certificado, cf.data_procuracao_target, 
                cf.insc_municipal, cf.login_prefeitura, cf.senha_prefeitura_ginfes, 
                cf.senha_giss_online, cf.insc_estadual, cf.observacoes, cf.iss_cushman, 
                cf.devec_cushman, cf.sped_fiscal_cushman, cf.reinf_cushman, cf.esocial_cushman, 
                cf.status_cushman, cf.data_contrato, cf.data_obrigacao, cf.data_saida,
                cf.link_prefeitura 
            FROM controle_fechamento cf
            INNER JOIN controle_meses cm ON cm.id = cf.id_mes
            WHERE 
                cf.id_mes = ? 
                AND cf.setores_permitidos LIKE ?
                AND (
                    cf.data_saida IS NULL
                    OR cf.data_saida = ''
                    OR cf.data_saida = '0000-00-00'
                    OR cf.data_saida > LAST_DAY(
                        STR_TO_DATE(
                            CONCAT(cm.ano, '-', LPAD(cm.mes, 2, '0'), '-01'),
                            '%Y-%m-%d'
                        )
                    )
                )
            ORDER BY cf.empresa ASC";

    $stmt = $conexao->prepare($query);
    $searchTerm = '%cushman%';
    $stmt->bind_param('is', $id_mes, $searchTerm);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

function formatarDataBR($data)
{
    if (empty($data) || $data === '0000-00-00') {
        return '';
    }
    try {
        $dateObj = new DateTime($data);
        return $dateObj->format('d/m/Y');
    } catch (Exception $e) {
        return $data;
    }
}

$empresas = obterDadosCushman($conexao, $mes_selecionado_id);
$total_empresas = count($empresas);
$municipios_unicos = count(array_unique(array_column($empresas, 'municipio')));

// =======================================================================
// == CÁLCULO DE VENCIMENTOS ==
// =======================================================================
$certificados_a_vencer = 0;
$procuracoes_a_vencer = 0;
$empresas_certificados_vencendo = [];
$empresas_procuracoes_vencendo = [];

$hoje_obj = new DateTime('today');
$limite_vencimento_obj = (new DateTime('today'))->modify('+30 days');

$hoje_sql = $hoje_obj->format('Y-m-d');
$limite_vencimento_sql = $limite_vencimento_obj->format('Y-m-d');

$query_vencimentos = "
    SELECT 
        sub.empresa,
        sub.data_vencimento_certificado,
        sub.data_procuracao_target
    FROM (
        SELECT 
            cf.empresa,
            cf.cnpj,
            cf.setores_permitidos,
            cf.data_saida,
            cf.data_vencimento_certificado,
            cf.data_procuracao_target,
            ROW_NUMBER() OVER(
                PARTITION BY COALESCE(NULLIF(TRIM(cf.cnpj), ''), CONCAT('ID:', cf.id))
                ORDER BY cm.ano DESC, cm.mes DESC, cf.id DESC
            ) AS rn
        FROM controle_fechamento cf
        INNER JOIN controle_meses cm ON cm.id = cf.id_mes
    ) AS sub
    WHERE 
        sub.rn = 1
        AND sub.setores_permitidos LIKE '%cushman%'
        AND (
            sub.data_saida IS NULL
            OR sub.data_saida = ''
            OR sub.data_saida = '0000-00-00'
            OR sub.data_saida > CURDATE()
        )
        AND (
            (sub.data_vencimento_certificado >= ? AND sub.data_vencimento_certificado < ?) OR
            (sub.data_procuracao_target >= ? AND sub.data_procuracao_target < ?)
        )
";

$stmt_vencimentos = $conexao->prepare($query_vencimentos);
$stmt_vencimentos->bind_param("ssss", $hoje_sql, $limite_vencimento_sql, $hoje_sql, $limite_vencimento_sql);
$stmt_vencimentos->execute();
$resultado_vencimentos = $stmt_vencimentos->get_result();
$empresas_com_vencimentos = $resultado_vencimentos->fetch_all(MYSQLI_ASSOC);
$stmt_vencimentos->close();

foreach ($empresas_com_vencimentos as $empresa_vencimento) {
    if (!empty($empresa_vencimento['data_vencimento_certificado'])) {
        try {
            $data_vencimento_cert = new DateTime($empresa_vencimento['data_vencimento_certificado']);
            if ($data_vencimento_cert >= $hoje_obj && $data_vencimento_cert < $limite_vencimento_obj) {
                $certificados_a_vencer++;
                $intervalo_cert = $hoje_obj->diff($data_vencimento_cert);
                $dias_restantes_cert = $intervalo_cert->days;
                $empresas_certificados_vencendo[] = [
                    'empresa' => $empresa_vencimento['empresa'],
                    'data_vencimento' => formatarDataBR($empresa_vencimento['data_vencimento_certificado']),
                    'dias_restantes' => $dias_restantes_cert
                ];
            }
        } catch (Exception $e) {
        }
    }

    if (!empty($empresa_vencimento['data_procuracao_target'])) {
        try {
            $data_vencimento_proc = new DateTime($empresa_vencimento['data_procuracao_target']);
            if ($data_vencimento_proc >= $hoje_obj && $data_vencimento_proc < $limite_vencimento_obj) {
                $procuracoes_a_vencer++;
                $intervalo_proc = $hoje_obj->diff($data_vencimento_proc);
                $dias_restantes_proc = $intervalo_proc->days;
                $empresas_procuracoes_vencendo[] = [
                    'empresa' => $empresa_vencimento['empresa'],
                    'data_vencimento' => formatarDataBR($empresa_vencimento['data_procuracao_target']),
                    'dias_restantes' => $dias_restantes_proc
                ];
            }
        } catch (Exception $e) {
        }
    }
}

// =======================================================================
// == CÁLCULO DE PROGRESSO DETALHADO (A PARTIR DE ISS CUSHMAN) ==
// =======================================================================
// Aqui definimos EXATAMENTE quais colunas contam para o progresso
$colunas_detalhadas = [
    'iss_cushman'         => 'ISS Cushman',
    'devec_cushman'       => 'DEVEC Cushman',
    'sped_fiscal_cushman' => 'SPED Fiscal',
    'reinf_cushman'       => 'REINF',
    'esocial_cushman'     => 'e-Social'
];

// Inicializa o array de estatísticas detalhadas
$stats_cushman = [];
foreach ($colunas_detalhadas as $col => $label) {
    $stats_cushman[$col] = [
        'label' => $label,
        'total' => $total_empresas,
        'feitos' => 0
    ];
}

$campos_preenchidos_geral = 0;
$total_campos_geral = $total_empresas * count($colunas_detalhadas);

foreach ($empresas as $empresa) {
    foreach ($colunas_detalhadas as $col => $label) {
        $valor = trim($empresa[$col] ?? '');

        // LÓGICA: Só conta se NÃO for vazio E se NÃO for 'pendente' (case insensitive)
        if (!empty($valor) && mb_strtolower($valor, 'UTF-8') !== 'pendente') {
            $stats_cushman[$col]['feitos']++;
            $campos_preenchidos_geral++;
        }
    }
}

// Percentual Global
$progresso_percentual = $total_campos_geral > 0 ? round(($campos_preenchidos_geral / $total_campos_geral) * 100) : 0;
?>
<!DOCTYPE html>
<html lang="pt-br" data-theme="light">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Painel de Controle Cushman</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link rel="stylesheet" href="assets/css/cushman.css">

    <style>
        /* --- ESTILOS DO DETALHAMENTO MENSAL --- */
        .detail-card {
            background: var(--card-bg, #fff);
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
            margin-bottom: 25px;
            border: 1px solid var(--border-color, #eee);
        }

        .detail-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            border-bottom: 1px solid var(--border-color, #eee);
            padding-bottom: 15px;
            flex-wrap: wrap;
            gap: 10px;
        }

        .detail-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 15px;
        }

        .detail-item {
            background: var(--background-color, #f8f9fa);
            padding: 12px;
            border-radius: 6px;
            border: 1px solid var(--border-color, #e9ecef);
        }

        .detail-title {
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--text-color, #555);
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
        }

        .mini-progress {
            height: 6px;
            background: #e0e0e0;
            border-radius: 3px;
            overflow: hidden;
            margin-bottom: 5px;
        }

        .mini-fill {
            height: 100%;
            transition: width 0.5s ease;
        }

        /* Cores das barras */
        .fill-red {
            background-color: #dc3545;
        }

        .fill-yellow {
            background-color: #ffc107;
        }

        .fill-green {
            background-color: #198754;
        }

        .progress {
            background-color: #e9ecef;
            border-radius: 0.25rem;
            height: 10px;
            overflow: hidden;
        }

        .progress-bar {
            height: 100%;
            transition: width .6s ease;
        }

        .bg-danger {
            background-color: #dc3545 !important;
        }

        .bg-warning {
            background-color: #ffc107 !important;
        }

        .bg-success {
            background-color: #198754 !important;
        }

        /* Estilos dos Modais e Tabela */
        .modal-overlay {
            visibility: hidden;
            opacity: 0;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.6);
            z-index: 1000;
            display: flex;
            justify-content: center;
            align-items: center;
            transition: opacity 0.3s ease, visibility 0.3s ease;
        }

        .modal-overlay.active {
            visibility: visible;
            opacity: 1;
        }

        .modal-container {
            background: var(--card-bg, #fff);
            color: var(--text-color, #000);
            padding: 20px;
            border-radius: 8px;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            transform: scale(0.9);
            transition: transform 0.3s ease;
        }

        .modal-overlay.active .modal-container {
            transform: scale(1);
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-color, #ddd);
            padding-bottom: 10px;
            margin-bottom: 15px;
        }

        .modal-title {
            margin: 0;
            font-size: 1.25rem;
        }

        .modal-close {
            background: none;
            border: none;
            font-size: 1.75rem;
            cursor: pointer;
            color: var(--text-color, #000);
        }

        .modal-body .empty-message {
            text-align: center;
            padding: 20px;
            color: var(--text-muted-color, #666);
        }

        .modal-body .empty-message i {
            font-size: 2rem;
            margin-bottom: 10px;
        }

        .modal-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9em;
        }

        .modal-table th,
        .modal-table td {
            padding: 8px 12px;
            border-bottom: 1px solid var(--border-color, #eee);
            text-align: left;
        }

        .modal-table th {
            background-color: var(--background-color, #f9f9f9);
        }

        .badge {
            display: inline-block;
            padding: 0.35em 0.65em;
            font-size: .75em;
            font-weight: 700;
            line-height: 1;
            color: #fff;
            text-align: center;
            white-space: nowrap;
            vertical-align: baseline;
            border-radius: 0.25rem;
        }

        .badge-danger {
            background-color: #dc3545;
        }

        .badge-warning {
            background-color: #ffc107;
            color: #000;
        }

        .badge-success {
            background-color: #198754;
        }
    </style>
</head>

<body>
    <div id="modalCertificadosVencendo" class="modal-overlay">
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-exclamation-triangle"></i> Certificados Vencendo</h3>
                <button class="modal-close">&times;</button>
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
                        <tbody>
                            <?php foreach ($empresas_certificados_vencendo as $item) : ?>
                                <tr>
                                    <td><?= htmlspecialchars($item['empresa']) ?></td>
                                    <td><?= htmlspecialchars($item['data_vencimento']) ?></td>
                                    <td>
                                        <?php
                                        $badge_class = 'badge-success';
                                        if ($item['dias_restantes'] <= 7) $badge_class = 'badge-danger';
                                        elseif ($item['dias_restantes'] <= 15) $badge_class = 'badge-warning';
                                        ?>
                                        <span class="badge <?= $badge_class ?>"> <?= $item['dias_restantes'] ?> dia(s) </span>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php else : ?>
                    <div class="empty-message"><i class="fas fa-check-circle"></i>
                        <p>Nenhum certificado vencendo.</p>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    </div>

    <div id="modalProcuracoesVencendo" class="modal-overlay">
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-user-clock"></i> Procurações Vencendo</h3>
                <button class="modal-close">&times;</button>
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
                        <tbody>
                            <?php foreach ($empresas_procuracoes_vencendo as $item) : ?>
                                <tr>
                                    <td><?= htmlspecialchars($item['empresa']) ?></td>
                                    <td><?= htmlspecialchars($item['data_vencimento']) ?></td>
                                    <td>
                                        <?php
                                        $badge_class = 'badge-success';
                                        if ($item['dias_restantes'] <= 7) $badge_class = 'badge-danger';
                                        elseif ($item['dias_restantes'] <= 15) $badge_class = 'badge-warning';
                                        ?>
                                        <span class="badge <?= $badge_class ?>"> <?= $item['dias_restantes'] ?> dia(s) </span>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php else : ?>
                    <div class="empty-message"><i class="fas fa-check-circle"></i>
                        <p>Nenhuma procuração vencendo.</p>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    </div>

    <div class="progress-container-main">
        <div class="progress-bar-main" style="width: <?= $progresso_percentual ?>%;"></div>
    </div>

    <header class="header">
        <h1><i class="fas fa-tachometer-alt"></i> Painel Cushman</h1>
        <div style="display: flex; align-items: center; gap: 1rem;">
            <a href="cadastrar.php" class="btn btn-outline btn-sm"><i class="fas fa-edit"></i> Área Cadastro</a>
            <?php if ($tipo_conta_logado === 'admin'): ?>
                <a href="dashboard.php" class="btn btn-outline btn-sm"><i class="fas fa-arrow-left"></i> Voltar para o Dashboard</a>
            <?php endif; ?>
            <div class="header-icon" id="logoutBtn" title="Sair do sistema"><i class="fas fa-sign-out-alt"></i></div>
        </div>
    </header>

    <div class="detail-card">
        <div class="detail-header">
            <div>
                <h5 style="margin:0; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-tasks"></i> Status Detalhado do Mês
                </h5>
                <small style="color: var(--text-muted-color);">
                    Progresso Geral: <strong><?= $progresso_percentual ?>%</strong>
                    (<?= $campos_preenchidos_geral ?> de <?= $total_campos_geral ?> campos úteis)
                </small>
            </div>

            <div style="width: 250px; max-width: 100%;">
                <div class="progress">
                    <?php
                    $cor_geral = 'bg-danger';
                    if ($progresso_percentual >= 50) $cor_geral = 'bg-warning';
                    if ($progresso_percentual >= 90) $cor_geral = 'bg-success';
                    ?>
                    <div class="progress-bar <?= $cor_geral ?>" role="progressbar" style="width: <?= $progresso_percentual ?>%"></div>
                </div>
            </div>
        </div>

        <div class="detail-grid">
            <?php foreach ($stats_cushman as $key => $stat):
                $total = $stat['total'];
                $feitos = $stat['feitos'];
                $perc = ($total > 0) ? round(($feitos / $total) * 100) : 0;

                $mini_cor = 'fill-red';
                if ($perc >= 50) $mini_cor = 'fill-yellow';
                if ($perc >= 90) $mini_cor = 'fill-green';
            ?>
                <div class="detail-item">
                    <div class="detail-title">
                        <span><?= htmlspecialchars($stat['label']) ?></span>
                        <span style="font-size: 0.8rem;"><?= $perc ?>%</span>
                    </div>
                    <div class="mini-progress">
                        <div class="mini-fill <?= $mini_cor ?>" style="width: <?= $perc ?>%;"></div>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-muted-color); text-align: right;">
                        <strong><?= $feitos ?></strong> / <?= $total ?>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
    <div class="stats-container">
        <div class="stat-card">
            <h3><i class="fas fa-building"></i> Total de Empresas</h3>
            <p class="stat-number"><?= $total_empresas ?></p>
            <small>No mês selecionado</small>
        </div>
        <div class="stat-card">
            <h3><i class="fas fa-tasks"></i> Progresso</h3>
            <p class="stat-number"><?= $progresso_percentual ?>%</p>
            <small><?= $campos_preenchidos_geral ?> de <?= $total_campos_geral ?> campos preenchidos</small>
        </div>
        <div class="stat-card">
            <h3><i class="fas fa-map-marker-alt"></i> Municípios</h3>
            <p class="stat-number"><?= $municipios_unicos ?></p>
            <small>Diferentes atendidos</small>
        </div>

        <div class="stat-card <?= ($certificados_a_vencer > 0) ? 'alert' : '' ?>" id="btnCertificadosVencendo" style="cursor: pointer;">
            <h3><i class="fas fa-exclamation-triangle"></i> Certificados a Vencer</h3>
            <p class="stat-number"><?= $certificados_a_vencer ?></p>
            <small>Global - Próximos 30 dias</small>
            <?php if ($certificados_a_vencer > 0): ?>
                <a href="exportar_certificados.php" class="btn-exportar" title="Exportar lista para Excel" onclick="event.stopPropagation();">
                    <i class="fas fa-file-excel"></i> Exportar
                </a>
            <?php endif; ?>
        </div>

        <div class="stat-card <?= ($procuracoes_a_vencer > 0) ? 'alert' : '' ?>" id="btnProcuracoesVencendo" style="cursor: pointer;">
            <h3><i class="fas fa-user-clock"></i> Procurações a Vencer</h3>
            <p class="stat-number"><?= $procuracoes_a_vencer ?></p>
            <small>Global - Próximos 30 dias</small>
        </div>
    </div>

    <div class="filters-container">
        <div class="search-box">
            <i class="fas fa-search"></i>
            <input type="text" id="searchInput" placeholder="Pesquisar por empresa, CNPJ, município...">
        </div>
        <div class="filter-buttons">
            <select id="filter-municipio" class="filter-select">
                <option value="">Filtrar por Município</option>
                <?php
                $municipios = array_unique(array_column($empresas, 'municipio'));
                sort($municipios);
                foreach ($municipios as $municipio) {
                    if (!empty($municipio)) {
                        echo "<option value='" . htmlspecialchars($municipio) . "'>" . htmlspecialchars($municipio) . "</option>";
                    }
                }
                ?>
            </select>
            <select id="select-mes" class="filter-select" onchange="changeMonth()">
                <?php foreach ($meses_disponiveis as $mes): ?>
                    <option value="<?= $mes['id'] ?>" <?= ($mes['id'] == $mes_selecionado_id) ? 'selected' : '' ?>>
                        <?= str_pad($mes['mes'], 2, '0', STR_PAD_LEFT) . '/' . $mes['ano'] ?>
                    </option>
                <?php endforeach; ?>
            </select>
<a 
    href="exportar_cushman_excel.php?mes_id=<?= (int)$mes_selecionado_id ?>" 
    class="btn btn-outline btn-sm"
>
    <i class="fas fa-file-excel"></i> Exportar Excel
</a>
            <button id="toggleEditablesBtn" class="btn btn-outline btn-sm"><i class="fas fa-edit"></i> Apenas Editáveis</button>
            <button id="syncProgressoBtn" class="btn btn-outline btn-sm" title="Recalcular o progresso agora"><i class="fas fa-sync-alt"></i> Sincronizar</button>
        </div>
    </div>

    <div class="table-container">
        <table class="data-table">
            <thead>
                <tr>
         <tr>
    <th class="sortable col-fixa" data-column="0">Código <i class="sort-icon fas fa-sort"></i></th>
    <th class="sortable col-fixa" data-column="1">Empresa <i class="sort-icon fas fa-sort"></i></th>
    <th class="sortable col-fixa" data-column="2">CNPJ <i class="sort-icon fas fa-sort"></i></th>
    <th class="filterable col-fixa">Status <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
    <th class="editavel sortable filterable" data-column="4" data-coluna="municipio">Município <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                    <th class="editavel filterable" data-coluna="certificado_cliente">Cert. Cliente <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                    <th class="editavel filterable" data-coluna="tipo_certificado">Tipo Cert. <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                    <th class="editavel" data-coluna="senha_certificado">Senha Cert.</th>
                    <th class="editavel" data-coluna="data_emissao_certificado">Emissão Cert.</th>
                    <th class="editavel" data-coluna="data_vencimento_certificado">Venc. Cert.</th>
                    <th class="editavel" data-coluna="data_procuracao_target">Proc. Target</th>
                    <th class="editavel" data-coluna="data_contrato">Data Contrato</th>
                    <th class="editavel" data-coluna="data_obrigacao">Data Obrigação</th>
                    <th class="editavel" data-coluna="data_saida">Data Saída</th>
                    <th class="editavel filterable" data-coluna="insc_municipal">Insc. Municipal <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                    <th class="editavel" data-coluna="login_prefeitura">Login Pref.</th>
                    <th class="editavel" data-coluna="senha_prefeitura_ginfes">Senha GINFES</th>
                    <th class="editavel" data-coluna="link_prefeitura">Link Prefeitura</th>
                    <th class="editavel" data-coluna="senha_giss_online">Senha GISS</th>
                    <th class="editavel filterable" data-coluna="insc_estadual">Insc. Estadual <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                    <th class="editavel filterable" data-coluna="observacoes">Observações <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                    <th class="editavel filterable" data-coluna="iss_cushman">ISS Cushman <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                    <th class="editavel filterable" data-coluna="devec_cushman">DEVEC Cushman <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                    <th class="editavel filterable" data-coluna="sped_fiscal_cushman">SPED Fiscal Cushman <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                    <th class="editavel filterable" data-coluna="reinf_cushman">REINF Cushman <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                    <th class="editavel filterable" data-coluna="esocial_cushman">e-social Cushman <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                </tr>
            </thead>
            <tbody>
                <?php if (!empty($empresas)): ?>
                    <?php foreach ($empresas as $empresa): ?>
<tr data-id="<?= htmlspecialchars($empresa['id'] ?? '') ?>">
    <td><?= htmlspecialchars($empresa['codigo'] ?? '') ?></td>
    <td><?= htmlspecialchars($empresa['empresa'] ?? '') ?></td>
    <td><?= htmlspecialchars($empresa['cnpj'] ?? '') ?></td>
    <td><?= htmlspecialchars($empresa['status_cushman'] ?? 'pendente') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="municipio"><?= htmlspecialchars($empresa['municipio'] ?? '') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="certificado_cliente"><?= htmlspecialchars($empresa['certificado_cliente'] ?? '') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="tipo_certificado"><?= htmlspecialchars($empresa['tipo_certificado'] ?? '') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="senha_certificado"><?= htmlspecialchars($empresa['senha_certificado'] ?? '') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="data_emissao_certificado"><?= htmlspecialchars(formatarDataBR($empresa['data_emissao_certificado'] ?? '')) ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="data_vencimento_certificado"><?= htmlspecialchars(formatarDataBR($empresa['data_vencimento_certificado'] ?? '')) ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="data_procuracao_target"><?= htmlspecialchars(formatarDataBR($empresa['data_procuracao_target'] ?? '')) ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="data_contrato"><?= htmlspecialchars(formatarDataBR($empresa['data_contrato'] ?? '')) ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="data_obrigacao"><?= htmlspecialchars(formatarDataBR($empresa['data_obrigacao'] ?? '')) ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="data_saida"><?= htmlspecialchars(formatarDataBR($empresa['data_saida'] ?? '')) ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="insc_municipal"><?= htmlspecialchars($empresa['insc_municipal'] ?? '') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="login_prefeitura"><?= htmlspecialchars($empresa['login_prefeitura'] ?? '') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="senha_prefeitura_ginfes"><?= htmlspecialchars($empresa['senha_prefeitura_ginfes'] ?? '') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="link_prefeitura"><?= htmlspecialchars($empresa['link_prefeitura'] ?? '') ?> </td>
                            <td class="editavel" contenteditable="true" data-coluna="senha_giss_online"><?= htmlspecialchars($empresa['senha_giss_online'] ?? '') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="insc_estadual"><?= htmlspecialchars($empresa['insc_estadual'] ?? '') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="observacoes"><?= htmlspecialchars($empresa['observacoes'] ?? '') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="iss_cushman"><?= htmlspecialchars($empresa['iss_cushman'] ?? 'pendente') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="devec_cushman"><?= htmlspecialchars($empresa['devec_cushman'] ?? 'pendente') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="sped_fiscal_cushman"><?= htmlspecialchars($empresa['sped_fiscal_cushman'] ?? 'pendente') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="reinf_cushman"><?= htmlspecialchars($empresa['reinf_cushman'] ?? 'pendente') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="esocial_cushman"><?= htmlspecialchars($empresa['esocial_cushman'] ?? 'pendente') ?></td>
                        </tr>
                    <?php endforeach; ?>
                <?php else: ?>
                    <tr>
                        <td colspan="26" style="text-align: center; padding: 2rem;">Nenhuma empresa encontrada.</td>
                    </tr>
                <?php endif; ?>
            </tbody>
        </table>
    </div>

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script>
        function setupModais() {
            const modais = {
                'btnCertificadosVencendo': 'modalCertificadosVencendo',
                'btnProcuracoesVencendo': 'modalProcuracoesVencendo',
            };
            Object.keys(modais).forEach(botaoId => {
                const botao = document.getElementById(botaoId);
                if (botao) {
                    botao.addEventListener('click', () => {
                        const modal = document.getElementById(modais[botaoId]);
                        if (modal) {
                            modal.classList.add('active');
                            document.body.style.overflow = 'hidden';
                        }
                    });
                }
            });
            document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
                el.addEventListener('click', function(e) {
                    if (e.target === this || this.classList.contains('modal-close')) {
                        const modal = this.closest('.modal-overlay');
                        if (modal) {
                            modal.classList.remove('active');
                            if (!document.querySelector('.modal-overlay.active')) document.body.style.overflow = '';
                        }
                    }
                });
            });
        }

        function setupEnterKeyNavigation() {
            $('.data-table tbody').on('keydown', 'td.editavel[contenteditable="true"]', function(event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    const currentCell = $(this);
                    const currentRow = currentCell.closest('tr');
                    const cellIndex = currentCell.index();
                    const nextRow = currentRow.next('tr');
                    if (nextRow.length) {
                        const targetCell = nextRow.find('td').eq(cellIndex);
                        if (targetCell.hasClass('editavel')) targetCell.focus();
                    }
                }
            });
        }

        function changeMonth() {
            const mesId = document.getElementById('select-mes').value;
            if (mesId) window.location.href = `cushman.php?mes_id=${mesId}`;
        }

        function atualizarProgresso() {
            // Lógica JS para atualizar visualmente (Client-side)
            const camposEditaveis = ['iss_cushman', 'devec_cushman', 'sped_fiscal_cushman', 'reinf_cushman', 'esocial_cushman'];
            const $linhas = $('.data-table tbody tr[data-id]');
            const totalEmpresas = $linhas.length;
            const totalCamposEditaveis = totalEmpresas * camposEditaveis.length;
            let camposPreenchidos = 0;

            if (totalCamposEditaveis > 0) {
                $linhas.each(function() {
                    const $linha = $(this);
                    camposEditaveis.forEach(function(nomeColuna) {
                        const valorCelula = $linha.find(`td[data-coluna="${nomeColuna}"]`).text().trim();
                        if (valorCelula !== "" && valorCelula.toLowerCase() !== "pendente") {
                            camposPreenchidos++;
                        }
                    });
                });
            }

            const progressoPercentual = (totalCamposEditaveis > 0) ? Math.round((camposPreenchidos / totalCamposEditaveis) * 100) : 0;
            $('.progress-bar-main').css('width', progressoPercentual + '%');
            // Atualiza o texto do card de progresso
            const $statCardProgresso = $('.stats-container .stat-card').eq(1);
            $statCardProgresso.find('.stat-number').text(progressoPercentual + '%');
            $statCardProgresso.find('small').text(camposPreenchidos + ' de ' + totalCamposEditaveis + ' campos preenchidos');
        }

        $(document).ready(function() {
            setupModais();
            setupEnterKeyNavigation();
            let activeColumnFilters = {};

            $('#syncProgressoBtn').on('click', function() {
                const $icon = $(this).find('i');
                $icon.addClass('fa-spin');
                atualizarProgresso();
                setTimeout(() => {
                    $icon.removeClass('fa-spin');
                }, 500);
            });

            // Filtro Geral
            function masterFilter() {
                const searchTerm = $('#searchInput').val().toLowerCase();
                const selectedMunicipio = $('#filter-municipio').val();
                $('.data-table tbody tr').each(function() {
                    const row = $(this);
                    let showRow = true;
                    if (searchTerm && !row.text().toLowerCase().includes(searchTerm)) showRow = false;
                    if (showRow && selectedMunicipio !== "" && row.find('td[data-coluna="municipio"]').text() !== selectedMunicipio) showRow = false;

                    if (showRow) {
                        for (const columnIndex in activeColumnFilters) {
                            const selectedOptions = activeColumnFilters[columnIndex];
                            if (selectedOptions && selectedOptions.length > 0) {
                                const cell = row.find('td').eq(columnIndex);
                                let cellValue = cell.text().trim();
                                if (cellValue === "") cellValue = "(Vazias)";
                                if (!selectedOptions.includes(cellValue)) {
                                    showRow = false;
                                    break;
                                }
                            }
                        }
                    }
                    row.toggle(showRow);
                });
            }

            $('#searchInput, #filter-municipio').on('keyup change', masterFilter);

            // Filtros de Coluna
            $('.data-table').on('click', 'th.filterable .filter-icon', function(e) {
                e.stopPropagation();
                const th = $(this).closest('th');
                if (th.hasClass('filter-menu-open')) {
                    $('.filter-menu').remove();
                    $('th.filterable').removeClass('filter-menu-open');
                    return;
                }
                $('.filter-menu').remove();
                $('th.filterable').removeClass('filter-menu-open');
                th.addClass('filter-menu-open');

                const columnIndex = th.index();
                const options = new Set();
                $('.data-table tbody tr').each(function() {
                    let value = $(this).find('td').eq(columnIndex).text().trim();
                    options.add(value === "" ? "(Vazias)" : value);
                });

                let optionsHtml = '';
                const sortedOptions = Array.from(options).sort((a, b) => a.localeCompare(b, 'pt-BR'));
                sortedOptions.forEach(option => {
                    const isChecked = activeColumnFilters[columnIndex] === undefined || activeColumnFilters[columnIndex].includes(option);
                    optionsHtml += `<label><input type="checkbox" class="filter-checkbox" value="${option}" ${isChecked ? 'checked' : ''}> ${option}</label>`;
                });

                const menuHtml = `
                    <div class="filter-menu" data-column-index="${columnIndex}">
                        <div class="filter-menu-header">Filtrar</div>
                        <div class="filter-menu-options">${optionsHtml}</div>
                        <div class="filter-menu-footer">
                            <button class="btn-apply-filter">Aplicar</button>
                            <button class="btn-clear-filter">Limpar</button>
                        </div>
                    </div>`;
                $('body').append(menuHtml);
                const $menu = $('.filter-menu').last();
                const iconRect = $(this).get(0).getBoundingClientRect();
                $menu.css({
                    top: (iconRect.bottom + window.scrollY) + 'px',
                    left: (iconRect.left + window.scrollX) + 'px',
                    position: 'absolute',
                    zIndex: 9999
                }).fadeIn(100);
            });

            $(document).on('click', '.btn-apply-filter', function() {
                const menu = $(this).closest('.filter-menu');
                const columnIndex = menu.data('column-index');
                const th = $('.data-table th').eq(columnIndex);
                const selectedOptions = [];
                menu.find('.filter-checkbox:checked').each(function() {
                    selectedOptions.push($(this).val());
                });
                activeColumnFilters[columnIndex] = selectedOptions;
                th.toggleClass('filter-active', menu.find('.filter-checkbox:not(:checked)').length > 0);
                masterFilter();
                menu.remove();
                $('th.filterable').removeClass('filter-menu-open');
            });

            $(document).on('click', '.btn-clear-filter', function() {
                const menu = $(this).closest('.filter-menu');
                const columnIndex = menu.data('column-index');
                const th = $('.data-table th').eq(columnIndex);
                menu.find('.filter-checkbox').prop('checked', false);
                const vaziasCheckbox = menu.find('.filter-checkbox[value="(Vazias)"]');
                if (vaziasCheckbox.length > 0) {
                    vaziasCheckbox.prop('checked', true);
                    activeColumnFilters[columnIndex] = ["(Vazias)"];
                } else {
                    activeColumnFilters[columnIndex] = [];
                }
                th.addClass('filter-active');
                th.removeClass('filter-menu-open');
                masterFilter();
                menu.remove();
            });

            $(document).on('click', function(e) {
                if (!$(e.target).closest('.filter-menu').length && !$(e.target).closest('.filter-icon').length) {
                    $('.filter-menu').remove();
                    $('th.filterable').removeClass('filter-menu-open');
                }
            });
            $(document).on('click', '.filter-menu', function(e) {
                e.stopPropagation();
            });

            // Ordenação
            $('.data-table th.sortable').on('click', function(e) {
                if ($(e.target).hasClass('filter-icon') || $(e.target).parent().hasClass('filter-icon')) return;
                const th = $(this);
                const table = th.closest('table');
                const tbody = table.find('tbody');
                const columnIndex = th.index();
                const currentDirection = th.hasClass('sort-asc') ? 'asc' : (th.hasClass('sort-desc') ? 'desc' : 'none');
                let newDirection = (currentDirection === 'asc') ? 'desc' : 'asc';
                table.find('th.sortable').removeClass('sort-asc sort-desc').find('.sort-icon').attr('class', 'sort-icon fas fa-sort');
                th.addClass('sort-' + newDirection).find('.sort-icon').attr('class', 'sort-icon fas fa-sort-' + (newDirection === 'asc' ? 'up' : 'down'));
                const rows = tbody.find('tr').toArray().sort((a, b) => {
                    const valA = $(a).find('td').eq(columnIndex).text().trim();
                    const valB = $(b).find('td').eq(columnIndex).text().trim();
                    const comparison = valA.localeCompare(valB, 'pt-BR', {
                        numeric: true,
                        sensitivity: 'base'
                    });
                    return newDirection === 'asc' ? comparison : -comparison;
                });
                tbody.empty().append(rows);
            });

            // Edição
            $('.editavel').on('focus', function() {
                    $(this).data('originalValue', $(this).text().trim());
                })
                .on('blur', function() {
                    const celula = $(this);
                    const valorOriginal = celula.data('originalValue');
                    const valorNovo = celula.text().trim();
                    if (valorOriginal !== valorNovo) {
                        $.ajax({
                            url: 'salvar_dados_cushman.php',
                            method: 'POST',
                            data: {
                                id: celula.closest('tr').data('id'),
                                coluna: celula.data('coluna'),
                                valor: valorNovo
                            },
                            dataType: 'json',
                            success: (r) => {
                                if (r.success) atualizarProgresso();
                                else {
                                    alert('Erro: ' + r.message);
                                    celula.text(valorOriginal);
                                }
                            },
                            error: () => {
                                alert('Erro de comunicação.');
                                celula.text(valorOriginal);
                            }
                        });
                    }
                });

            $('#toggleEditablesBtn').on('click', function() {
                const table = $('.data-table');
                table.toggleClass('editable-view');
                $(this).html(table.hasClass('editable-view') ? '<i class="fas fa-eye"></i> Todos' : '<i class="fas fa-edit"></i> Editáveis');
            });

            $('#logoutBtn').on('click', () => {
                window.location.href = 'logout.php';
            });

            const themeToggle = $('#themeToggle');
            const savedTheme = localStorage.getItem('theme') || 'light';
            $('html').attr('data-theme', savedTheme);
            if (savedTheme === 'dark') themeToggle.find('i').removeClass('fa-moon').addClass('fa-sun');
        });
    </script>
</body>

</html>