<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
require_once 'assets/backend/config.php';
session_start();

$usuario_logado_id = $_SESSION['usuario_id'] ?? 0;
$tipo_conta_logado = $_SESSION['tipo_conta'] ?? '';

$usuario_id_alvo = $usuario_logado_id;
$area_alvo = 'dp';

$id_funcionario_get = filter_input(INPUT_GET, 'ver_como', FILTER_VALIDATE_INT);
if ($id_funcionario_get && (strpos($tipo_conta_logado, 'lider_') === 0 || $tipo_conta_logado === 'admin')) {
    $usuario_id_alvo = $id_funcionario_get;
}

if (!$usuario_logado_id) {
    header('Location: index.php');
    exit();
}

if ($tipo_conta_logado !== 'admin' && $tipo_conta_logado !== 'dp' && $tipo_conta_logado !== 'lider_dp') {
    $_SESSION['mensagem'] = 'Acesso não autorizado a esta página.';
    header('Location: dashboard.php');
    exit();
}

$usuario_id = $usuario_id_alvo;
$usuario_nome = obterNomeUsuario($conexao, $usuario_id);

$meses_pt = [
    1 => 'Janeiro', 2 => 'Fevereiro', 3 => 'Março', 4 => 'Abril',
    5 => 'Maio', 6 => 'Junho', 7 => 'Julho', 8 => 'Agosto',
    9 => 'Setembro', 10 => 'Outubro', 11 => 'Novembro', 12 => 'Dezembro'
];

$ano_atual = date('Y');
$mes_atual_num = date('n');

function obterMesesDisponiveis($conexao, $usuario_id) {
    $query = "SELECT DISTINCT cm.id, cm.mes, cm.ano, cm.edicao_status FROM controle_meses cm
              JOIN controle_fechamento cf ON cm.id = cf.id_mes
              JOIN responsaveis_empresa re ON cf.id = re.id_empresa
              WHERE re.id_usuario = ? AND re.responsavel_atual = 1
              ORDER BY cm.ano DESC, cm.mes DESC";
    $stmt = $conexao->prepare($query);
    $stmt->bind_param('i', $usuario_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $meses = $result->fetch_all(MYSQLI_ASSOC);

    foreach ($meses as &$mes) {
        $mes['editavel'] = ($mes['edicao_status'] === 'liberada');
    }
    return $meses;
}

function edicaoEstaLiberada($conexao, $mes_id) {
    if (!$mes_id) return false;
    $query = "SELECT edicao_status FROM controle_meses WHERE id = ?";
    $stmt = $conexao->prepare($query);
    $stmt->bind_param('i', $mes_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    return isset($row['edicao_status']) && $row['edicao_status'] === 'liberada';
}

function formatarDataBR($data) {
    if (empty($data) || $data === '0000-00-00') return '';
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

function obterEmpresasDoMes($conexao, $usuario_id, $mes_id) {
    $stmt = $conexao->prepare("SELECT mes, ano FROM controle_meses WHERE id = ?");
    $stmt->bind_param('i', $mes_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $mesInfo = $result->fetch_assoc();

    if (!$mesInfo) return [];

    $mes = str_pad($mesInfo['mes'], 2, '0', STR_PAD_LEFT);
    $ano = $mesInfo['ano'];
    $primeiroDiaMes = "$ano-$mes-01";
    $ultimoDiaMes = date("Y-m-t", strtotime($primeiroDiaMes));

    $query = "SELECT cf.*, re.id_usuario as responsavel_id FROM controle_fechamento cf
              JOIN responsaveis_empresa re ON cf.id = re.id_empresa
              WHERE re.id_usuario = ? AND re.id_mes = ? AND re.responsavel_atual = 1
              AND (cf.data_saida IS NULL OR cf.data_saida >= ?)
              AND (cf.data_obrigacao IS NULL OR cf.data_obrigacao <= ?)
              ORDER BY cf.empresa";
    $stmt = $conexao->prepare($query);
    $stmt->bind_param('iiss', $usuario_id, $mes_id, $primeiroDiaMes, $ultimoDiaMes);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

function obterObrigacoesFuturas($conexao, $usuario_id) {
    $primeiroDiaProximoMes = date('Y-m-01', strtotime('+1 month'));
    $query = "SELECT cf.codigo, cf.empresa, cf.tributacao,
              DATE_FORMAT(MIN(cf.data_obrigacao), '%d/%m/%Y') as data_obrigacao_formatada,
              DATEDIFF(MIN(cf.data_obrigacao), CURDATE()) as dias_restantes
              FROM controle_fechamento cf
              JOIN responsaveis_empresa re ON cf.id = re.id_empresa
              WHERE re.id_usuario = ? AND re.responsavel_atual = 1 
              AND cf.data_obrigacao >= ?
              GROUP BY cf.codigo
              ORDER BY MIN(cf.data_obrigacao) ASC LIMIT 10";
    $stmt = $conexao->prepare($query);
    $stmt->bind_param('is', $usuario_id, $primeiroDiaProximoMes);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

function obterNovasObrigacoesMes($conexao, $usuario_id, $mes, $ano) {
    $query = "SELECT cf.codigo, cf.empresa, cf.tributacao, cf.cnpj, cf.grupo,
              DATE_FORMAT(MIN(cf.data_obrigacao), '%d/%m/%Y') as data_obrigacao_formatada,
              DATEDIFF(MIN(cf.data_obrigacao), CURDATE()) as dias_restantes
              FROM controle_fechamento cf
              JOIN responsaveis_empresa re ON cf.id = re.id_empresa
              WHERE re.id_usuario = ? AND re.responsavel_atual = 1 
              AND MONTH(cf.data_obrigacao) = ? AND YEAR(cf.data_obrigacao) = ?
              GROUP BY cf.codigo
              ORDER BY MIN(cf.data_obrigacao) ASC";
    $stmt = $conexao->prepare($query);
    $stmt->bind_param('iii', $usuario_id, $mes, $ano);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

function obterEmpresasSaindoMesAtual($conexao, $usuario_id) {
    $primeiroDiaMesAtual = date('Y-m-01');
    $ultimoDiaMesAtual = date('Y-m-t');
    $query = "SELECT cf.empresa, cf.tributacao,
              DATE_FORMAT(cf.data_saida, '%d/%m/%Y') as data_saida_formatada,
              DATEDIFF(cf.data_saida, CURDATE()) as dias_restantes
              FROM controle_fechamento cf
              JOIN responsaveis_empresa re ON cf.id = re.id_empresa
              WHERE re.id_usuario = ? AND re.responsavel_atual = 1 
              AND cf.data_saida BETWEEN ? AND ?
              ORDER BY cf.data_saida ASC";
    $stmt = $conexao->prepare($query);
    $stmt->bind_param('iss', $usuario_id, $primeiroDiaMesAtual, $ultimoDiaMesAtual);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

function obterEmpresasSaindoFuturo($conexao, $usuario_id) {
    $primeiroDiaProximoMes = date('Y-m-01', strtotime('+1 month'));
    $query = "SELECT cf.empresa, cf.tributacao,
              DATE_FORMAT(cf.data_saida, '%d/%m/%Y') as data_saida_formatada,
              DATEDIFF(cf.data_saida, CURDATE()) as dias_restantes
              FROM controle_fechamento cf
              JOIN responsaveis_empresa re ON cf.id = re.id_empresa
              WHERE re.id_usuario = ? AND re.responsavel_atual = 1 
              AND cf.data_saida >= ?
              ORDER BY cf.data_saida ASC LIMIT 10";
    $stmt = $conexao->prepare($query);
    $stmt->bind_param('is', $usuario_id, $primeiroDiaProximoMes);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

$meses_disponiveis = obterMesesDisponiveis($conexao, $usuario_id);
$mes_selecionado = isset($_GET['mes_id']) ? $_GET['mes_id'] : ($meses_disponiveis[0]['id'] ?? null);
$edicao_liberada = edicaoEstaLiberada($conexao, $mes_selecionado);

$mes_info = [];
if ($mes_selecionado) {
    $stmt = $conexao->prepare("SELECT mes, ano FROM controle_meses WHERE id = ?");
    $stmt->bind_param('i', $mes_selecionado);
    $stmt->execute();
    $result = $stmt->get_result();
    $mes_info = $result->fetch_assoc();
}

$mes_selecionado_num = $mes_info['mes'] ?? $mes_atual_num;
$ano_selecionado = $mes_info['ano'] ?? $ano_atual;
$exibir_colunas_13 = ($mes_selecionado_num == 12);
$exibir_alteracoes_pasta = ($mes_selecionado_num == 5);

$obrigacoes_futuras = obterObrigacoesFuturas($conexao, $usuario_id);
$novas_obrigacoes_mes = obterNovasObrigacoesMes($conexao, $usuario_id, $mes_selecionado_num, $ano_selecionado);
$empresas_saindo_mes_atual = obterEmpresasSaindoMesAtual($conexao, $usuario_id);
$empresas_saindo_futuro = obterEmpresasSaindoFuturo($conexao, $usuario_id);
$empresas = $mes_selecionado ? obterEmpresasDoMes($conexao, $usuario_id, $mes_selecionado) : [];
$status_reinf_real = [];

if (!empty($empresas)) {
    $ids_empresas = array_column($empresas, 'id');
    if (!empty($ids_empresas)) {
        $ids_string = implode(',', array_map('intval', $ids_empresas));
        $query_detalhes = "SELECT * FROM reinf_detalhes WHERE id_controle_fechamento IN ($ids_string)";
        $res_detalhes = $conexao->query($query_detalhes);

        if ($res_detalhes) {
            while ($row = $res_detalhes->fetch_assoc()) {
                $campos_para_checar = [
                    $row['irrf_1708'], $row['crf_5952'], $row['inss_prestados'],
                    $row['inss_tomados'], $row['desoneracao'], $row['irrf_3208']
                ];
                $esta_preenchido = true;
                foreach ($campos_para_checar as $valor) {
                    if (trim($valor ?? '') === '') {
                        $esta_preenchido = false;
                        break;
                    }
                }
                $status_reinf_real[$row['id_controle_fechamento']] = $esta_preenchido ? 'Preenchido' : 'Pendente';
            }
        }
    }
}

$colunas_monitoradas = [
    'adto' => 'ADTO', 'folha_pagamento' => 'Folha Pagto', 'guias_sindicato' => 'Guias Sind.',
    'fgts_digital' => 'FGTS Digital', 'e_social' => 'eSocial', 'dctf_web_mes' => 'DCTF Web', 'reinf' => 'REINF'
];
if ($exibir_alteracoes_pasta) {
    $colunas_monitoradas['alteracoes_pasta'] = 'Alterações Pasta';
}

if ($exibir_colunas_13) {
    $colunas_monitoradas['ADTO13'] = 'ADTO 13º';
    $colunas_monitoradas['FOLHA13'] = 'Folha 13º';
}

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
    if ($empresa_completa) $empresas_100_porcento++;
}

foreach ($stats_detalhadas as $key => &$stat) {
    if ($stat['total'] > 0) $stat['porcentagem'] = round(($stat['feitos'] / $stat['total']) * 100);
}
unset($stat);

$progresso_percentual = ($total_campos_geral > 0) ? round(($preenchidos_geral / $total_campos_geral) * 100) : 0;
$num_empresas = count($empresas);
$num_funcionarios = array_sum(array_map('intval', array_column($empresas, 'qtde_funcionarios')));

$mes_dissidio_atual = str_pad($mes_selecionado_num, 2, '0', STR_PAD_LEFT) . '/' . $ano_selecionado;
$empresas_com_dissidio = array_filter($empresas, function ($empresa) use ($mes_dissidio_atual, $usuario_id) {
    return !empty($empresa['dissidio']) && $empresa['dissidio'] == $mes_dissidio_atual && $empresa['responsavel_id'] == $usuario_id;
});

$camposObrigatorios = ['adto', 'folha_pagamento', 'data_pagamento', 'qtde_funcionarios', 'guias_sindicato', 'dissidio', 'fgts_digital', 'e_social', 'dctf_web_mes', 'sd_login', 'sd_senha'];

if ($exibir_alteracoes_pasta) {
    $camposObrigatorios[] = 'alteracoes_pasta';
}

$total_campos = count($empresas) * count($camposObrigatorios);
$campos_preenchidos = 0;

foreach ($empresas as $empresa) {
    foreach ($camposObrigatorios as $campo) {
        $valorCampo = trim($empresa[$campo] ?? '');

if ($campo === 'alteracoes_pasta') {
    if ($valorCampo === 'Concluído') {
        $campos_preenchidos++;
    }
} elseif (!empty($valorCampo)) {
    $campos_preenchidos++;
}
    }
}

$progresso_percentual = $total_campos > 0 ? round(($campos_preenchidos / $total_campos) * 100) : 0;
$mostrar_editaveis = isset($_GET['editaveis']) && $_GET['editaveis'] == '1';

$certificados_a_vencer = 0;
$procuracoes_a_vencer = 0;
$empresas_certificados_vencendo = [];
$empresas_procuracoes_vencendo = [];
$hoje = new DateTime();
$limite_vencimento = (new DateTime())->modify('+30 days');

foreach ($empresas as $empresa) {
    if (!empty($empresa['data_vencimento_certificado'])) {
        try {
            $data_vencimento_cert = new DateTime($empresa['data_vencimento_certificado']);
            if ($data_vencimento_cert >= $hoje && $data_vencimento_cert <= $limite_vencimento) {
                $certificados_a_vencer++;
                $empresas_certificados_vencendo[] = [
                    'empresa' => $empresa['empresa'],
                    'data_vencimento' => formatarDataBR($empresa['data_vencimento_certificado']),
                    'dias_restantes' => $hoje->diff($data_vencimento_cert)->days
                ];
            }
        } catch (Exception $e) {}
    }
    if (!empty($empresa['data_procuracao_target'])) {
        try {
            $data_vencimento_proc = new DateTime($empresa['data_procuracao_target']);
            if ($data_vencimento_proc >= $hoje && $data_vencimento_proc <= $limite_vencimento) {
                $procuracoes_a_vencer++;
                $empresas_procuracoes_vencendo[] = [
                    'empresa' => $empresa['empresa'],
                    'data_vencimento' => formatarDataBR($empresa['data_procuracao_target']),
                    'dias_restantes' => $hoje->diff($data_vencimento_proc)->days
                ];
            }
        } catch (Exception $e) {}
    }
}
?>
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Departamento Pessoal</title>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/dp.css">
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <style>
        .badge-na { background-color: #fd7e14 !important; color: white; }
        .badge-pendencia { background-color: #dc3545 !important; color: white; }
        .badge-ok { background-color: #198754 !important; color: white; }
        
        .detail-card {
            background: #fff; border-radius: 8px; padding: 15px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05); margin-bottom: 20px; border: 1px solid #f0f0f0;
        }
        .detail-header {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;
        }
        .detail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; }
        .detail-item { background: #f8f9fa; padding: 10px; border-radius: 6px; border: 1px solid #e9ecef; }
        .detail-title { font-size: 0.85rem; font-weight: 600; color: #555; margin-bottom: 5px; display: flex; justify-content: space-between; }
        .mini-progress { height: 6px; background: #ddd; border-radius: 3px; overflow: hidden; }
        .mini-fill { height: 100%; transition: width 0.5s; }
        .fill-red { background-color: #dc3545; }
        .fill-yellow { background-color: #ffc107; }
        .fill-green { background-color: #198754; }
        
        .reinf-trigger { cursor: pointer; transition: background-color 0.3s; }
        .reinf-trigger:hover { background-color: rgba(0, 0, 0, 0.05); }
        .stats-box.alert { background-color: #fff3cd; color: #664d03; border: 1px solid #ffecb5; }
        .stats-box.alert h3 { color: #664d03; }
        .btn-exportar-dp {
            position: absolute; bottom: 10px; right: 15px; background-color: #1D6F42;
            color: white; border: none; border-radius: 50%; width: 35px; height: 35px;
            display: flex; align-items: center; justify-content: center; text-decoration: none;
            font-size: 1rem; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2); transition: all 0.2s ease-in-out;
        }
        .btn-exportar-dp:hover { background-color: #165934; color: white; transform: scale(1.1); }
    </style>
</head>

<body>
    <div id="modalEmpresasAtivas" class="modal-overlay">
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-building"></i> Empresas Ativas</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <?php if (!empty($empresas)): ?>
                    <table class="modal-table">
                        <thead><tr><th>Empresa</th><th>CNPJ</th><th>Tributação</th><th>Funcionários</th></tr></thead>
                        <tbody>
                            <?php foreach ($empresas as $empresa): ?>
                                <tr>
                                    <td><?= htmlspecialchars($empresa['empresa']) ?></td>
                                    <td><?= htmlspecialchars($empresa['cnpj']) ?></td>
                                    <td><?= htmlspecialchars($empresa['tributacao']) ?></td>
                                    <td><?= htmlspecialchars($empresa['qtde_funcionarios'] ?? '0') ?></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php else: ?><div class="empty-message"><p>Nenhuma empresa ativa encontrada</p></div><?php endif; ?>
            </div>
        </div>
    </div>

    <div id="modalNovasObrigacoes" class="modal-overlay">
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-calendar-plus"></i> Novas Obrigações</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <?php if (!empty($novas_obrigacoes_mes)): ?>
                    <table class="modal-table">
                        <thead><tr><th>Empresa</th><th>Tributação</th><th>Data Obrigação</th><th>Dias Restantes</th></tr></thead>
                        <tbody>
                            <?php foreach ($novas_obrigacoes_mes as $obrigacao): ?>
                                <tr>
                                    <td><?= htmlspecialchars($obrigacao['empresa']) ?></td>
                                    <td><?= htmlspecialchars($obrigacao['tributacao']) ?></td>
                                    <td><?= htmlspecialchars($obrigacao['data_obrigacao_formatada']) ?></td>
                                    <td><span class="badge badge-warning"><?= $obrigacao['dias_restantes'] ?> dias</span></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php else: ?><div class="empty-message"><p>Nenhuma nova obrigação.</p></div><?php endif; ?>
            </div>
        </div>
    </div>

    <div id="modalObrigacoesFuturas" class="modal-overlay">
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-calendar-check"></i> Obrigações Futuras</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <?php if (!empty($obrigacoes_futuras)): ?>
                    <table class="modal-table">
                        <thead><tr><th>Empresa</th><th>Tributação</th><th>Data Obrigação</th><th>Dias Restantes</th></tr></thead>
                        <tbody>
                            <?php foreach ($obrigacoes_futuras as $obrigacao): ?>
                                <tr>
                                    <td><?= htmlspecialchars($obrigacao['empresa']) ?></td>
                                    <td><?= htmlspecialchars($obrigacao['tributacao']) ?></td>
                                    <td><?= htmlspecialchars($obrigacao['data_obrigacao_formatada']) ?></td>
                                    <td><span class="badge badge-info"><?= $obrigacao['dias_restantes'] ?> dias</span></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php else: ?><div class="empty-message"><p>Nenhuma obrigação futura.</p></div><?php endif; ?>
            </div>
        </div>
    </div>

    <div id="modalEmpresasSaindoMes" class="modal-overlay">
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-sign-out-alt"></i> Empresas Saindo</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <?php if (!empty($empresas_saindo_mes_atual)): ?>
                    <table class="modal-table">
                        <thead><tr><th>Empresa</th><th>Tributação</th><th>Data de Saída</th><th>Dias Restantes</th></tr></thead>
                        <tbody>
                            <?php foreach ($empresas_saindo_mes_atual as $empresa): ?>
                                <tr>
                                    <td><?= htmlspecialchars($empresa['empresa']) ?></td>
                                    <td><?= htmlspecialchars($empresa['tributacao']) ?></td>
                                    <td><?= htmlspecialchars($empresa['data_saida_formatada']) ?></td>
                                    <td><span class="badge badge-warning"><?= $empresa['dias_restantes'] ?> dias</span></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php else: ?><div class="empty-message"><p>Nenhuma empresa saindo.</p></div><?php endif; ?>
            </div>
        </div>
    </div>

    <div id="modalEmpresasSaindoFuturo" class="modal-overlay">
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-sign-out-alt"></i> Empresas Saindo (Futuro)</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <?php if (!empty($empresas_saindo_futuro)): ?>
                    <table class="modal-table">
                        <thead><tr><th>Empresa</th><th>Tributação</th><th>Data de Saída</th><th>Dias Restantes</th></tr></thead>
                        <tbody>
                            <?php foreach ($empresas_saindo_futuro as $empresa): ?>
                                <tr>
                                    <td><?= htmlspecialchars($empresa['empresa']) ?></td>
                                    <td><?= htmlspecialchars($empresa['tributacao']) ?></td>
                                    <td><?= htmlspecialchars($empresa['data_saida_formatada']) ?></td>
                                    <td><span class="badge badge-info"><?= $empresa['dias_restantes'] ?> dias</span></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php else: ?><div class="empty-message"><p>Nenhuma empresa saindo.</p></div><?php endif; ?>
            </div>
        </div>
    </div>

    <div id="modalCertificados" class="modal-overlay">
        <div class="modal-container" style="max-width: 90vw; width: 1200px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-id-card"></i> Informações de Certificados</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="search-box-modal" style="margin-bottom: 15px; position: relative;">
                    <i class="fas fa-search" style="position: absolute; left: 10px; top: 10px; color: #aaa;"></i>
                    <input type="text" id="searchCertificadosInput" placeholder="Pesquisar..." style="width: 100%; padding: 8px 8px 8px 35px; border: 1px solid #ccc; border-radius: 4px;">
                </div>
                <?php if (!empty($empresas)): ?>
                    <table class="modal-table" id="tableCertificados">
                        <thead><tr><th>Empresa</th><th>CNPJ</th><th>Cert. Cliente</th><th>Tipo Cert.</th><th>Senha Cert.</th><th>Emissão Cert.</th><th>Venc. Cert.</th><th>Proc. Target</th></tr></thead>
                        <tbody>
                            <?php foreach ($empresas as $empresa): ?>
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
                <?php else: ?><div class="empty-message"><p>Nenhuma empresa encontrada</p></div><?php endif; ?>
            </div>
        </div>
    </div>

    <div id="modalCertificadosVencendo" class="modal-overlay">
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-exclamation-triangle"></i> Certificados Vencendo</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <?php if (!empty($empresas_certificados_vencendo)): ?>
                    <table class="modal-table">
                        <thead><tr><th>Empresa</th><th>Data Vencimento</th><th>Dias Restantes</th></tr></thead>
                        <tbody>
                            <?php foreach ($empresas_certificados_vencendo as $item): ?>
                                <tr>
                                    <td><?= htmlspecialchars($item['empresa']) ?></td>
                                    <td><?= htmlspecialchars($item['data_vencimento']) ?></td>
                                    <td><span class="badge badge-warning"><?= $item['dias_restantes'] ?> dia(s)</span></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php else: ?><div class="empty-message"><p>Nenhum certificado vencendo.</p></div><?php endif; ?>
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
                <?php if (!empty($empresas_procuracoes_vencendo)): ?>
                    <table class="modal-table">
                        <thead><tr><th>Empresa</th><th>Data Vencimento</th><th>Dias Restantes</th></tr></thead>
                        <tbody>
                            <?php foreach ($empresas_procuracoes_vencendo as $item): ?>
                                <tr>
                                    <td><?= htmlspecialchars($item['empresa']) ?></td>
                                    <td><?= htmlspecialchars($item['data_vencimento']) ?></td>
                                    <td><span class="badge badge-warning"><?= $item['dias_restantes'] ?> dia(s)</span></td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                <?php else: ?><div class="empty-message"><p>Nenhuma procuração vencendo.</p></div><?php endif; ?>
            </div>
        </div>
    </div>

    <div id="passwordModalOverlay" class="modal-overlay">
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-shield-alt"></i> Alterar Senha</h3>
                <button class="modal-close" id="closePasswordModalBtn">&times;</button>
            </div>
            <div class="modal-body">
                <form id="changePasswordForm">
                    <div class="form-group"><label>Senha Atual</label><input type="password" id="senha_atual" name="senha_atual" class="form-control" required></div>
                    <div class="form-group"><label>Nova Senha</label><input type="password" id="nova_senha" name="nova_senha" class="form-control" required></div>
                    <div class="form-group"><label>Confirmar Senha</label><input type="password" id="confirmar_senha" name="confirmar_senha" class="form-control" required></div>
                    <div id="modal-message" class="modal-message"></div>
                    <div class="form-actions mt-3"><button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Salvar</button></div>
                </form>
            </div>
        </div>
    </div>

    <div id="modalDetalhesReinf" class="modal-overlay">
        <div class="modal-container" style="width: 500px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-eye"></i> Detalhes REINF</h3>
                <button type="button" class="modal-close">&times;</button>
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
                    <div class="alert alert-light small mb-0 text-center border"><i class="fas fa-lock"></i> Apenas visualização.</div>
                </form>
            </div>
        </div>
    </div>
    <header class="header">
        <div><h1>Bem vindo(a), <?= htmlspecialchars($usuario_nome) ?></h1></div>
        <div style="display: flex; align-items: center; gap: 1rem;">
            <?php if (in_array($tipo_conta_logado, ['admin', 'lider_dp', 'dp'])): ?>
                <a href="dp_admin.php" class="btn-voltar" style="text-decoration: none;"><i class="fas fa-clipboard-check"></i> Fechamento Completo</a>
            <?php endif; ?>
            <?php if ($tipo_conta_logado === 'lider_dp'): ?>
                <a href="painel_lider.php" class="btn-voltar" style="text-decoration: none;"><i class="fas fa-arrow-left"></i> Voltar ao Painel</a>
            <?php endif; ?>
            <div class="notification-icon"><i class="fas fa-bell notifications-btn"></i><div class="notification-badge">0</div></div>
            <div class="header-icon" id="changePasswordBtn" title="Alterar Senha"><i class="fas fa-key"></i></div>
            <div class="header-icon" id="logoutBtn" title="Sair do sistema"><i class="fas fa-sign-out-alt"></i></div>
        </div>
    </header>

    <nav class="notifications-nav">
        <h3><i class="fas fa-bell"></i><span>Notificações</span><span class="badge-count notification-count">0</span></h3>
        <div class="notifications-list"></div>
    </nav>

    <div class="container my-4">
        <h5 class="mb-2">Progresso do Preenchimento</h5>
        <?php
        $cor_barra = 'bg-danger';
        if ($progresso_percentual >= 80) { $cor_barra = '#0BD3C4'; } elseif ($progresso_percentual <= 51) { $cor_barra = '#9747FF'; }
        ?>
        <div class="progress" style="height: 30px;">
            <div class="progress-bar progress-bar-striped progress-bar-animated <?= $cor_barra ?>" role="progressbar" style="width: <?= $progresso_percentual ?>%;" aria-valuenow="<?= $progresso_percentual ?>" aria-valuemin="0" aria-valuemax="100">
                <?= $progresso_percentual ?>%
            </div>
        </div>
        <small class="text-muted mt-1 d-block"><?= $campos_preenchidos ?> de <?= $total_campos ?> campos preenchidos</small>
    </div>

    <div class="main-content">
        <div class="detail-card">
            <div class="detail-header">
                <div>
                    <h5 style="margin:0; color:#333;"><i class="fas fa-tasks"></i> Status Detalhado do Mês</h5>
                    <small class="text-muted">Progresso Geral: <strong><?= $progresso_percentual ?>%</strong> (<?= $empresas_100_porcento ?> empresas concluídas)</small>
                </div>
            </div>
            <div class="detail-grid">
                <?php foreach ($stats_detalhadas as $key => $stat): 
                    if ($stat['total'] == 0) continue;
                    $perc = $stat['porcentagem'];
                    $mini_cor = 'fill-red';
                    if ($perc >= 50) $mini_cor = 'fill-yellow';
                    if ($perc >= 90) $mini_cor = 'fill-green';
                ?>
                    <div class="detail-item">
                        <div class="detail-title"><span><?= $stat['label'] ?></span><span style="font-size: 0.8rem;"><?= $perc ?>%</span></div>
                        <div class="mini-progress"><div class="mini-fill <?= $mini_cor ?>" style="width: <?= $perc ?>%;"></div></div>
                        <div style="font-size: 0.75rem; color: #777; margin-top: 5px; text-align: right;">Feitos: <strong><?= $stat['feitos'] ?></strong> / <?= $stat['total'] ?></div>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>

        <div class="stats-container">
            <div class="stats-box" id="btnEmpresasAtivas">
                <h3><i class="fas fa-building"></i> Empresas Ativas</h3>
                <div class="stats-numbers"><?= $num_empresas ?> empresas</div><p>Funcionários: <?= $num_funcionarios ?></p>
            </div>
            <div class="stats-box" id="btnNovasObrigacoes">
                <h3><i class="fas fa-calendar-plus"></i> Novas Obrigações</h3>
                <div class="stats-numbers"><?= count($novas_obrigacoes_mes) ?> empresas</div><p><?= $meses_pt[$mes_selecionado_num] . ' ' . $ano_selecionado ?></p>
            </div>
            <div class="stats-box" id="btnObrigacoesFuturas">
                <h3><i class="fas fa-calendar-check"></i> Obrigações Futuras</h3>
                <div class="stats-numbers"><?= count($obrigacoes_futuras) ?> próximas</div><p>Próximos meses</p>
            </div>
            <div class="stats-box" id="btnEmpresasSaindoMes">
                <h3><i class="fas fa-sign-out-alt"></i> Empresas Saindo</h3>
                <div class="stats-numbers"><?= count($empresas_saindo_mes_atual) ?> este mês</div><p><?= $meses_pt[$mes_atual_num] . ' ' . $ano_atual ?></p>
            </div>
            <div class="stats-box" id="btnEmpresasSaindoFuturo">
                <h3><i class="fas fa-sign-out-alt"></i> Empresas Saindo</h3>
                <div class="stats-numbers"><?= count($empresas_saindo_futuro) ?> próximas</div><p>Próximos meses</p>
            </div>
            <div class="stats-box <?= ($certificados_a_vencer > 0) ? 'alert' : '' ?>" id="btnCertificadosVencendo" style="position: relative; cursor: pointer;">
                <h3><i class="fas fa-exclamation-triangle"></i> Certificados a Vencer</h3>
                <div class="stats-numbers"><?= $certificados_a_vencer ?> certificados</div><p>Nos próximos 30 dias</p>
                <?php if ($certificados_a_vencer > 0): ?><a href="exportar_certificados.php" class="btn-exportar-dp" title="Exportar lista para Excel"><i class="fas fa-file-excel"></i></a><?php endif; ?>
            </div>
            <div class="stats-box <?= ($procuracoes_a_vencer > 0) ? 'alert' : '' ?>" id="btnProcuracoesVencendo" style="position: relative; cursor: pointer;">
                <h3><i class="fas fa-user-clock"></i> Procurações a Vencer</h3>
                <div class="stats-numbers"><?= $procuracoes_a_vencer ?> procurações</div><p>Nos próximos 30 dias</p>
            </div>
        </div>

        <?php if (!empty($empresas_com_dissidio)): ?>
            <div id="alerta-dissidio" style="background-color: #ffeb3b; color: #000; padding: 15px; margin: 15px 0; border-radius: 8px;">
                <strong>⚠️ Empresas com Dissídio neste mês:</strong>
                <button onclick="toggleDissidio()" style="float:right;">Mostrar/Ocultar</button>
                <ul id="lista-dissidio" style="margin-top: 10px; display: none;">
                    <?php foreach ($empresas_com_dissidio as $empresa): ?>
                        <li><?= htmlspecialchars($empresa['empresa']) ?> (<?= $empresa['dissidio'] ?>)</li>
                    <?php endforeach; ?>
                </ul>
            </div>
        <?php endif; ?>

        <div class="search-box">
            <input type="text" placeholder="Pesquisar..." id="search-input">
        </div>

        <div class="filter-buttons">
            <div class="month-selector">
                <label for="select-mes">Mês:</label>
                <select id="select-mes" onchange="changeMonth()">
                    <?php foreach ($meses_disponiveis as $mes): ?>
                        <option value="<?= $mes['id'] ?>" data-editavel="<?= $mes['editavel'] ? '1' : '0' ?>" <?= ($mes['id'] == $mes_selecionado) ? 'selected' : '' ?>>
                            <?= str_pad($mes['mes'], 2, '0', STR_PAD_LEFT) . '/' . $mes['ano'] ?> <?= $mes['editavel'] ? ' (editável)' : '' ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>
            <button class="btn" onclick="toggleEditaveis()"> <?= $mostrar_editaveis ? 'Mostrar Todos Campos' : 'Mostrar Apenas Editáveis' ?></button>
            <button class="btn" id="btnAbrirModalCertificados" style="background-color: #6c757d; color: white;"><i class="fas fa-id-card"></i> Info. Certificados</button>
        </div>

        <div id="column-filter-dropdown"></div>

        <div class="table-container">
            <table class="data-table <?= $mostrar_editaveis ? '' : 'show-all' ?>">
                <thead>
                    <tr>
                        <th class="sortable" data-column="codigo" style="min-width: 60px; cursor: pointer;">Código <i class="fas fa-sort sort-icon"></i></th>
                        <th class="sortable" data-column="empresa" style="min-width: 250px; cursor: pointer;">Empresa <i class="fas fa-sort sort-icon"></i> <i class="fas fa-filter column-filter-icon"></i></th>
                        <th style="min-width: 180px;">CNPJ <i class="fas fa-filter column-filter-icon"></i></th>
            <?php if ($exibir_alteracoes_pasta): ?>
<th class="editavel" data-coluna="alteracoes_pasta">
    Alterações Pasta
</th>
<?php endif; ?>
                        <th class="non-editable" style="min-width: 120px;">Status <i class="fas fa-filter column-filter-icon"></i></th>
                        <th class="non-editable">Grupo <i class="fas fa-filter column-filter-icon"></i></th>
                        <th class="editavel" style="min-width: 200px;">Observação <i class="fas fa-filter column-filter-icon"></i></th>
                        <th class="non-editable">Insc. Estadual</th>
                        <th class="non-editable">Insc. Municipal</th>
                        <th class="non-editable">Tributação <i class="fas fa-filter column-filter-icon"></i></th>
                        <th class="non-editable">Tipo <i class="fas fa-filter column-filter-icon"></i></th>
                        <th class="non-editable">Envio <i class="fas fa-filter column-filter-icon"></i></th>
                        <th class="non-editable">Município <i class="fas fa-filter column-filter-icon"></i></th>
                        <th class="editavel" data-coluna="adto">ADTO <i class="fas fa-filter column-filter-icon"></i></th>
                        <th class="editavel" data-coluna="folha_pagamento">Dia Pagamento mensal <i class="fas fa-filter column-filter-icon"></i></th>
                                      <th class="editavel" data-coluna="data_calculo_folha13">Data Cálc. Folha </th>
                            <th class="editavel" data-coluna="data_envio_folha13">Data Envio Folha </th>
                        <th class="non-editable" style="min-width: 150px;">Tipo de Folha <i class="fas fa-filter column-filter-icon"></i></th>
                        <th class="editavel" data-coluna="data_pagamento">Dia pagamento Adiantamento <i class="fas fa-filter column-filter-icon"></i></th>
                        <th class="editavel" data-coluna="qtde_funcionarios">Qtde Func./Sócios <i class="fas fa-filter column-filter-icon"></i></th>
                        <th class="editavel" data-coluna="guias_sindicato">Guias Sindicato <i class="fas fa-filter column-filter-icon"></i></th>
                        <th class="editavel" data-coluna="fgts_digital">FGTS Digital <i class="fas fa-filter column-filter-icon"></i></th>
                        <th class="editavel" data-coluna="e_social">E-Social <i class="fas fa-filter column-filter-icon"></i></th>
                        <th class="editavel" data-coluna="dctf_web_mes">DCTF Web Mês <i class="fas fa-filter column-filter-icon"></i></th>
                        <th class="editavel" data-coluna="sd_login">Seg. Des. Login</th>
                        <th class="editavel" data-coluna="sd_senha">Seg. Des. Senha</th>

                        <?php if ($exibir_colunas_13): ?>
                            <th class="editavel" data-coluna="ADTO13">ADTO 13º</th>
                            <th class="editavel" data-coluna="data_calculo_adto13">Data Cálc. ADTO 13º</th>
                            <th class="editavel" data-coluna="data_envio_adto13">Data Envio ADTO 13º</th>
                            <th class="editavel" data-coluna="FOLHA13">Folha 13º</th>
  
                        <?php endif; ?>

                        <th class="non-editable" data-coluna="reinf">REINF <i class="fas fa-filter column-filter-icon"></i></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($empresas as $empresa): ?>
                        <tr data-id="<?= $empresa['id'] ?>" data-cnpj="<?= htmlspecialchars($empresa['cnpj'] ?? ''); ?>" data-editavel="<?= $edicao_liberada ? '1' : '0' ?>">
                            <td><?= htmlspecialchars($empresa['codigo']) ?></td>
                            <td><?= htmlspecialchars($empresa['empresa']) ?></td>
                            <td><?= htmlspecialchars($empresa['cnpj']) ?></td>
                    <?php if ($exibir_alteracoes_pasta): ?>
<td class="editavel" data-coluna="alteracoes_pasta">
    <select class="form-select form-select-sm select-editavel">
        <option value="Pendente" <?= (($empresa['alteracoes_pasta'] ?? 'Pendente') == 'Pendente') ? 'selected' : '' ?>>
            Pendente
        </option>

        <option value="Concluído" <?= (($empresa['alteracoes_pasta'] ?? '') == 'Concluído') ? 'selected' : '' ?>>
            Concluído
        </option>
    </select>
</td>
<?php endif; ?>
                            <td class="non-editable"><?= htmlspecialchars($empresa['status_dp'] ?? '') ?></td>
                            <td class="non-editable"><?= htmlspecialchars($empresa['grupo'] ?? '') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="observacoes_dp"><?= htmlspecialchars($empresa['observacoes_dp'] ?? '') ?></td>
                            <td class="non-editable"><?= htmlspecialchars($empresa['insc_estadual'] ?? '') ?></td>
                            <td class="non-editable"><?= htmlspecialchars($empresa['insc_municipal'] ?? '') ?></td>
                            <td class="non-editable"><?= htmlspecialchars($empresa['tributacao'] ?? '') ?></td>
                            <td class="non-editable"><?= htmlspecialchars($empresa['tipo'] ?? '') ?></td>
                            <td class="non-editable"><?= htmlspecialchars($empresa['envio'] ?? '') ?></td>
                            <td class="non-editable"><?= htmlspecialchars($empresa['municipio'] ?? '') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="adto"><?= htmlspecialchars($empresa['adto'] ?? '') ?></td>
                            <td class="editavel" data-coluna="folha_pagamento">
                                <select class="form-select form-select-sm select-editavel">
                                    <option value="" <?= (!isset($empresa['folha_pagamento']) || $empresa['folha_pagamento'] === '') ? 'selected' : '' ?>>Selecione</option>
                                    <option value="5º dia útil" <?= (($empresa['folha_pagamento'] ?? '') == '5º dia útil') ? 'selected' : '' ?>>5º dia útil</option>
                                    <option value="Ultimo dia do mes" <?= (($empresa['folha_pagamento'] ?? '') == 'Ultimo dia do mes') ? 'selected' : '' ?>>Ultimo dia do mes</option>
                                    <option value="N/A" <?= (($empresa['folha_pagamento'] ?? '') == 'N/A') ? 'selected' : '' ?>>N/A</option>
                                </select>
                            </td>
                            <td class="editavel" contenteditable="true" data-coluna="data_calculo_folha13"><?= htmlspecialchars(formatarDataBR($empresa['data_calculo_folha13'] ?? '')) ?></td>
                                <td class="editavel" contenteditable="true" data-coluna="data_envio_folha13"><?= htmlspecialchars(formatarDataBR($empresa['data_envio_folha13'] ?? '')) ?></td>
                            <td class="non-editable"><?= htmlspecialchars($empresa['tipo_folha'] ?? '') ?></td>
                            <td class="editavel" data-coluna="data_pagamento">
                                <select class="form-select form-select-sm select-editavel">
                                    <option value="" <?= (!isset($empresa['data_pagamento']) || $empresa['data_pagamento'] === '') ? 'selected' : '' ?>>Selecione</option>
                                    <option value="15" <?= (($empresa['data_pagamento'] ?? '') == '15') ? 'selected' : '' ?>>Dia 15</option>
                                    <option value="20" <?= (($empresa['data_pagamento'] ?? '') == '20') ? 'selected' : '' ?>>Dia 20</option>
                                    <option value="N/A" <?= (($empresa['data_pagamento'] ?? '') == 'N/A') ? 'selected' : '' ?>>N/A</option>
                                </select>
                            </td>
                            <td class="editavel" contenteditable="true" data-coluna="qtde_funcionarios"><?= htmlspecialchars($empresa['qtde_funcionarios'] ?? '') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="guias_sindicato"><?= htmlspecialchars($empresa['guias_sindicato'] ?? '') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="fgts_digital"><?= htmlspecialchars($empresa['fgts_digital'] ?? '') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="e_social"><?= htmlspecialchars($empresa['e_social'] ?? '') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="dctf_web_mes"><?= htmlspecialchars($empresa['dctf_web_mes'] ?? '') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="sd_login"><?= htmlspecialchars($empresa['sd_login'] ?? '') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="sd_senha"><?= htmlspecialchars($empresa['sd_senha'] ?? '') ?></td>

                            <?php if ($exibir_colunas_13): ?>
                                <td class="editavel" contenteditable="true" data-coluna="ADTO13"><?= htmlspecialchars($empresa['ADTO13'] ?? '') ?></td>
                                <td class="editavel" contenteditable="true" data-coluna="data_calculo_adto13"><?= htmlspecialchars(formatarDataBR($empresa['data_calculo_adto13'] ?? '')) ?></td>
                                <td class="editavel" contenteditable="true" data-coluna="data_envio_adto13"><?= htmlspecialchars(formatarDataBR($empresa['data_envio_adto13'] ?? '')) ?></td>
                                <td class="editavel" contenteditable="true" data-coluna="FOLHA13"><?= htmlspecialchars($empresa['FOLHA13'] ?? '') ?></td>
                        
                            <?php endif; ?>

                            <td class="reinf-trigger text-center" data-coluna="reinf" style="cursor: pointer;" title="Clique para ver detalhes">
                                <?php
                                $statusBanco = htmlspecialchars($empresa['reinf'] ?? '');
                                if (empty($statusBanco)) echo '<span class="badge bg-secondary">Pendente</span>';
                                elseif ($statusBanco === 'N/A') echo '<span class="badge badge-na">N/A</span>';
                                elseif (stripos($statusBanco, 'Pendência') === 0) echo '<span class="badge badge-pendencia" title="' . $statusBanco . '">Pendência</span>';
                                elseif (stripos($statusBanco, 'OK') === 0) echo '<span class="badge badge-ok">' . $statusBanco . '</span>';
                                else echo '<span class="badge bg-info text-dark">' . $statusBanco . '</span>';
                                ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>

    <script src="scripts_globais.js"></script>
    <script src="notifications.js"></script>

    <script>
        function toggleDissidio() {
            var lista = document.getElementById('lista-dissidio');
            if(lista) lista.style.display = (lista.style.display === 'none' || lista.style.display === '') ? 'block' : 'none';
        }

        function toggleEditaveis() {
            const dataTable = document.querySelector('.data-table');
            const btn = document.querySelector('.filter-buttons .btn[onclick="toggleEditaveis()"]');
            if (dataTable && btn) {
                dataTable.classList.toggle('show-all');
                btn.textContent = dataTable.classList.contains('show-all') ? 'Mostrar Apenas Editáveis' : 'Mostrar Todos Campos';
            }
        }

        function changeMonth() {
            const select = document.getElementById('select-mes');
            const selectedOption = select.options[select.selectedIndex];
            const mesId = selectedOption.value;
            const editavel = selectedOption.dataset.editavel === '1';
            const urlParams = new URLSearchParams(window.location.search);
            const verComoId = urlParams.get('ver_como');
            let novaUrl = `dp.php?mes_id=${mesId}&editavel=${editavel ? '1' : '0'}`;
            if (verComoId) novaUrl += `&ver_como=${verComoId}`;
            window.location.href = novaUrl;
        }

        $(document).ready(function() {
            window.columnFilters = window.columnFilters || {};
            let passwordModalGlobalRef = document.getElementById('passwordModalOverlay');

            function setupModalSearchBars() {
                $('#searchCertificadosInput').on('keyup', function() {
                    const termo = $(this).val().toLowerCase();
                    $('#tableCertificados tbody tr').each(function() {
                        $(this).toggle($(this).text().toLowerCase().includes(termo));
                    });
                });
            }

function setupTableSorting() {
    $('.data-table th.sortable').on('click', function(event) {
        if ($(event.target).hasClass('column-filter-icon')) return;

        const th = $(this);
        const table = th.closest('table');
        const tbody = table.find('tbody');
        const columnIndex = th.index();

        let currentDirection = th.hasClass('sorted-asc') ? 'asc' :
                              (th.hasClass('sorted-desc') ? 'desc' : 'none');

        let newDirection = (currentDirection === 'asc') ? 'desc' : 'asc';

        table.find('th.sortable')
            .removeClass('sorted-asc sorted-desc')
            .find('.sort-icon')
            .attr('class', 'fas fa-sort sort-icon');

        th.addClass(newDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
        th.find('.sort-icon').attr(
            'class',
            newDirection === 'asc' ? 'fas fa-sort-up sort-icon' : 'fas fa-sort-down sort-icon'
        );

        const rows = tbody.find('tr').toArray();

        rows.sort(function(a, b) {
            const valA = $(a).find('td').eq(columnIndex).text().trim();
            const valB = $(b).find('td').eq(columnIndex).text().trim();

            let comparison;

            if (!isNaN(valA) && !isNaN(valB)) {
                comparison = parseFloat(valA) - parseFloat(valB);
            } else {
                comparison = valA.localeCompare(valB, 'pt-BR', { sensitivity: 'base' });
            }

            return newDirection === 'asc' ? comparison : -comparison;
        });

        // NÃO usar empty()
        tbody.append(rows);
    });
}

            function setupModais() {
                const modais = {
                    'btnEmpresasAtivas': 'modalEmpresasAtivas',
                    'btnNovasObrigacoes': 'modalNovasObrigacoes',
                    'btnObrigacoesFuturas': 'modalObrigacoesFuturas',
                    'btnEmpresasSaindoMes': 'modalEmpresasSaindoMes',
                    'btnEmpresasSaindoFuturo': 'modalEmpresasSaindoFuturo',
                    'btnAbrirModalCertificados': 'modalCertificados',
                    'btnCertificadosVencendo': 'modalCertificadosVencendo',
                    'btnProcuracoesVencendo': 'modalProcuracoesVencendo'
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

                $(document).on('click', '.modal-close', function() {
                    $(this).closest('.modal-overlay').removeClass('active');
                    if (!$('.modal-overlay.active').length) document.body.style.overflow = '';
                });

                $(document).on('click', '.modal-overlay', function(e) {
                    if (e.target === this) {
                        $(this).removeClass('active');
                        if (!$('.modal-overlay.active').length) document.body.style.overflow = '';
                    }
                });
            }

            function applyTableFilters() {
                const searchTerm = $('#search-input').val().toLowerCase();
                $('.data-table tbody tr').each(function() {
                    const row = $(this);
                    let isVisible = true;
                    if (searchTerm && !row.text().toLowerCase().includes(searchTerm)) isVisible = false;
                    
                    if (isVisible) {
                        for (const colIndex in window.columnFilters) {
                            const requiredValue = window.columnFilters[colIndex];
                            const cell = row.find('td').eq(colIndex);
                            let rowValue = cell.find('select').length > 0 ? cell.find('select option:selected').text().trim() : cell.text().trim();
                            if (cell.hasClass('observacao-cell')) rowValue = cell.find('.observacao-content').text().trim();
                            
                            if (requiredValue === '(Vazias)' && rowValue !== '') { isVisible = false; break; } 
                            else if (requiredValue !== '(Vazias)' && rowValue !== requiredValue) { isVisible = false; break; }
                        }
                    }
                    row.toggle(isVisible);
                });
            }

function setupEdicaoCelulas() {
    const EDICAO_ESTA_LIBERADA = <?= $edicao_liberada ? 'true' : 'false' ?>;

    // contenteditable
    $('.data-table tbody')
        .on('focus', '.editavel[contenteditable="true"], .observacao-content[contenteditable="true"]', function() {
            if (!EDICAO_ESTA_LIBERADA) {
                alert("Este mês está bloqueado para edições. Contate o administrador.");
                this.blur();
                return;
            }
            this.dataset.originalValue = this.textContent;
        })
        .on('blur', '.editavel[contenteditable="true"], .observacao-content[contenteditable="true"]', function() {
            if (!EDICAO_ESTA_LIBERADA) return;
            if (this.textContent !== this.dataset.originalValue) {
                salvarAlteracao(this);
            }
        });

    // selects
    $('.data-table tbody')
        .on('focus', '.editavel .select-editavel', function() {
            this.dataset.originalValue = this.value;
        })
        .on('change', '.editavel .select-editavel', function() {
            if (!EDICAO_ESTA_LIBERADA) {
                alert("Este mês está bloqueado para edições.");
                this.value = this.dataset.originalValue || '';
                return;
            }
            salvarAlteracao(this);
        });
}

            function salvarAlteracao(elemento) {
                const celula = $(elemento).closest('.editavel')[0];
                const linha = $(celula).closest('tr')[0];
                const empresaId = linha.dataset.id;
                const cnpj = linha.dataset.cnpj;
                const coluna = celula.dataset.coluna;
                const valor = (elemento.tagName === 'SELECT') ? elemento.value : elemento.textContent.trim();

const colunasGlobais = [
    'folha_pagamento',
    'data_pagamento',
    'tipo_folha',
    'sd_login',
    'sd_senha',
    'ADTO13',
    'FOLHA13',
    'data_calculo_adto13',
    'data_envio_adto13',
    'data_calculo_folha13',
    'data_envio_folha13',
    'observacoes_dp',
    'alteracoes_pasta'
];
            let atualizarTodos = colunasGlobais.includes(coluna) && cnpj;

                let fetchBody = new URLSearchParams({
                    atualizar_todos_meses: atualizarTodos ? 'true' : 'false',
                    id: empresaId, cnpj: cnpj, coluna: coluna, valor: valor
                });

                celula.style.opacity = '0.5';
                celula.style.border = atualizarTodos ? '2px solid orange' : '2px solid lightblue';

                fetch('salvar_alteracao.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: fetchBody })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        celula.style.border = '2px solid green';
                        elemento.dataset.originalValue = valor;
                    } else {
                        alert(data.message);
                        celula.style.border = '2px solid red';
                    }
                }).catch(e => {
                    celula.style.border = '2px solid red';
                }).finally(() => {
                    setTimeout(() => { celula.style.opacity = '1'; celula.style.border = ''; }, 2000);
                });
            }

            function setupEnterKeyNavigation() {
                $('.data-table tbody').on('keydown', 'td.editavel[contenteditable="true"]', function(event) {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        const currentCell = $(this).closest('td');
                        const nextRow = currentCell.closest('tr').next('tr:visible');
                        if (nextRow.length) {
                            const targetCell = nextRow.find('td').eq(currentCell.index());
                            if (targetCell.length > 0) targetCell.focus();
                        }
                    }
                });
            }

            // CHAMADAS DE INICIALIZAÇÃO
            setupTableSorting();
            setupModais();
            setupEdicaoCelulas();
            setupEnterKeyNavigation();
            setupModalSearchBars();
            $('#search-input').on('input', applyTableFilters);

            // LÓGICA DO REINF
            $(document).on('click', '.reinf-trigger', function(e) {
                e.preventDefault();
                const id = $(this).closest('tr').data('id');
                
                $('#modalDetalhesReinf').addClass('active');
                $('body').css('overflow', 'hidden');
                $('#formReinfDetalhes input').val('Carregando...');

                $.ajax({
                    url: 'assets/backend/obter_detalhes_reinf.php',
                    method: 'GET',
                    data: { id: id },
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
                            $('#formReinfDetalhes input').val('Erro: ' + res.message);
                        }
                    },
                    error: function() {
                        $('#formReinfDetalhes input').val('Erro de conexão');
                    }
                });
            });

            // LÓGICA DO FILTRO DROPDOWN
            $('.data-table').on('click', '.column-filter-icon', function(event) {
                event.preventDefault();
                event.stopPropagation();
                const icon = $(this);
                const th = icon.closest('th');
                const columnIndex = th.index();
                
                $('#column-filter-dropdown').remove();
                const dropdown = $('<div id="column-filter-dropdown"></div>');
                
                dropdown.css({
                    'position': 'fixed', 'top': (icon.offset().top - $(window).scrollTop() + 25) + 'px',
                    'left': icon.offset().left + 'px', 'background-color': '#ffffff', 'border': '1px solid #dee2e6',
                    'box-shadow': '0 4px 12px rgba(0,0,0,0.15)', 'z-index': '99999', 'max-height': '250px',
                    'overflow-y': 'auto', 'min-width': '180px', 'padding': '8px', 'border-radius': '4px', 'color': '#333'
                });

                let values = new Set();
                th.closest('table').find('tbody tr').each(function() {
                    const cell = $(this).find('td').eq(columnIndex);
                    let text = cell.find('select').length ? cell.find('select option:selected').text() : cell.text();
                    if (text.trim() !== "") values.add(text.trim());
                });

                dropdown.append('<div class="filter-option" data-col="' + columnIndex + '" data-val="all" style="cursor:pointer; padding:8px; border-bottom:1px solid #eee; font-weight:bold; color:#007bff;">Limpar Filtro</div>');
                dropdown.append('<div class="filter-option" data-col="' + columnIndex + '" data-val="(Vazias)" style="cursor:pointer; padding:8px; color:#666;">(Vazias)</div>');

                Array.from(values).sort().forEach(val => {
                    dropdown.append('<div class="filter-option" data-col="' + columnIndex + '" data-val="' + val + '" style="cursor:pointer; padding:6px 8px;">' + val + '</div>');
                });

                $('body').append(dropdown);
            });

            $(document).on('click', '.filter-option', function() {
                const colIndex = $(this).data('col');
                const val = $(this).data('val');
                if (val === 'all') delete window.columnFilters[colIndex];
                else window.columnFilters[colIndex] = val;
                
                applyTableFilters();
                $('#column-filter-dropdown').remove();
                $('.data-table th').eq(colIndex).find('.column-filter-icon').css('color', val === 'all' ? '' : '#0BD3C4');
            });

            $(document).on('click', function(e) {
                if (!$(e.target).closest('#column-filter-dropdown').length) $('#column-filter-dropdown').remove();
            });

            // LÓGICA DO MODAL DE SENHA
            $('#changePasswordBtn').on('click', function() {
                $('#changePasswordForm')[0].reset();
                $('#modal-message').hide();
                $('#passwordModalOverlay').addClass('active');
            });

            $('#changePasswordForm').on('submit', function(e) {
                e.preventDefault();
                const form = this;
                const msg = $('#modal-message');
                if ($('#nova_senha').val() !== $('#confirmar_senha').val()) {
                    msg.text('As senhas não coincidem!').addClass('error').show(); return;
                }
                fetch('alterar_senha.php', { method: 'POST', body: new FormData(form) })
                .then(r => r.json())
                .then(data => {
                    msg.text(data.message).removeClass('error success').addClass(data.success ? 'success' : 'error').show();
                    if(data.success) { form.reset(); setTimeout(() => $('#passwordModalOverlay').removeClass('active'), 2000); }
                });
            });

            $('#logoutBtn').on('click', function() { window.location.href = 'logout.php'; });
        });
    </script>
</body>
</html>