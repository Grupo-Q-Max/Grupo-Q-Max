<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
require_once 'assets/backend/config.php';
session_start();
header("Cache-Control: no-cache, no-store, must-revalidate"); // HTTP 1.1.
header("Pragma: no-cache"); // HTTP 1.0.
header("Expires: 0"); // Proxies.
// ------------------
$usuario_logado_id = $_SESSION['usuario_id'] ?? 0;
$tipo_conta_logado = $_SESSION['tipo_conta'] ?? '';

$usuario_id_alvo = $usuario_logado_id;
$area_alvo = $_SESSION['tipo_conta'];

$id_funcionario_get = filter_input(INPUT_GET, 'ver_como', FILTER_VALIDATE_INT);
$area_get_raw = $_GET['area'] ?? '';
$areas_permitidas = ['fiscal', 'dp', 'contabil'];

if ($id_funcionario_get && in_array($area_get_raw, $areas_permitidas) && (strpos($tipo_conta_logado, 'lider_') === 0 || $tipo_conta_logado === 'admin')) {
    $usuario_id_alvo = $id_funcionario_get;
    $area_alvo = $area_get_raw;
}

if (!$usuario_logado_id) {
    header('Location: index.php');
    exit();
}

if ($tipo_conta_logado !== 'admin' && strpos($tipo_conta_logado, 'lider_') === false && $tipo_conta_logado !== $area_alvo) {
    $_SESSION['mensagem'] = 'Acesso restrito a esta área.';
    header('Location: dashboard.php');
    exit();
}
if (strpos($tipo_conta_logado, 'lider_') === 0 && str_replace('lider_', '', $tipo_conta_logado) !== $area_alvo) {
    $_SESSION['mensagem'] = 'Você não tem permissão para ver detalhes de outra área.';
    header('Location: painel_lider.php');
    exit();
}

$usuario_id = $usuario_id_alvo;
$usuario_nome = obterNomeUsuario($conexao, $usuario_id);
$tem_parcelamento = false;
$sql_verificar_parcelamento = "SELECT COUNT(*) FROM parcelamentos WHERE id_usuario = ? LIMIT 1";
$stmt_verificar = $conexao->prepare($sql_verificar_parcelamento);
$stmt_verificar->bind_param('i', $usuario_id);
$stmt_verificar->execute();
$stmt_verificar->bind_result($count);
$stmt_verificar->fetch();
$stmt_verificar->close();

if ($count > 0) {
    $tem_parcelamento = true;
}
$meses_pt = [
    1 => 'Janeiro',
    2 => 'Fevereiro',
    3 => 'Março',
    4 => 'Abril',
    5 => 'Maio',
    6 => 'Junho',
    7 => 'Julho',
    8 => 'Agosto',
    9 => 'Setembro',
    10 => 'Outubro',
    11 => 'Novembro',
    12 => 'Dezembro'
];

$ano_atual = date('Y');
$mes_atual_num = date('n');

function formatarDataBR($data)
{
    if (empty($data) || $data === '0000-00-00') {
        return '';
    }
    try {
        $dateObj = new DateTime($data);
        return $dateObj->format('d/m/Y');
    } catch (Exception $e) {
        return '';
    }
}
// Função auxiliar para renderizar os badges coloridos
function documentoEhCPF(?string $documento): bool
{
    $numeros = preg_replace('/\D/', '', trim($documento ?? ''));

    return strlen($numeros) === 11;
}
function renderizarBadge($status)
{
    $status = htmlspecialchars($status ?? '');
    if (empty($status) || $status === 'Pendente') {
        echo '<span class="badge bg-secondary">Pendente</span>';
    } elseif ($status === 'N/A') {
        echo '<span class="badge badge-na">N/A</span>';
    } elseif (strpos($status, 'Pendência') === 0) {
        echo '<span class="badge badge-pendencia" title="' . $status . '">Pendência</span>';
    } elseif (strpos($status, 'OK') === 0 || $status === 'Preenchido') {
        echo '<span class="badge badge-ok">' . $status . '</span>';
    } else {
        echo '<span class="badge bg-info text-dark">' . $status . '</span>';
    }
}
function obterStatusDoMes($conexao, $mes_id)
{
    if (!$mes_id) {
        return ['status' => 'fechado', 'edicao_status' => 'bloqueada'];
    }
    $query = "SELECT status, edicao_status FROM controle_meses WHERE id = ?";
    $stmt = $conexao->prepare($query);
    $stmt->bind_param('i', $mes_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    return $row ?: ['status' => 'fechado', 'edicao_status' => 'bloqueada'];
}

function obterMesesDisponiveis($conexao, $usuario_id)
{
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

function mesEstaAberto($conexao, $mes_id)
{
    $query = "SELECT status FROM controle_meses WHERE id = ?";
    $stmt = $conexao->prepare($query);
    $stmt->bind_param('i', $mes_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    return isset($row['status']) && $row['status'] === 'aberto';
}

function podeEditarMes($mes, $ano)
{
    $agora = new DateTime();
    $mesAtual = (int)$agora->format('m');
    $anoAtual = (int)$agora->format('Y');
    return ($ano == $anoAtual && ($mes == $mesAtual || $mes == ($mesAtual == 1 ? 12 : $mesAtual - 1))) ||
        ($mes == 12 && $mesAtual == 1 && $ano == $anoAtual - 1);
}

function obterEmpresasDoMes($conexao, $usuario_id, $mes_id)
{
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

function obterObrigacoesFuturas($conexao, $usuario_id)
{
    $primeiroDiaProximoMes = date('Y-m-01', strtotime('+1 month'));
    $query = "SELECT cf.codigo, cf.empresa, cf.tributacao,
              DATE_FORMAT(MIN(cf.data_obrigacao), '%d/%m/%Y') as data_obrigacao_formatada,
              DATEDIFF(MIN(cf.data_obrigacao), CURDATE()) as dias_restantes
              FROM controle_fechamento cf
              JOIN responsaveis_empresa re ON cf.id = re.id_empresa
              WHERE re.id_usuario = ? AND re.responsavel_atual = 1 
              AND cf.data_obrigacao >= ?
              GROUP BY cf.codigo
              ORDER BY MIN(cf.data_obrigacao) ASC
              LIMIT 10";
    $stmt = $conexao->prepare($query);
    $stmt->bind_param('is', $usuario_id, $primeiroDiaProximoMes);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

function obterNovasObrigacoesMes($conexao, $usuario_id, $mes, $ano)
{
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

function obterEmpresasSaindoNoMes($conexao, $usuario_id, $mes, $ano)
{
    $mes = str_pad($mes, 2, '0', STR_PAD_LEFT);
    $primeiroDia = "$ano-$mes-01";
    $ultimoDia = date("Y-m-t", strtotime($primeiroDia));
    $query = "SELECT cf.empresa, cf.tributacao,
              DATE_FORMAT(cf.data_saida, '%d/%m/%Y') as data_saida_formatada,
              DATEDIFF(cf.data_saida, CURDATE()) as dias_restantes
              FROM controle_fechamento cf
              JOIN responsaveis_empresa re ON cf.id = re.id_empresa
              WHERE re.id_usuario = ? AND re.responsavel_atual = 1 
              AND cf.data_saida BETWEEN ? AND ?
              ORDER BY cf.data_saida ASC";
    $stmt = $conexao->prepare($query);
    $stmt->bind_param('iss', $usuario_id, $primeiroDia, $ultimoDia);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

function obterEmpresasSaindoFuturo($conexao, $usuario_id)
{
    $primeiroDiaProximoMes = date('Y-m-01', strtotime('+1 month'));
    $query = "SELECT cf.empresa, cf.tributacao,
              DATE_FORMAT(cf.data_saida, '%d/%m/%Y') as data_saida_formatada,
              DATEDIFF(cf.data_saida, CURDATE()) as dias_restantes
              FROM controle_fechamento cf
              JOIN responsaveis_empresa re ON cf.id = re.id_empresa
              WHERE re.id_usuario = ? AND re.responsavel_atual = 1 
              AND cf.data_saida >= ?
              ORDER BY cf.data_saida ASC
              LIMIT 10";
    $stmt = $conexao->prepare($query);
    $stmt->bind_param('is', $usuario_id, $primeiroDiaProximoMes);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

$meses_disponiveis = obterMesesDisponiveis($conexao, $usuario_id);

// LÓGICA ALTERADA: Padrão é o mês anterior (índice 1)
if (isset($_GET['mes_id'])) {
    $mes_selecionado = (int)$_GET['mes_id'];
} else {
    // Tenta pegar o índice 1 (mês anterior ao aberto). 
    // Se não existir (ex: sistema começou agora), pega o índice 0 (atual).
    $mes_selecionado = $meses_disponiveis[1]['id'] ?? ($meses_disponiveis[0]['id'] ?? null);
}
// Lógica de permissão de edição corrigida
$status_do_mes = obterStatusDoMes($conexao, $mes_selecionado);
$edicao_liberada = ($status_do_mes['edicao_status'] === 'liberada');

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

// Verifica apenas se o mês é 1
$is_janeiro = ($mes_selecionado_num == 1);
$is_dezembro = ($mes_selecionado_num == 12);
$is_setembro_2026 = ($mes_selecionado_num == 9 && $ano_selecionado == 2026);

// --- LÓGICA NOVA: Ocultar GIA a partir de 2026 ---
$exibir_gia = ($ano_selecionado < 2026);
// -------------------------------------------------

$obrigacoes_futuras = obterObrigacoesFuturas($conexao, $usuario_id);
$novas_obrigacoes_mes = obterNovasObrigacoesMes($conexao, $usuario_id, $mes_selecionado_num, $ano_selecionado);
$empresas_saindo_mes_atual = obterEmpresasSaindoNoMes($conexao, $usuario_id, $mes_selecionado_num, $ano_selecionado);
$empresas_saindo_futuro = obterEmpresasSaindoFuturo($conexao, $usuario_id);
$empresas = $mes_selecionado ? obterEmpresasDoMes($conexao, $usuario_id, $mes_selecionado) : [];

// =======================================================================
// == CÁLCULO DE STATUS DETALHADO (ATUALIZADO) ==
// =======================================================================

// 1. Colunas Padrão (Todo mês)
$colunas_monitoradas = [
    'reinf'             => 'REINF',
    'impostos'          => 'Impostos',
    'iss'               => 'ISS',
    'mit'               => 'MIT',
    'sped_fiscal'       => 'Sped Fiscal',
    'sped_contribuicao' => 'Sped Contrib.',
    'destda'            => 'Destda'
];
if ($mes_selecionado_num == 5) {
    $colunas_monitoradas['alteracoes_pasta'] = 'Alterações Pasta';
}

// Só adiciona GIA se for ano anterior a 2026
if ($exibir_gia) {
    $colunas_monitoradas['gia'] = 'GIA';
}
// 2. Inicializa array de stats para as colunas padrão
$stats_detalhadas = [];
foreach ($colunas_monitoradas as $key => $label) {
    $stats_detalhadas[$key] = [
        'label' => $label,
        'total' => 0,
        'feitos' => 0,
        'pendentes' => 0,
        'porcentagem' => 0
    ];
}

// 3. Se for JANEIRO, adiciona as novas colunas ao array de estatísticas
// (Nota: Elas começam zeradas e só serão incrementadas se a empresa se aplicar)
if ($is_janeiro) {
    $stats_detalhadas['dasnmei'] = [
        'label' => 'DASN MEI',
        'total' => 0,
        'feitos' => 0,
        'pendentes' => 0,
        'porcentagem' => 0
    ];
    $stats_detalhadas['taxa_fiscal'] = [
        'label' => 'Taxa Fiscal',
        'total' => 0,
        'feitos' => 0,
        'pendentes' => 0,
        'porcentagem' => 0
    ];
}

$total_campos_geral = 0;
$preenchidos_geral = 0;
$empresas_100_porcento = 0;

foreach ($empresas as $empresa) {
    $empresa_completa = true; // Assume que está completa e tenta provar o contrário

    // A. Verifica colunas padrão (REINF, ISS, etc...)
    foreach ($colunas_monitoradas as $key => $label) {
        // Incrementa o denominador total desta coluna
        $stats_detalhadas[$key]['total']++;

        // Incrementa o denominador geral da barra de progresso
        $total_campos_geral++;

$valor = trim($empresa[$key] ?? '');

if ($key === 'alteracoes_pasta') {
    if ($valor === 'Concluído') {
        $stats_detalhadas[$key]['feitos']++;
        $preenchidos_geral++;
    } else {
        $stats_detalhadas[$key]['pendentes']++;
        $empresa_completa = false;
    }
} elseif (!empty($valor)) {
    $stats_detalhadas[$key]['feitos']++;
    $preenchidos_geral++;
} else {
    $stats_detalhadas[$key]['pendentes']++;
    $empresa_completa = false;
}
    }

    // B. Verifica Colunas de Janeiro (Lógica Inteligente)
    if ($is_janeiro) {
        $trib = mb_strtolower(trim($empresa['tributacao'] ?? ''));
        $isMei = (strpos($trib, 'mei') !== false);
        $isSimples = (strpos($trib, 'simples') !== false || strpos($trib, 'nacional') !== false);

        // --- Lógica DASN MEI ---
        // Só conta se for MEI. Se não for, é N/A e não entra na conta.
        if ($isMei) {
            $stats_detalhadas['dasnmei']['total']++;
            $total_campos_geral++; // Aumenta a exigência da barra geral

            $valorDasn = trim($empresa['dasnmei'] ?? '');
            if (!empty($valorDasn)) {
                $stats_detalhadas['dasnmei']['feitos']++;
                $preenchidos_geral++;
            } else {
                $stats_detalhadas['dasnmei']['pendentes']++;
                $empresa_completa = false;
            }
        }

        // --- Lógica Taxa Fiscal ---
        // Só conta se NÃO for Mei e NÃO for Simples.
        if (!$isMei && !$isSimples) {
            $stats_detalhadas['taxa_fiscal']['total']++;
            $total_campos_geral++; // Aumenta a exigência da barra geral

            $valorTaxa = trim($empresa['taxa_fiscal'] ?? '');
            if (!empty($valorTaxa)) {
                $stats_detalhadas['taxa_fiscal']['feitos']++;
                $preenchidos_geral++;
            } else {
                $stats_detalhadas['taxa_fiscal']['pendentes']++;
                $empresa_completa = false;
            }
        }
    }

    // Se passou por todas as colunas aplicáveis e continuou true
    if ($empresa_completa) {
        $empresas_100_porcento++; // No admin a variável pode ser $empresas_100, ajuste conforme seu código
    }
}

// 4. Calcula porcentagens finais individuais
foreach ($stats_detalhadas as $key => &$stat) {
    if ($stat['total'] > 0) {
        $stat['porcentagem'] = round(($stat['feitos'] / $stat['total']) * 100);
    } else {
        // Se nenhuma empresa precisou desse campo (ex: nenhuma empresa MEI no sistema), fica 0 ou 100% (opcional)
        // Definindo 0 para não mostrar barra cheia vazia
        $stat['porcentagem'] = 0;
    }
}
unset($stat);

// 5. Calcula porcentagem geral
$porcentagem_geral = ($total_campos_geral > 0) ? round(($preenchidos_geral / $total_campos_geral) * 100) : 0;

// Opcional: Se quiser limpar do array visual as colunas que têm total = 0 (ex: Taxa Fiscal em um mês que só tem MEI)
// filtre o array aqui. Se quiser mostrar mesmo zerado, deixe como está.
$stats_detalhadas = array_filter($stats_detalhadas, function ($item) {
    // Mantém se tiver pelo menos 1 empresa que exigiu isso, ou se for coluna padrão
    return $item['total'] > 0;
});

foreach ($stats_detalhadas as $key => &$stat) {
    $stat['porcentagem'] = ($stat['total'] > 0) ? round(($stat['feitos'] / $stat['total']) * 100) : 0;
}
unset($stat);

// Lógica de vencimentos (mantida no backend, mas escondida no frontend conforme pedido)
$certificados_a_vencer = 0;
$procuracoes_a_vencer = 0;
$empresas_certificados_vencendo = [];
$empresas_procuracoes_vencendo = [];
$hoje_venc = new DateTime();
$limite_vencimento_venc = (new DateTime())->modify('+30 days');

foreach ($empresas as $empresa) {
    if (!empty($empresa['data_vencimento_certificado'])) {
        try {
            $data_vencimento_cert = new DateTime($empresa['data_vencimento_certificado']);
            if ($data_vencimento_cert >= $hoje_venc && $data_vencimento_cert <= $limite_vencimento_venc) {
                $certificados_a_vencer++;
                $intervalo_cert = $hoje_venc->diff($data_vencimento_cert);
                $dias_restantes_cert = $intervalo_cert->days + ($intervalo_cert->invert ? -1 : 1);
                $empresas_certificados_vencendo[] = [
                    'empresa' => $empresa['empresa'],
                    'cnpj' => $empresa['cnpj'],
                    'data_vencimento' => formatarDataBR($empresa['data_vencimento_certificado']),
                    'dias_restantes' => $dias_restantes_cert
                ];
            }
        } catch (Exception $e) {
        }
    }
    if (!empty($empresa['data_procuracao_target'])) {
        try {
            $data_vencimento_proc = new DateTime($empresa['data_procuracao_target']);
            if ($data_vencimento_proc >= $hoje_venc && $data_vencimento_proc <= $limite_vencimento_venc) {
                $procuracoes_a_vencer++;
                $intervalo_proc = $hoje_venc->diff($data_vencimento_proc);
                $dias_restantes_proc = $intervalo_proc->days + ($intervalo_proc->invert ? -1 : 1);
                $empresas_procuracoes_vencendo[] = [
                    'empresa' => $empresa['empresa'],
                    'cnpj' => $empresa['cnpj'],
                    'data_vencimento' => formatarDataBR($empresa['data_procuracao_target']),
                    'dias_restantes' => $dias_restantes_proc
                ];
            }
        } catch (Exception $e) {
        }
    }
}

$num_empresas = count($empresas);
$num_funcionarios = array_sum(array_map('intval', array_column($empresas, 'qtde_funcionarios')));

// Removemos 'gia' da lista fixa e adicionamos condicionalmente
$camposObrigatorios = ['reinf', 'impostos', 'iss', 'mit', 'sped_fiscal', 'sped_contribuicao', 'destda'];

if ($exibir_gia) {
    $camposObrigatorios[] = 'gia';
}

$total_campos = count($empresas) * count($camposObrigatorios);
$campos_preenchidos = 0;

foreach ($empresas as $empresa) {
    foreach ($camposObrigatorios as $campo) {
        if (!empty(trim($empresa[$campo] ?? ''))) {
            $campos_preenchidos++;
        }
    }
}

$progresso_percentual = $total_campos > 0 ? round(($campos_preenchidos / $total_campos) * 100) : 0;
$empresas_preenchidas = count(array_filter($empresas, function ($empresa) use ($camposObrigatorios) {
    foreach ($camposObrigatorios as $campo) {
        if (empty(trim($empresa[$campo] ?? ''))) return false;
    }
    return true;
}));
$mostrar_editaveis = isset($_GET['editaveis']) && $_GET['editaveis'] == '1';
?>
<!DOCTYPE html>
<html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fiscal</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link rel="stylesheet" href="assets/css/fiscal.css?v=<?= filemtime('assets/css/fiscal.css') ?>">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/fiscal.css">
    <style>
        /* --- ESTILOS DO FILTRO ESTILO EXCEL (CORRIGIDO) --- */

        /* Cabeçalho da coluna (th) */
        .filterable-header {
            position: relative;
            /* Necessário para o ícone */
            padding-right: 30px !important;
        }

        /* Ícone do funil */
        .filterable-header .filter-icon-wrapper {
            position: absolute;
            top: 50%;
            right: 5px;
            transform: translateY(-50%);
            cursor: pointer;
            padding: 5px;
            color: #ccc;
            transition: color 0.3s ease;
            z-index: 100;
            /* Fica acima do texto */
        }

        .filterable-header:hover .filter-icon-wrapper,
        .filterable-header .filter-icon-wrapper.active {
            color: #007bff;
        }

        .btn-filter-action {
            border: 1px solid transparent;
            padding: 4px 12px;
            font-size: 0.85rem;
            border-radius: 4px;
            cursor: pointer;
        }

        .btn-filter-clear {
            background: transparent;
            border: 1px solid #ccc;
            color: #555;
        }

        .btn-filter-apply {
            background: #007bff;
            color: #fff;
        }

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

        .iss-select-wrapper {
            padding: 0 !important;
            margin: 0 !important;
        }

        .iss-select {
            width: 100%;
            height: 100%;
            border: none;
            background: transparent;
            cursor: pointer;
            font-size: 0.9rem;
            padding: 8px 12px;
            color: #333;
        }

        .iss-select:focus {
            outline: none;
            background-color: #e8f0fe;
        }

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

        .fill-low {
            background-color: #dc3545;
        }

        .fill-mid {
            background-color: #ffc107;
        }

        .fill-high {
            background-color: #198754;
        }

        .impostos-trigger:hover {
            background-color: rgba(0, 0, 0, 0.05);
        }

        .stats-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }

        .stats-box {
            background-color: var(--card-bg, #fff);
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
            position: relative;
        }

        .stats-box h3 {
            font-size: 1rem;
            color: var(--text-muted, #6c757d);
            margin-bottom: 5px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .stats-box .stats-numbers {
            font-size: 1.75rem;
            font-weight: 700;
            color: var(--text-color, #212529);
        }

        .stats-box p {
            font-size: 0.9rem;
            color: var(--text-muted, #6c757d);
            margin: 0;
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

        /* Estilo dos cards de Mês */
        .mes-card-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #fff;
            border: 1px solid #ced4da;
            border-radius: 6px;
            padding: 10px 15px;
            cursor: pointer;
            transition: all 0.2s ease;
            font-weight: 600;
            color: #333;
            user-select: none;
            /* Evita selecionar o texto ao clicar rápido */
        }

        .mes-card-item:hover {
            background-color: #f8f9fa;
            border-color: #0d6efd;
            transform: translateY(-1px);
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }

        /* Quando marcado (Via CSS moderno ou Classe JS) */
        .mes-card-item:has(.form-check-input:checked),
        .mes-card-item.active {
            background-color: #d1e7dd !important;
            border-color: #0f5132 !important;
            color: #0f5132 !important;
        }

        .check-mes-sped {
            width: 1.3em;
            height: 1.3em;
            cursor: pointer;
        }

        /* Confirm modal buttons - evita texto cortado e deixa botões uniformes */
        #confirmOkSemMovimentoModal .modal-body .d-flex { gap: 0.5rem; }
        #confirmOkSemMovimentoModal .modal-body .d-flex .btn {
            min-width: 140px;
            white-space: nowrap;
            text-align: center;
        }
    
        /* CORRECAO CARNE LEAO FISCAL */
        .data-table tbody td.carne-leao-bloqueado {
            display: table-cell !important;
            visibility: visible !important;
            opacity: 1 !important;
            position: static !important;
            min-width: 150px !important;
            width: 150px !important;
            max-width: 150px !important;
            box-sizing: border-box !important;
            text-align: center !important;
            background-color: #e9ecef !important;
            cursor: not-allowed !important;
            user-select: none !important;
        }

        .data-table tbody td[data-coluna="carne_leao"] {
            display: table-cell !important;
            visibility: visible !important;
            min-width: 150px !important;
            width: 150px !important;
            max-width: 150px !important;
            box-sizing: border-box !important;
            text-align: center !important;
        }

        .data-table thead th[data-coluna="carne_leao"] {
            display: table-cell !important;
            visibility: visible !important;
            min-width: 150px !important;
            width: 150px !important;
            max-width: 150px !important;
            box-sizing: border-box !important;
        }
</style>
</head>

<body>

    <body>
        <div id="selecionarEmpresaModal" class="modal-overlay">
            <div class="modal-container">
                <div class="modal-header">
                    <h3 class="modal-title">
                        <i class="fas fa-building"></i> Selecione uma Empresa
                    </h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group mb-3 d-flex justify-content-center gap-3" style="border-bottom: 1px solid #eee; padding-bottom: 15px;">
                        <div class="form-check form-check-inline">
                            <input class="form-check-input" type="radio" name="filtro_status_parcelamento" id="filtro_status_todas" value="todas" checked>
                            <label class="form-check-label" for="filtro_status_todas">Todas</label>
                        </div>
                    </div>
                    <div class="form-group mb-3">
                        <label for="filtro-empresas-parcelamento">Filtrar por Nome, Cód ou CNPJ:</label>
                        <input type="text" id="filtro-empresas-parcelamento" class="form-control" placeholder="Nome, CNPJ ou Código...">
                    </div>
                    <div class="text-center my-3" style="border-bottom: 1px solid #eee; padding-bottom: 20px;">
                        <button id="btn-parcelamento-avulso" class="btn btn-outline-primary btn-sm">
                            <i class="fas fa-plus"></i> Lançar para Empresa Avulsa (Manual)
                        </button>
                    </div>
                    <div id="lista-empresas-parcelamento" class="lista-empresas-scrollable">
                        <div class="loading-content"></div>
                    </div>
                </div>
            </div>
        </div>

        <div id="detalhesParcelamentoModal" class="modal-overlay">
            <div class="modal-container">
                <div class="modal-header">
                    <h3 class="modal-title">
                        <i class="fas fa-handshake"></i> Gerar Parcelamento
                    </h3>
              
                    <button class="modal-close">&times;</button>
                </div>
                <form id="formParcelamento" method="POST">
                    <div class="modal-body">
                        <p id="info-empresa-existente">Empresa selecionada: <strong id="parcelamento-empresa-nome"></strong></p>

                        <div id="info-empresa-avulsa" style="display: none;">
                            <div class="form-group">
                                <label for="parcelamento-nome-avulso" class="form-label fw-bold"><i class="fas fa-building"></i> Nome da Empresa (Avulsa):</label>
                                <input type="text" id="parcelamento-nome-avulso" class="form-control form-control-sm">
                            </div>
                            <div class="form-group mt-2">
                                <label for="parcelamento-cnpj-avulso" class="form-label fw-bold"><i class="fas fa-id-card"></i> CNPJ (Avulso):</label>
                                <input type="text" id="parcelamento-cnpj-avulso" class="form-control form-control-sm">
                            </div>
                        </div>

                        <input type="hidden" id="parcelamento-id-empresa" name="id_empresa">
                        <input type="hidden" id="parcelamento-codigo-empresa" name="codigo_empresa">
                        <input type="hidden" id="parcelamento-cnpj-empresa" name="cnpj_empresa">
                        <input type="hidden" id="parcelamento-nome-empresa" name="nome_empresa">

                        <div class="form-group">
                            <label for="responsavel-parcelamento"><i class="fas fa-user-tag"></i> Responsável:</label>
                            <select id="responsavel-parcelamento" name="id_usuario" class="form-select"></select>
                        </div>
                        <div class="form-group">
                            <label for="parcelamento-desc"><i class="fas fa-file-alt"></i> Descrição:</label>
                            <input type="text" id="parcelamento-desc" name="parcelamento" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="parcelamento-qtde"><i class="fas fa-calculator"></i> Qtde. Parcelas:</label>
                            <input type="number" id="parcelamento-qtde" name="qtde_parcelas" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="parcelamento-valor"><i class="fas fa-money-bill-wave"></i> Valor (R$):</label>
                            <input type="text" id="parcelamento-valor" name="valor" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="parcelamento-data-inicio"><i class="fas fa-calendar-day"></i> Data Início:</label>
                            <input type="date" id="parcelamento-data-inicio" name="data_efetivacao" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="parcelamento-data-final"><i class="fas fa-calendar-check"></i> Data Final:</label>
                            <input type="date" id="parcelamento-data-final" name="data_final" class="form-control" required>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="submit" name="salvar_parcelamento" class="btn btn-success">
                            <i class="fas fa-save"></i> Salvar Parcelamento
                        </button>
                    </div>
                </form>
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
                        <input type="text" id="searchCertificadosInput"
                            placeholder="Pesquisar por empresa, CNPJ, tipo de certificado..."
                            style="width: 100%; padding: 8px 8px 8px 35px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
                    </div>
                    <?php if (!empty($empresas)): ?>
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
                    <?php else: ?>
                        <div class="empty-message">
                            <i class="fas fa-building"></i>
                            <p>Nenhuma empresa encontrada para os filtros atuais.</p>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <div id="modalCertificadosVencendo" class="modal-overlay">
            <div class="modal-container">
                <div class="modal-header">
                    <h3 class="modal-title"><i class="fas fa-exclamation-triangle"></i> Certificados Vencendo (Próximos 30 dias)</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <?php if (!empty($empresas_certificados_vencendo)): ?>
                        <table class="modal-table">
                            <thead>
                                <tr>
                                    <th>Empresa</th>
                                    <th>Data Vencimento</th>
                                    <th>Dias Restantes</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($empresas_certificados_vencendo as $item): ?>
                                    <tr>
                                        <td><?= htmlspecialchars($item['empresa']) ?></td>
                                        <td><?= htmlspecialchars($item['data_vencimento']) ?></td>
                                        <td>
                                            <?php
                                            $badge_class = 'badge-success';
                                            if ($item['dias_restantes'] <= 7) {
                                                $badge_class = 'badge-danger';
                                            } elseif ($item['dias_restantes'] <= 15) {
                                                $badge_class = 'badge-warning';
                                            }
                                            ?>
                                            <span class="badge <?= $badge_class ?>"> <?= $item['dias_restantes'] ?> dia(s) </span>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    <?php else: ?>
                        <div class="empty-message">
                            <i class="fas fa-check-circle"></i>
                            <p>Nenhum certificado vencendo nos próximos 30 dias para as empresas filtradas.</p>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <div id="modalProcuracoesVencendo" class="modal-overlay">
            <div class="modal-container">
                <div class="modal-header">
                    <h3 class="modal-title"><i class="fas fa-user-clock"></i> Procurações Vencendo (Próximos 30 dias)</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <?php if (!empty($empresas_procuracoes_vencendo)): ?>
                        <table class="modal-table">
                            <thead>
                                <tr>
                                    <th>Empresa</th>
                                    <th>Data Vencimento</th>
                                    <th>Dias Restantes</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($empresas_procuracoes_vencendo as $item): ?>
                                    <tr>
                                        <td><?= htmlspecialchars($item['empresa']) ?></td>
                                        <td><?= htmlspecialchars($item['data_vencimento']) ?></td>
                                        <td>
                                            <?php
                                            $badge_class = 'badge-success';
                                            if ($item['dias_restantes'] <= 7) {
                                                $badge_class = 'badge-danger';
                                            } elseif ($item['dias_restantes'] <= 15) {
                                                $badge_class = 'badge-warning';
                                            }
                                            ?>
                                            <span class="badge <?= $badge_class ?>"> <?= $item['dias_restantes'] ?> dia(s) </span>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    <?php else: ?>
                        <div class="empty-message">
                            <i class="fas fa-check-circle"></i>
                            <p>Nenhuma procuração vencendo nos próximos 30 dias para as empresas filtradas.</p>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <div id="modalEmpresasAtivas" class="modal-overlay">
            <div class="modal-container">
                <div class="modal-header">
                    <h3 class="modal-title"><i class="fas fa-building"></i> Empresas Ativas</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <?php if (!empty($empresas)): ?>
                        <table class="modal-table">
                            <thead>
                                <tr>
                                    <th>Empresa</th>
                                    <th>CNPJ</th>
                                    <th>Tributação</th>
                                    <th>Funcionários</th>
                                </tr>
                            </thead>
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
                    <?php else: ?>
                        <div class="empty-message">
                            <i class="fas fa-building"></i>
                            <p>Nenhuma empresa ativa encontrada</p>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <div id="modalNovasObrigacoes" class="modal-overlay">
            <div class="modal-container">
                <div class="modal-header">
                    <h3 class="modal-title"><i class="fas fa-calendar-plus"></i> Novas Obrigações - <?= $meses_pt[$mes_selecionado_num] . ' ' . $ano_selecionado ?></h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <?php if (!empty($novas_obrigacoes_mes)): ?>
                        <table class="modal-table">
                            <thead>
                                <tr>
                                    <th>Empresa</th>
                                    <th>Tributação</th>
                                    <th>Data Obrigação</th>
                                    <th>Dias Restantes</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($novas_obrigacoes_mes as $obrigacao): ?>
                                    <tr>
                                        <td><?= htmlspecialchars($obrigacao['empresa']) ?></td>
                                        <td><?= htmlspecialchars($obrigacao['tributacao']) ?></td>
                                        <td><?= htmlspecialchars($obrigacao['data_obrigacao_formatada']) ?></td>
                                        <td>
                                            <span class="badge <?= $obrigacao['dias_restantes'] <= 7 ? 'badge-danger' : ($obrigacao['dias_restantes'] <= 15 ? 'badge-warning' : 'badge-success') ?>">
                                                <?= $obrigacao['dias_restantes'] ?> dias
                                            </span>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    <?php else: ?>
                        <div class="empty-message">
                            <i class="fas fa-calendar-plus"></i>
                            <p>Nenhuma nova obrigação para este mês</p>
                        </div>
                    <?php endif; ?>
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
                            <thead>
                                <tr>
                                    <th>Empresa</th>
                                    <th>Tributação</th>
                                    <th>Data Obrigação</th>
                                    <th>Dias Restantes</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($obrigacoes_futuras as $obrigacao): ?>
                                    <tr>
                                        <td><?= htmlspecialchars($obrigacao['empresa']) ?></td>
                                        <td><?= htmlspecialchars($obrigacao['tributacao']) ?></td>
                                        <td><?= htmlspecialchars($obrigacao['data_obrigacao_formatada']) ?></td>
                                        <td>
                                            <span class="badge <?= $obrigacao['dias_restantes'] <= 7 ? 'badge-danger' : ($obrigacao['dias_restantes'] <= 15 ? 'badge-warning' : 'badge-success') ?>">
                                                <?= $obrigacao['dias_restantes'] ?> dias
                                            </span>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    <?php else: ?>
                        <div class="empty-message">
                            <i class="fas fa-calendar-check"></i>
                            <p>Nenhuma obrigação futura encontrada</p>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <div id="modalEmpresasSaindoMes" class="modal-overlay">
            <div class="modal-container">
                <div class="modal-header">
                    <h3 class="modal-title"><i class="fas fa-sign-out-alt"></i> Empresas Saindo - <?= $meses_pt[$mes_selecionado_num] . ' ' . $ano_selecionado ?></h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <?php if (!empty($empresas_saindo_mes_atual)): ?>
                        <table class="modal-table">
                            <thead>
                                <tr>
                                    <th>Empresa</th>
                                    <th>Tributação</th>
                                    <th>Data de Saída</th>
                                    <th>Dias Restantes</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($empresas_saindo_mes_atual as $empresa): ?>
                                    <tr>
                                        <td><?= htmlspecialchars($empresa['empresa']) ?></td>
                                        <td><?= htmlspecialchars($empresa['tributacao']) ?></td>
                                        <td><?= htmlspecialchars($empresa['data_saida_formatada']) ?></td>
                                        <td>
                                            <span class="badge <?= $empresa['dias_restantes'] <= 7 ? 'badge-danger' : ($empresa['dias_restantes'] <= 15 ? 'badge-warning' : 'badge-success') ?>">
                                                <?= $empresa['dias_restantes'] ?> dias
                                            </span>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    <?php else: ?>
                        <div class="empty-message">
                            <i class="fas fa-calendar-times"></i>
                            <p>Nenhuma empresa saindo este mês</p>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <div id="modalEmpresasSaindoFuturo" class="modal-overlay">
            <div class="modal-container">
                <div class="modal-header">
                    <h3 class="modal-title"><i class="fas fa-sign-out-alt"></i> Empresas Saindo - Próximos Meses</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <?php if (!empty($empresas_saindo_futuro)): ?>
                        <table class="modal-table">
                            <thead>
                                <tr>
                                    <th>Empresa</th>
                                    <th>Tributação</th>
                                    <th>Data de Saída</th>
                                    <th>Dias Restantes</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($empresas_saindo_futuro as $empresa): ?>
                                    <tr>
                                        <td><?= htmlspecialchars($empresa['empresa']) ?></td>
                                        <td><?= htmlspecialchars($empresa['tributacao']) ?></td>
                                        <td><?= htmlspecialchars($empresa['data_saida_formatada']) ?></td>
                                        <td>
                                            <span class="badge <?= $empresa['dias_restantes'] <= 30 ? 'badge-warning' : 'badge-success' ?>">
                                                <?= $empresa['dias_restantes'] ?> dias
                                            </span>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    <?php else: ?>
                        <div class="empty-message">
                            <i class="fas fa-calendar-times"></i>
                            <p>Nenhuma empresa saindo nos próximos meses</p>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <header class="header">
    <div>
        <h1>Bem vindo(a), <?= htmlspecialchars($usuario_nome) ?></h1>
    </div>

    <div class="header-right-panel">
        <?php if (in_array($usuario_logado_id, [37, 42])): ?>
            <a href="fiscal_admin.php" class="btn btn-warning" style="font-weight: bold;">
                <i class="fas fa-user-cog"></i> Fiscal Admin
            </a>
        <?php endif; ?>

        <button id="abrir-modal-parcelamento-btn" class="btn btn-primary" style="background-color: #007bff; border-color: #007bff;">
            <i class="fas fa-handshake"></i> Gerar Parcelamento
        </button>

            <a href="tabela_parcelamento.php" class="btn btn-primary">
                <i class="fas fa-file-invoice"></i> Ver Parcelamentos
            </a>

        <?php if ($tipo_conta_logado === 'admin'): ?>
            <a href="painel_lider.php" class="btn btn-info">
                <i class="fas fa-user-shield"></i> Painel Líder
            </a>
            <a href="dashboard.php" class="btn btn-secondary">
                <i class="fas fa-arrow-left"></i> Dashboard
            </a>
        <?php elseif ($tipo_conta_logado === 'lider_fiscal'): ?>
            <a href="painel_lider.php" class="btn btn-secondary">
                <i class="fas fa-arrow-left"></i> Voltar ao Painel
            </a>
        <?php endif; ?>

        <div class="notification-icon">
            <i class="fas fa-bell notifications-btn"></i>
            <div class="notification-badge">0</div>
        </div>

        <div class="header-icon" id="changePasswordBtn" title="Alterar Senha">
            <i class="fas fa-key"></i>
        </div>

        <div class="header-icon" id="logoutBtn" title="Sair do sistema">
            <i class="fas fa-sign-out-alt"></i>
        </div>
    </div>

    <nav class="notifications-nav">
        <h3>Notificações (<span class="notification-count">0</span>)</h3>
        <div class="notifications-list"></div>
    </nav>
</header>

        <div id="passwordModalOverlay" class="modal-overlay">
            <div class="modal-container">
                <div class="modal-header">
                    <h3 class="modal-title">
                        <i class="fas fa-shield-alt"></i>
                        <span>Alterar Senha</span>
                    </h3>
                    <button class="modal-close" id="closePasswordModalBtn">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="changePasswordForm" novalidate>
                        <div class="form-group">
                            <label for="senha_atual">Senha Atual</label>
                            <input type="password" id="senha_atual" name="senha_atual" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label for="nova_senha">Nova Senha</label>
                            <input type="password" id="nova_senha" name="nova_senha" class="form-input" required>
                        </div>
                        <div class="form-group">
                            <label for="confirmar_senha">Confirmar Nova Senha</label>
                            <input type="password" id="confirmar_senha" name="confirmar_senha" class="form-input" required>
                        </div>

                        <div id="modal-message" class="modal-message"></div>

                        <div class="form-actions">
                            <button type="submit" class="btn" id="savePasswordBtn">
                                <i class="fas fa-save"></i>
                                <span class="button-text">Salvar Alterações</span>
                                <i class="fas fa-spinner fa-spin loading-spinner-icon" style="display:none;"></i>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <div class="main-content">

            <div class="detail-card">
                <div class="detail-header">
                    <div>
                        <h4 style="margin:0; color: #333; font-weight: 700;">
                            <i class="fas fa-chart-pie" style="color: var(--primary-color);"></i> Desempenho do Mês
                        </h4>
                        <small class="text-muted">
                            Total: <strong><?= $porcentagem_geral ?>%</strong> concluído (<?= $empresas_100_porcento ?> de <?= count($empresas) ?> empresas finalizadas)
                        </small>
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
                                <span class="<?= ($perc == 100) ? 'text-success' : '' ?>"><?= $perc ?>%</span>
                            </div>

                            <div class="mini-progress">
                                <div class="mini-fill <?= $mini_cor ?>" style="width: <?= $perc ?>%;"></div>
                            </div>

                            <div style="font-size: 0.75rem; color: #777; text-align: right;">
                                <strong><?= $stat['feitos'] ?></strong> entregues / <?= $stat['total'] ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>

            <div class="container-fluid mb-4" style="padding: 0;">
                <h5 class="mb-2">Progresso do Preenchimento</h5>
                <?php
                $cor_barra = 'bg-danger';
                if ($progresso_percentual >= 80) {
                    $cor_barra = '#0BD3C4';
                } elseif ($progresso_percentual <= 51) {
                    $cor_barra = '#9747FF';
                }
                ?>
                <div class="progress" style="height: 30px;">
                    <div class="progress-bar progress-bar-striped progress-bar-animated"
                        role="progressbar"
                        style="width: <?= $progresso_percentual ?>%; background-color: <?= ($progresso_percentual >= 80) ? '#0BD3C4' : (($progresso_percentual <= 51) ? '#9747FF' : '#ffc107') ?>;"
                        aria-valuenow="<?= $progresso_percentual ?>"
                        aria-valuemin="0"
                        aria-valuemax="100">
                        <?= $progresso_percentual ?>%
                    </div>
                </div>
                <small class="text-muted mt-1 d-block">
                    <?= $campos_preenchidos ?> de <?= $total_campos ?> campos preenchidos
                </small>
            </div>

            <div class="stats-container">
                <div class="stats-box" id="btnEmpresasAtivas">
                    <h3><i class="fas fa-building"></i> Empresas Ativas</h3>
                    <div class="stats-numbers"><?= $num_empresas ?> empresas</div>
                    <p>Funcionários: <?= $num_funcionarios ?></p>
                </div>
                <div class="stats-box" id="btnNovasObrigacoes">
                    <h3><i class="fas fa-calendar-plus"></i> Novas Obrigações</h3>
                    <div class="stats-numbers"><?= count($novas_obrigacoes_mes) ?> empresas</div>
                    <p><?= $meses_pt[$mes_selecionado_num] . ' ' . $ano_selecionado ?></p>
                </div>
                <div class="stats-box" id="btnObrigacoesFuturas">
                    <h3><i class="fas fa-calendar-check"></i> Obrigações Futuras</h3>
                    <div class="stats-numbers"><?= count($obrigacoes_futuras) ?> próximas</div>
                    <p>Próximos meses</p>
                </div>
                <div class="stats-box" id="btnEmpresasSaindoMes">
                    <h3><i class="fas fa-sign-out-alt"></i> Empresas Saindo</h3>
                    <div class="stats-numbers"><?= count($empresas_saindo_mes_atual) ?> este mês</div>
                    <p><?= $meses_pt[$mes_atual_num] . ' ' . $ano_atual ?></p>
                </div>
                <div class="stats-box" id="btnEmpresasSaindoFuturo">
                    <h3><i class="fas fa-sign-out-alt"></i> Empresas Saindo</h3>
                    <div class="stats-numbers"><?= count($empresas_saindo_futuro) ?> próximas</div>
                    <p>Próximos meses</p>
                </div>
            </div>

            <div class="search-box">
                <input type="text" placeholder="Pesquisar..." id="search-input">
            </div>

            <div class="filter-buttons">
                <div class="month-selector">
                    <label for="select-mes">Mês:</label>
                    <select id="select-mes" onchange="changeMonth()">
                        <?php foreach ($meses_disponiveis as $mes): ?>
                            <option value="<?= $mes['id'] ?>" data-editavel="<?= $mes['editavel'] ? '1' : '0' ?>" <?= ($mes['id'] == $mes_selecionado) ? 'selected' : '' ?>>
                                <?= str_pad($mes['mes'], 2, '0', STR_PAD_LEFT) . '/' . $mes['ano'] ?>
                                <?= $mes['editavel'] ? ' (editável)' : '' ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <button class="btn" onclick="toggleEditaveis()">
                    <?= $mostrar_editaveis ? 'Mostrar Todos Campos' : 'Mostrar Apenas Editáveis' ?>
                </button>
                <button type="button" class="btn" id="btnAbrirModalCertificados" style="background-color: #6c757d; color: white;">
                    <i class="fas fa-id-card"></i> Info. Certificados
                </button>
            </div>

            <div class="table-container">
                <table class="data-table <?php echo $mostrar_editaveis ? '' : 'show-all'; ?>">
                    <thead>
                        <tr>
                            <th class="sortable filterable-header" data-column="codigo">
                                <span>Código <i class="fas fa-sort sort-icon"></i></span>
                                <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                            </th>
                            <th class="non-editable filterable-header" data-coluna="status_fiscal">
                                <span>Status</span>
                                <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                            </th>
                            <th class="editavel filterable-header" data-coluna="observacoes_fiscal">
                                <span>Observação</span>
                                <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                            </th>
                            <th class="sortable filterable-header" data-column="empresa">
                                <span>Empresa <i class="fas fa-sort sort-icon"></i></span>
                                <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                            </th>
                            <th class="filterable-header">
                                <span>CNPJ</span>
                                <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                            </th>
                       <?php if ($mes_selecionado_num == 5): ?>
    <th class="editavel filterable-header" data-coluna="alteracoes_pasta">
        <span>Alterações Pasta</span>
        <div class="filter-icon-wrapper">
            <i class="fas fa-filter"></i>
        </div>
    </th>
<?php endif; ?>
                            <th class="non-editable filterable-header" data-coluna="grupo">
                                <span>GRUPO</span>
                                <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                            </th>
                            <th class="non-editable">Insc. Estadual</th>
                            <th class="non-editable">Insc. Municipal</th>
                            <th class="non-editable">Login Prefeitura</th>
                            <th class="non-editable">Senha Prefeitura</th>
                            <th class="non-editable">Senha GISS Online</th>
                            <th class="non-editable">Link Prefeitura</th>
                            <th class="non-editable filterable-header">
                                <span>Tributação</span>
                                <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                            </th>
                            <th class="non-editable filterable-header">
                                <span>Tipo</span>
                                <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                            </th>
                            <th class="non-editable filterable-header">
                                <span>Envio</span>
                                <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                            </th>
                            <th class="non-editable filterable-header">
                                <span>Município</span>
                                <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                            </th>

                            <?php if ($is_janeiro): ?>
                                <th class="editavel filterable-header" style="background-color: #e3f2fd; border-bottom: 2px solid #2196f3;">
                                    <span>DASN MEI</span>
                                    <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                                </th>
                                <th class="editavel filterable-header" style="background-color: #e3f2fd; border-bottom: 2px solid #2196f3;">
                                    <span>Taxa Fiscal</span>
                                    <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                                </th>
                            <?php endif; ?>
<?php if ($is_dezembro): ?>
    <th class="editavel filterable-header" data-coluna="distribuicao_dirf">
        <span>Distribuição DIRF</span>
        <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
    </th>
<?php endif; ?>
<?php if ($is_setembro_2026): ?>
    <th class="editavel filterable-header" data-coluna="api_jettax">
        <span>API JETTAX</span>
        <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
    </th>
<?php endif; ?>
                            <th class="editavel filterable-header" data-coluna="carne_leao">
                                <span>Carne Leão</span>
                                <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                            </th>
                            <th class="editavel filterable-header" data-coluna="reinf">
                                <span>REINF</span>
                                <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                            </th>
                            <th class="editavel filterable-header" data-coluna="impostos">
                                <span>IMPOSTOS</span>
                                <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                            </th>
                            <th class="editavel filterable-header" data-coluna="iss">
                                <span>ISS</span>
                                <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                            </th>
                            <th class="editavel filterable-header" data-coluna="mit">
                                <span>MIT</span>
                                <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                            </th>
                            <th class="editavel filterable-header" data-coluna="sped_fiscal">
                                <span>Sped Fiscal</span>
                                <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                            </th>
                            <th class="editavel filterable-header" data-coluna="sped_contribuicao">
                                <span>Sped Contrib.</span>
                                <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                            </th>
                            <th class="editavel filterable-header" data-coluna="destda">
                                <span>Destda</span>
                                <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                            </th>

                            <?php if ($exibir_gia): ?>
                                <th class="editavel filterable-header" data-coluna="gia">
                                    <span>GIA</span>
                                    <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                                </th>
                            <?php endif; ?>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($empresas as $empresa): ?>
                            <tr data-id="<?php echo $empresa['id']; ?>">
                                <td><?php echo htmlspecialchars($empresa['codigo']); ?></td>
                                <td class="non-editable"><?php echo htmlspecialchars($empresa['status_fiscal'] ?? ''); ?></td>
                                <td class="editavel" contenteditable="true" data-coluna="observacoes_fiscal"><?php echo htmlspecialchars($empresa['observacoes_fiscal'] ?? ''); ?></td>
                                <td><?php echo htmlspecialchars($empresa['empresa']); ?></td>
                                <td><?php echo htmlspecialchars($empresa['cnpj']); ?></td>
                       <?php if ($mes_selecionado_num == 5): ?>
<td class="editavel" data-coluna="alteracoes_pasta">
    <select class="form-select form-select-sm salvar-select"
            data-coluna="alteracoes_pasta"
            data-id="<?= $empresa['id'] ?>">
        <option value="Pendente" <?= ($empresa['alteracoes_pasta'] ?? 'Pendente') == 'Pendente' ? 'selected' : '' ?>>
            Pendente
        </option>
        <option value="Concluído" <?= ($empresa['alteracoes_pasta'] ?? '') == 'Concluído' ? 'selected' : '' ?>>
            Concluído
        </option>
    </select>
</td>
<?php endif; ?>
                                <td class="non-editable"><?php echo htmlspecialchars($empresa['grupo'] ?? ''); ?></td>
                                <td class="non-editable"><?php echo htmlspecialchars($empresa['insc_estadual'] ?? ''); ?></td>
                                <td class="non-editable"><?php echo htmlspecialchars($empresa['insc_municipal'] ?? ''); ?></td>
                                <td class="non-editable"><?php echo htmlspecialchars($empresa['login_prefeitura'] ?? ''); ?></td>
                                <td class="non-editable"><?php echo htmlspecialchars($empresa['senha_prefeitura_ginfes'] ?? ''); ?></td>
                                <td class="non-editable"><?php echo htmlspecialchars($empresa['senha_giss_online'] ?? ''); ?></td>
                                <td class="non-editable">
                                    <?php if (!empty($empresa['link_prefeitura'])): ?>
                                        <a href="<?php echo htmlspecialchars($empresa['link_prefeitura']); ?>" target="_blank" rel="noopener noreferrer" class="table-link">
                                            <?php echo htmlspecialchars($empresa['link_prefeitura']); ?>
                                        </a>
                                    <?php endif; ?>
                                </td>
                                <td class="non-editable"><?php echo htmlspecialchars($empresa['tributacao'] ?? ''); ?></td>
                                <td class="non-editable"><?php echo htmlspecialchars($empresa['tipo'] ?? ''); ?></td>
                                <td class="non-editable"><?php echo htmlspecialchars($empresa['envio'] ?? ''); ?></td>
                                <td class="non-editable"><?php echo htmlspecialchars($empresa['municipio'] ?? ''); ?></td>
                                <?php if ($is_janeiro): ?>
                                    <?php
                                    // Normaliza o texto para evitar problemas com maiúsculas/minúsculas
                                    $trib = mb_strtolower(trim($empresa['tributacao'] ?? ''));
                                    $isMei = (strpos($trib, 'mei') !== false);
                                    $isSimples = (strpos($trib, 'simples') !== false || strpos($trib, 'nacional') !== false);

                                    // 1. Lógica DASN MEI: Apenas MEI pode editar
                                    if ($isMei) {
                                        echo '<td class="editavel" contenteditable="true" data-coluna="dasnmei">' . htmlspecialchars($empresa['dasnmei'] ?? '') . '</td>';
                                    } else {
                                        echo '<td class="nao-aplicavel" style="background-color: #f0f0f0; color: #999; font-style: italic; cursor: not-allowed;">N/A</td>';
                                    }

                                    // 2. Lógica Taxa Fiscal: Todas MENOS Mei e Simples
                                    if (!$isMei && !$isSimples) {
                                        echo '<td class="editavel" contenteditable="true" data-coluna="taxa_fiscal">' . htmlspecialchars($empresa['taxa_fiscal'] ?? '') . '</td>';
                                    } else {
                                        echo '<td class="nao-aplicavel" style="background-color: #f0f0f0; color: #999; font-style: italic; cursor: not-allowed;">N/A</td>';
                                    }
                                    ?>
                                <?php endif; ?>
<?php if ($is_dezembro): ?>
    <td class="editavel" contenteditable="true" data-coluna="distribuicao_dirf">
                        <?= htmlspecialchars($empresa['distribuicao_dirf'] ?? ''); ?>
    </td>
<?php endif; ?>
<?php if ($is_setembro_2026): ?>
    <td class="editavel" contenteditable="true" data-coluna="api_jettax">
        <?= htmlspecialchars($empresa['api_jettax'] ?? ''); ?>
    </td>
<?php endif; ?>

                                    <?php
                                    $statusCarneLeao = trim(
                                        $empresa['carne_leao'] ?? ''
                                    );
                                    ?>

                                    <td
                                        class="carne-leao-trigger text-center"
                                        data-coluna="carne_leao"
                                        style="cursor: pointer;"
                                        title="Clique para atualizar o Carnê-Leão"
                                    >
                                        <?php if (
                                            $statusCarneLeao === 'Preenchido' ||
                                            strpos($statusCarneLeao, 'OK') === 0
                                        ): ?>

                                            <span class="badge badge-ok">
                                                <?= htmlspecialchars($statusCarneLeao) ?>
                                            </span>

                                        <?php elseif (
                                            $statusCarneLeao === 'N/A'
                                        ): ?>

                                            <span class="badge badge-na">
                                                N/A
                                            </span>

                                        <?php elseif (
                                            strpos($statusCarneLeao, 'Pendência') === 0 ||
                                            strpos($statusCarneLeao, 'Pendente (') === 0
                                        ): ?>

                                            <span
                                                class="badge badge-pendencia"
                                                title="<?= htmlspecialchars($statusCarneLeao) ?>"
                                            >
                                                <?= htmlspecialchars($statusCarneLeao) ?>
                                            </span>

                                        <?php else: ?>

                                            <span class="badge bg-secondary">
                                                Pendente
                                            </span>

                                        <?php endif; ?>
                                    </td>

                                <td class="reinf-trigger text-center" data-coluna="reinf" style="cursor: pointer;">
                                    <?php
                                    $statusReinf = htmlspecialchars($empresa['reinf'] ?? '');

                                    // Verifica se começa com 'OK' (ex: OK - 15/01/2026) ou se é o antigo 'Preenchido'
                                    if ($statusReinf === 'Preenchido' || strpos($statusReinf, 'OK') === 0) {
                                        // Se for OK - Data, mostra o texto todo. Se for só Preenchido, mostra Preenchido.
                                        echo '<span class="badge badge-ok">' . $statusReinf . '</span>';
                                    }
                                    // Verifica N/A
                                    elseif ($statusReinf === 'N/A') {
                                        echo '<span class="badge badge-na">N/A</span>';
                                    }
                                    // Verifica Pendência (ex: Pendência - João)
                                    elseif (strpos($statusReinf, 'Pendência') === 0) {
                                        // Mostra apenas a palavra "Pendência" na tabela, mas o nome fica no "title" (mouse em cima)
                                        echo '<span class="badge badge-pendencia" title="' . $statusReinf . '">Pendência</span>';
                                    }
                                    // Caso contrário (vazio ou null)
                                    else {
                                        echo '<span class="badge bg-secondary">Pendente</span>';
                                    }
                                    ?>
                                </td>
                                <td class="impostos-trigger text-center" data-coluna="impostos" style="cursor: pointer;">
                                    <?php
                                    $statusImp = htmlspecialchars($empresa['impostos'] ?? '');

                                    // Verifica OK / Preenchido
                                    if ($statusImp === 'Preenchido' || strpos($statusImp, 'OK') === 0) {
                                        echo '<span class="badge badge-ok">' . $statusImp . '</span>';
                                    }
                                    // Verifica N/A
                                    elseif ($statusImp === 'N/A') {
                                        echo '<span class="badge badge-na">N/A</span>';
                                    }
                                    // Verifica Pendência
                                    elseif (strpos($statusImp, 'Pendência') === 0) {
                                        echo '<span class="badge badge-pendencia" title="' . $statusImp . '">Pendência</span>';
                                    }
                                    // Padrão
                                    else {
                                        echo '<span class="badge bg-secondary">Pendente</span>';
                                    }
                                    ?>
                                </td>
                                <td class="generic-modal-trigger text-center" data-coluna="iss" data-titulo="ISS" style="cursor: pointer;">
                                    <?php renderizarBadge($empresa['iss']); ?>
                                </td>

                                <td class="generic-modal-trigger text-center" data-coluna="mit" data-titulo="MIT" style="cursor: pointer;">
                                    <?php renderizarBadge($empresa['mit']); ?>
                                </td>

                                <td class="generic-modal-trigger text-center" data-coluna="sped_fiscal" data-titulo="Sped Fiscal" style="cursor: pointer;">
                                    <?php renderizarBadge($empresa['sped_fiscal']); ?>
                                </td>

                                <?php if ($is_dezembro): ?>
                                    <td class="sped-anual-trigger text-center" data-coluna="sped_contribuicao" style="cursor: pointer;">
                                        <?php
                                        $valSped = htmlspecialchars($empresa['sped_contribuicao'] ?? '');
                                        if (strpos($valSped, 'OK') === 0) echo '<span class="badge badge-ok">' . $valSped . '</span>';
                                        else echo '<span class="badge bg-warning text-dark">' . ($valSped ?: 'Pendente') . '</span>';
                                        ?>
                                    </td>
                                <?php else: ?>
                                    <td class="generic-modal-trigger text-center" data-coluna="sped_contribuicao" data-titulo="Sped Contribuição" style="cursor: pointer;">
                                        <?php renderizarBadge($empresa['sped_contribuicao']); ?>
                                    </td>
                                <?php endif; ?>

                                <td class="generic-modal-trigger text-center" data-coluna="destda" data-titulo="Destda" style="cursor: pointer;">
                                    <?php renderizarBadge($empresa['destda']); ?>
                                </td>
                                <?php if ($exibir_gia): ?>
                                    <td class="editavel" contenteditable="true" data-coluna="gia"><?php echo htmlspecialchars($empresa['gia'] ?? ''); ?></td>
                                <?php endif; ?>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <div id="modalSpedAnual" class="modal-overlay">
                <div class="modal-container" style="width: 500px;">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="fas fa-calendar-check"></i> Sped Contrib. (Anual)</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="formSpedAnual">
                            <input type="hidden" id="sped_anual_id" name="id_controle">
                            <input type="hidden" id="sped_anual_status_forced" name="status_forced" value="">

                            <div class="mb-3 d-flex justify-content-between align-items-center">
                                <span class="text-dark fw-bold">Meses entregues:</span>
                                <button type="button" class="btn btn-sm btn-outline-primary" id="btnMarcarTodosSped">
                                    <i class="fas fa-check-double"></i> Marcar/Desmarcar Todos
                                </button>
                            </div>

                            <div class="row g-2">
                                <?php
                                $meses_nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
                                foreach ($meses_nomes as $idx => $nome): ?>
                                    <div class="col-6">
                                        <div class="mes-card-item" onclick="document.getElementById('check_mes_<?= $idx ?>').click()">
                                            <input class="form-check-input check-mes-sped"
                                                type="checkbox"
                                                name="meses[]"
                                                value="<?= $idx + 1 ?>"
                                                id="check_mes_<?= $idx ?>"
                                                style="margin-right: 10px;"
                                                onclick="event.stopPropagation()">

                                            <label class="form-check-label w-100"
                                                for="check_mes_<?= $idx ?>"
                                                style="cursor:pointer; margin:0;">
                                                <?= $nome ?>
                                            </label>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            </div>

                            <div class="d-flex justify-content-between gap-2 mt-4">
                                <button type="button" class="btn btn-warning text-white btn-sm w-100" id="btnSpedAnualNA">
                                    <i class="fas fa-ban"></i> N/A
                                </button>

                                <button type="button" class="btn btn-danger btn-sm w-100" id="btnSpedAnualPendencia">
                                    <i class="fas fa-exclamation-circle"></i> Pendência
                                </button>

                                <button type="submit" class="btn btn-success btn-sm w-100 fw-bold">
                                    <i class="fas fa-save"></i> Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            <div id="modalDetalhesReinf" class="modal-overlay">
                <div class="modal-container" style="width: 500px;">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="fas fa-list-alt"></i> Detalhes REINF</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="reinf_msg_status" class="alert alert-warning py-1 small mb-2" style="display:none; font-weight:bold;"></div>

                        <form id="formReinfDetalhes">
                            <input type="hidden" id="reinf_id_controle" name="id_controle">
                            <input type="hidden" id="reinf_status_forced" name="status_forced" value="">

                            <div class="row g-2">
                                <div class="col-6 mb-2">
                                    <label class="form-label small">IRRF 1708</label>
                                    <input type="text" class="form-control form-control-sm check-full-reinf" name="irrf_1708" id="reinf_irrf_1708" placeholder="Ex: 100,00 ou S/ Mov">
                                </div>
                                <div class="col-6 mb-2">
                                    <label class="form-label small">CRF 5952</label>
                                    <input type="text" class="form-control form-control-sm check-full-reinf" name="crf_5952" id="reinf_crf_5952">
                                </div>
                                <div class="col-6 mb-2">
                                    <label class="form-label small">INSS Prestados</label>
                                    <input type="text" class="form-control form-control-sm check-full-reinf" name="inss_prestados" id="reinf_inss_prestados">
                                </div>
                                <div class="col-6 mb-2">
                                    <label class="form-label small">INSS Tomados</label>
                                    <input type="text" class="form-control form-control-sm check-full-reinf" name="inss_tomados" id="reinf_inss_tomados">
                                </div>
                                <div class="col-6 mb-2">
                                    <label class="form-label small">Desoneração</label>
                                    <input type="text" class="form-control form-control-sm check-full-reinf" name="desoneracao" id="reinf_desoneracao">
                                </div>
                                <div class="col-6 mb-2">
                                    <label class="form-label small">IRRF 3208</label>
                                    <input type="text" class="form-control form-control-sm check-full-reinf" name="irrf_3208" id="reinf_irrf_3208">
                                </div>
                                <div class="col-12 mb-3">
                                    <label class="form-label small">Outros (Opcional)</label>
                                    <input type="text" class="form-control form-control-sm" name="outros" id="reinf_outros">
                                </div>
                            </div>

                            <div class="d-flex justify-content-between gap-2 mt-3">
                                <button type="button" class="btn btn-warning text-white btn-sm w-100" id="btnReinfNA">
                                    <i class="fas fa-ban"></i> N/A
                                </button>
                                <button type="button" class="btn btn-danger btn-sm w-100" id="btnReinfPendencia">
                                    <i class="fas fa-exclamation-circle"></i> Pendência
                                </button>
                                <button type="button" class="btn btn-success btn-sm w-100" id="btnReinfOkSemMovimento">
                                    <i class="fas fa-check"></i> OK - SEM MOVIMENTO
                                </button>
                                <button type="submit" class="btn btn-success btn-sm w-100">
                                    <i class="fas fa-save"></i> Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <div id="modalDetalhesCarneLeao" class="modal-overlay">
                <div class="modal-container" style="width: 500px;">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="fas fa-list-alt"></i> Detalhes Carnê Leão</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="carne_leao_msg_status" class="alert alert-warning py-1 small mb-2" style="display:none; font-weight:bold;"></div>

                        <form id="formCarneLeaoDetalhes">
                            <input type="hidden" id="carne_leao_id_controle" name="id_controle">
                            <input type="hidden" id="carne_leao_status_forced" name="status_forced" value="">

                            <div class="row g-2">
                                <div class="col-6 mb-2">
                                    <label class="form-label small">Recibo Saúde</label>
                                    <input type="text" class="form-control form-control-sm check-full-carne-leao" name="recibo_saude" id="carne_leao_recibo_saude" placeholder="Ex: 100,00 ou S/ Mov">
                                </div>
                                <div class="col-6 mb-2">
                                    <label class="form-label small">Receitas Diversas</label>
                                    <input type="text" class="form-control form-control-sm check-full-carne-leao" name="receitas_diversas" id="carne_leao_receitas_diversas">
                                </div>
                                <div class="col-6 mb-2">
                                    <label class="form-label small">Despesas Dedutíveis</label>
                                    <input type="text" class="form-control form-control-sm check-full-carne-leao" name="despesas_dedutiveis" id="carne_leao_despesas_dedutiveis">
                                </div>
                                <div class="col-6 mb-2">
                                    <label class="form-label small">INSS</label>
                                    <input type="text" class="form-control form-control-sm check-full-carne-leao" name="inss" id="carne_leao_inss">
                                </div>
                                <div class="col-6 mb-2">
                                    <label class="form-label small">ISS</label>
                                    <input type="text" class="form-control form-control-sm check-full-carne-leao" name="iss" id="carne_leao_iss">
                                </div>
                                <div class="col-6 mb-2">
                                    <label class="form-label small">IRRF</label>
                                    <input type="text" class="form-control form-control-sm check-full-carne-leao" name="irrf" id="carne_leao_irrf">
                                </div>
                            </div>

                            <div class="d-flex justify-content-between gap-2 mt-3">
                                <button type="button" class="btn btn-warning text-white btn-sm w-100" id="btnCarneLeaoNA">
                                    <i class="fas fa-ban"></i> N/A
                                </button>
                                <button type="button" class="btn btn-danger btn-sm w-100" id="btnCarneLeaoPendencia">
                                    <i class="fas fa-exclamation-circle"></i> Pendência
                                </button>
                                <button type="button" class="btn btn-success btn-sm w-100" id="btnCarneLeaoOkSemMovimento">
                                    <i class="fas fa-check"></i> OK - SEM MOVIMENTO
                                </button>
                                <button type="submit" class="btn btn-success btn-sm w-100">
                                    <i class="fas fa-save"></i> Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <div id="modalDetalhesImpostos" class="modal-overlay">
                <div class="modal-container" style="width: 500px;">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="fas fa-file-invoice-dollar"></i> Detalhes Impostos</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="imp_msg_status" class="alert alert-warning py-1 small mb-2" style="display:none; font-weight:bold;"></div>

                        <form id="formImpostosDetalhes">
                            <input type="hidden" id="impostos_id_controle" name="id_controle">
                            <input type="hidden" id="impostos_status_forced" name="status_forced" value="">

                            <div class="row g-2">
                                <div class="col-6 mb-2">
                                    <label class="form-label small">Faturamento</label>
                                    <input type="text" class="form-control form-control-sm check-full-imp" name="faturamento" id="imp_faturamento">
                                </div>
                                <div class="col-6 mb-2">
                                    <label class="form-label small">ISS Prestados</label>
                                    <input type="text" class="form-control form-control-sm check-full-imp" name="iss_prestados" id="imp_iss_prestados">
                                </div>
                                <div class="col-6 mb-2">
                                    <label class="form-label small">ISS Tomados</label>
                                    <input type="text" class="form-control form-control-sm check-full-imp" name="iss_tomados" id="imp_iss_tomados">
                                </div>
                                <div class="col-6 mb-2">
                                    <label class="form-label small">DAS</label>
                                    <input type="text" class="form-control form-control-sm check-full-imp" name="das" id="imp_das">
                                </div>
                                <div class="col-6 mb-2">
                                    <label class="form-label small">DARF PIS/COFINS</label>
                                    <input type="text" class="form-control form-control-sm check-full-imp" name="darf_pis_cofins" id="imp_darf_pis_cofins">
                                </div>
                                <div class="col-6 mb-2">
                                    <label class="form-label small">DARF IRPJ/CSLL</label>
                                    <input type="text" class="form-control form-control-sm check-full-imp" name="darf_irpj_csll" id="imp_darf_irpj_csll">
                                </div>
                                <div class="col-6 mb-2">
                                    <label class="form-label small">ICMS</label>
                                    <input type="text" class="form-control form-control-sm check-full-imp" name="icms" id="imp_icms" placeholder="Obrigatório">
                                </div>
                                <div class="col-12 mb-2">
                                    <label class="form-label small">Outros (Opcional)</label>
                                    <input type="text" class="form-control form-control-sm" name="outros" id="imp_outros" placeholder="Opcional">
                                </div>
                            </div>

                            <div class="d-flex justify-content-between gap-2 mt-3">
                                <button type="button" class="btn btn-warning text-white btn-sm w-100" id="btnImpostosNA">
                                    <i class="fas fa-ban"></i> N/A
                                </button>
                                <button type="button" class="btn btn-danger btn-sm w-100" id="btnImpostosPendencia">
                                    <i class="fas fa-exclamation-circle"></i> Pendência
                                </button>
                                <button type="button" class="btn btn-success btn-sm w-100" id="btnImpostosOkSemMovimento">
                                    <i class="fas fa-check"></i> OK - SEM MOVIMENTO
                                </button>
                                <button type="submit" class="btn btn-success btn-sm w-100">
                                    <i class="fas fa-save"></i> Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            <div class="theme-toggle" id="themeToggle">
                <i class="fas fa-moon"></i>
            </div>
            <div id="modalGenericStatus" class="modal-overlay">
                <div class="modal-container" style="width: 400px;">
                    <div class="modal-header">
                        <h3 class="modal-title" id="genericModalTitle">Atualizar Status</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p class="text-muted mb-3">Selecione o novo status:</p>

                        <input type="hidden" id="generic_id_controle">
                        <input type="hidden" id="generic_coluna">

                        <div class="d-grid gap-2">
                            <button type="button" class="btn btn-warning text-white" onclick="salvarStatusGenerico('N/A')">
                                <i class="fas fa-ban"></i> N/A
                            </button>

                            <button type="button" class="btn btn-success" onclick="salvarStatusGenerico('OK - SEM MOVIMENTO')">
                                <i class="fas fa-check"></i> OK - SEM MOVIMENTO
                            </button>

                            <button type="button" class="btn btn-success" id="btnGenericData">
                                <i class="fas fa-calendar-alt"></i> OK - DATA
                            </button>

                            <button type="button" class="btn btn-danger" id="btnGenericPendencia">
                                <i class="fas fa-exclamation-circle"></i> PENDÊNCIA
                            </button>

                            <button type="button" class="btn btn-secondary" onclick="salvarStatusGenerico('')">
                                <i class="fas fa-eraser"></i> LIMPAR / PENDENTE
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal de confirmação OK - SEM MOVIMENTO -->
            <div id="confirmOkSemMovimentoModal" class="modal-overlay" style="z-index: 9999;">
                <div class="modal-container" style="width:400px;">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="fas fa-check"></i> Confirmar</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p class="confirm-message">Confirma <strong>OK - SEM MOVIMENTO</strong> para este item?</p>
                        
                        <div class="mt-3">
                            <label class="form-label small fw-bold text-secondary">Foi enviado via API?</label>
                            <select id="selectApiOkSemMovimento" class="form-select form-select-sm">
                                <option value="S/API">Não (S/API)</option>
                                <option value="API">Sim (API)</option>
                            </select>
                        </div>

                        <div class="d-flex gap-2 mt-3">
                            <button type="button" id="confirmOkSemMovimentoBtn" class="btn btn-success btn-sm">Confirmar</button>
                            <button type="button" id="cancelOkSemMovimentoBtn" class="btn btn-secondary btn-sm">Cancelar</button>
                        </div>
                    </div>
                </div>
            </div>
            <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
            <script>
                $(document).ready(function() {
                    // =================================================================
                    // LÓGICA DE FILTRO AVANÇADA (CORRIGIDA PARA TER SCROLL)
                    // =================================================================
                    const activeFilters = {};

                    $('.filterable-header .filter-icon-wrapper').on('click', function(e) {
                        e.stopPropagation();
                        const icon = $(this);
                        const header = icon.closest('th');
                        const colIndex = header.index();

                        // 1. Remove qualquer menu aberto anteriormente
                        $('.filter-dropdown').remove();

                        // 2. Se o ícone clicado já estava com menu aberto, apenas fecha e retorna
                        if (icon.hasClass('menu-open')) {
                            icon.removeClass('menu-open');
                            return;
                        }

                        // Marca este ícone como aberto
                        $('.filter-icon-wrapper').removeClass('menu-open');
                        icon.addClass('menu-open');

                        // 3. CRIA O MENU DIRETO NO BODY (Isso conserta o corte e o scroll)
                        const loadingMenu = $('<div class="filter-dropdown" style="padding:15px; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>');
                        $('body').append(loadingMenu);

                        // 4. Calcula a posição para ficar embaixo do ícone
                        const iconRect = icon[0].getBoundingClientRect();
                        const menuWidth = 250;

                        let leftPos = iconRect.left;
                        let topPos = iconRect.bottom + window.scrollY + 5;

                        // Se o menu for sair da tela pela direita, alinha pela direita do ícone
                        if (leftPos + menuWidth > $(window).width()) {
                            leftPos = iconRect.right - menuWidth;
                        }

                        loadingMenu.css({
                            top: topPos + 'px',
                            left: leftPos + 'px',
                            display: 'block'
                        });

                        // 5. Carrega os dados
                        setTimeout(() => {
                            const uniqueValues = new Set();

                            $('.data-table tbody tr').each(function() {
                                const row = $(this);
                                // Pega texto simples ou valor do select
                                let cell = row.find(`td:eq(${colIndex})`);
                                let cellValue = '';

                                if (cell.find('select').length > 0) {
                                    cellValue = cell.find('select option:selected').text().trim();
                                } else {
                                    cellValue = cell.text().trim();
                                }

                                if (!cellValue) cellValue = "(Vazio)";
                                uniqueValues.add(cellValue);
                            });

                            const sortedValues = Array.from(uniqueValues).sort((a, b) => a.localeCompare(b, 'pt-BR'));

                            // Monta o HTML do Menu
                            let html = `
                        <div class="filter-header-area">
                            <input type="text" class="filter-dropdown-search" placeholder="Pesquisar..." autofocus>
                            <label class="filter-select-all-label">
                                <input type="checkbox" class="check-all-filters" checked> (Selecionar Tudo)
                            </label>
                        </div>
                        <div class="filter-dropdown-options">
                    `;

                            const blacklist = activeFilters[colIndex] || [];
                            sortedValues.forEach(val => {
                                const isChecked = blacklist.includes(val) ? '' : 'checked';
                                const safeVal = val.replace(/"/g, '&quot;');
                                // Adicionado title para ler textos cortados
                                html += `<label title="${safeVal}"><input type="checkbox" class="filter-option" value="${safeVal}" ${isChecked}> ${val}</label>`;
                            });

                            html += `</div>
                        <div class="filter-footer-area">
                            <button type="button" class="btn-filter-action btn-filter-clear">Limpar</button>
                            <button type="button" class="btn-filter-action btn-filter-apply">Aplicar</button>
                        </div>`;

                            loadingMenu.html(html);

                            // --- FORÇAR SCROLL VIA JS (GARANTIA FINAL) ---
                            loadingMenu.find('.filter-dropdown-options').css({
                                'max-height': '200px',
                                'overflow-y': 'auto',
                                'display': 'block'
                            });

                            atualizarSelectAllStatus(loadingMenu);

                            // --- EVENTOS DO MENU ---

                            // Busca
                            loadingMenu.find('.filter-dropdown-search').on('keyup', function(e) {
                                e.stopPropagation();
                                const term = $(this).val().toLowerCase();
                                loadingMenu.find('.filter-dropdown-options label').each(function() {
                                    const text = $(this).text().toLowerCase();
                                    $(this).toggle(text.indexOf(term) > -1);
                                });
                            });

                            // Selecionar Tudo
                            loadingMenu.find('.check-all-filters').on('change', function(e) {
                                e.stopPropagation();
                                const isChecked = $(this).is(':checked');
                                loadingMenu.find('.filter-dropdown-options label:visible input').prop('checked', isChecked);
                            });

                            // Checkbox individual
                            loadingMenu.find('.filter-option').on('change', function(e) {
                                e.stopPropagation();
                                atualizarSelectAllStatus(loadingMenu);
                            });

                            // Botão Aplicar
                            loadingMenu.find('.btn-filter-apply').on('click', function(e) {
                                e.stopPropagation();
                                const uncheckedValues = [];
                                loadingMenu.find('.filter-option:not(:checked)').each(function() {
                                    uncheckedValues.push($(this).val());
                                });

                                if (uncheckedValues.length > 0) {
                                    activeFilters[colIndex] = uncheckedValues;
                                    icon.addClass('active').css('color', '#007bff');
                                } else {
                                    delete activeFilters[colIndex];
                                    icon.removeClass('active').css('color', '');
                                }
                                aplicarFiltrosNaTabela();
                                loadingMenu.remove();
                                icon.removeClass('menu-open');
                            });

                            // Botão Limpar
                            loadingMenu.find('.btn-filter-clear').on('click', function(e) {
                                e.stopPropagation();
                                delete activeFilters[colIndex];
                                icon.removeClass('active').css('color', '');
                                aplicarFiltrosNaTabela();
                                loadingMenu.remove();
                                icon.removeClass('menu-open');
                            });

                            // Impede fechar ao clicar dentro do menu (crucial para o scroll funcionar)
                            loadingMenu.on('click', function(e) {
                                e.stopPropagation();
                            });

                            // Impede propagação do scroll do menu para a página (para não rolar a página junto)
                            loadingMenu.find('.filter-dropdown-options').on('wheel', function(e) {
                                e.stopPropagation();
                            });

                        }, 10);
                    });

                    // Fecha o menu ao clicar fora (no resto da página)
                    $(document).on('click', function() {
                        $('.filter-dropdown').remove();
                        $('.filter-icon-wrapper').removeClass('menu-open');
                    });

                    // Fecha se rolar a página (para o menu não ficar flutuando solto)
                    $(window).on('scroll resize', function() {
                        if ($('.filter-dropdown').is(':visible')) {
                            $('.filter-dropdown').remove();
                            $('.filter-icon-wrapper').removeClass('menu-open');
                        }
                    });

                    function aplicarFiltrosNaTabela() {
                        $('.data-table tbody tr').each(function() {
                            const row = $(this);
                            let shouldShow = true;
                            for (const [colIdx, blacklistedValues] of Object.entries(activeFilters)) {
                                let cellValue = row.find(`td:eq(${colIdx})`).text().trim();
                                if (!cellValue) cellValue = "(Vazio)";
                                if (blacklistedValues.includes(cellValue)) {
                                    shouldShow = false;
                                    break;
                                }
                            }
                            row.toggle(shouldShow);
                        });
                    }

                    function atualizarSelectAllStatus(dropdown) {
                        const visibleOptions = dropdown.find('.filter-dropdown-options label:visible input');
                        const totalChecked = visibleOptions.filter(':checked').length;
                        dropdown.find('.check-all-filters').prop('checked', visibleOptions.length > 0 && visibleOptions.length === totalChecked);
                    }

                    $(document).on('click', function() {
                        $('.filter-dropdown').remove();
                    });
                    // Função auxiliar para data atual
                    function getDataAtualFormatada() {
                        const hoje = new Date();
                        const dia = String(hoje.getDate()).padStart(2, '0');
                        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
                        const ano = hoje.getFullYear();
                        return `${dia}/${mes}/${ano}`;
                    }

                    // --- FUNÇÃO MÁGICA: Atualiza a cor sem recarregar a página ---
                    function atualizarVisualCelula(cell, status) {
                        let htmlBadge = '';
                        if (!status || status === 'Pendente' || status === '') {
                            htmlBadge = '<span class="badge bg-secondary">Pendente</span>';
                        } else if (status === 'N/A') {
                            htmlBadge = '<span class="badge badge-na">N/A</span>';
                        } else if (status.indexOf('Pendência') === 0) {
                            htmlBadge = `<span class="badge badge-pendencia" title="${status}">Pendência</span>`;
                        } else if (status.indexOf('OK') === 0 || status === 'Preenchido') {
                            htmlBadge = `<span class="badge badge-ok">${status}</span>`;
                        } else {
                            htmlBadge = `<span class="badge bg-info text-dark">${status}</span>`;
                        }
                        cell.html(htmlBadge);
                    }

                    // --- ABRIR MODAL GENÉRICO (delegated) ---
                    $('.data-table').on('click', '.generic-modal-trigger', function() {
                        // Verifica permissão via PHP
                        const edicaoLiberada = <?= $edicao_liberada ? 'true' : 'false' ?>;

                        if (!edicaoLiberada) {
                            alert('Mês fechado para edições.');
                            return;
                        }

                        const cell = $(this);
                        $('#generic_id_controle').val(cell.closest('tr').data('id'));
                        $('#generic_coluna').val(cell.data('coluna'));
                        $('#genericModalTitle').html('<i class="fas fa-edit"></i> ' + cell.data('titulo'));
                        $('#modalGenericStatus').addClass('active');
                    });

                    // --- SALVAR NO BANCO E ATUALIZAR TELA ---
                    window.salvarStatusGenerico = function(statusTexto) {
                        const id = $('#generic_id_controle').val();
                        const coluna = $('#generic_coluna').val();

                        if ((coluna === 'mit' || coluna === 'reinf' || coluna === 'impostos') && statusTexto.indexOf('OK') === 0) {
                            let isApi = confirm("Foi enviado via API?\n\n[OK] = Sim, API\n[Cancelar] = Não, S/API");
                            statusTexto += isApi ? " - API" : " - S/API";
                        }

                        $.ajax({
                            url: 'salvar_alteracao_fiscal.php', // Arquivo do operador
                            method: 'POST',
                            data: {
                                id: id,
                                coluna: coluna,
                                valor: statusTexto
                            },
                            dataType: 'json',
                            success: function(res) {
                                if (res.success || res === true || res === '1') {
                                    $('#modalGenericStatus').removeClass('active');

                                    // AQUI ESTÁ A MUDANÇA: Atualiza visualmente sem F5
                                    const cell = $(`.data-table tr[data-id="${id}"] td[data-coluna="${coluna}"]`);
                                    atualizarVisualCelula(cell, statusTexto);
                                } else {
                                    alert('Erro ao salvar.');
                                }
                            },
                            error: function() {
                                alert('Erro de comunicação.');
                            }
                        });
                    };

                    $('#btnGenericData').on('click', function() {
                        let dataInput = prompt("Informe a data:", getDataAtualFormatada());
                        if (dataInput) salvarStatusGenerico("OK - " + dataInput);
                    });

                    $('#btnGenericPendencia').on('click', function() {
                        let responsavel = prompt("Motivo:");
                        if (responsavel) salvarStatusGenerico("Pendência - " + responsavel);
                    });

                    // Fecha qualquer modal
                    $('.modal-close').click(function() {
                        $(this).closest('.modal-overlay').removeClass('active');
                    });
                });
            </script>
            <script>
                function atualizarVisualCards() {
                    $('.check-mes-sped').each(function() {
                        if ($(this).is(':checked')) {
                            $(this).closest('.mes-card-item').addClass('active');
                        } else {
                            $(this).closest('.mes-card-item').removeClass('active');
                        }
                    });
                }

                // =================================================================
                // LÓGICA DO SPED ANUAL (CORRIGIDA E BLINDADA)
                // =================================================================

                // 1. Abrir Modal e CARREGAR O ID
                $('.data-table').on('click', '.sped-anual-trigger', function() {
                    const row = $(this).closest('tr');
                    const id = row.data('id'); // Pega o ID da linha

                    // Debug no Console (Aperte F12 para ver se aparece o número)
                    console.log("Abrindo modal para Empresa ID:", id);

                    if (!id) {
                        alert("Erro: Não foi possível identificar o ID da empresa nesta linha. Verifique o HTML.");
                        return;
                    }

                    $('#modalSpedAnual').addClass('active');

                    // GARANTE QUE O ID SEJA INSERIDO NO INPUT OCULTO
                    $('#sped_anual_id').val(id);
                    $('#sped_anual_status_forced').val(''); // Reseta status forçado

                    // Reseta visual (desmarca tudo)
                    $('.check-mes-sped').prop('checked', false);
                    $('.mes-card-item').removeClass('active');

                    // Carrega dados do servidor
                    $.ajax({
                        url: 'assets/backend/obter_detalhes_sped_anual.php',
                        data: {
                            id: id
                        },
                        dataType: 'json',
                        cache: false,
                        success: function(res) {
                            if (res.success && res.dados && Array.isArray(res.dados)) {
                                $.each(res.dados, function(key, val) {
                                    $(`.check-mes-sped[value="${val}"]`).prop('checked', true);
                                });
                                atualizarVisualCards();
                            }
                        }
                    });
                });

                // 2. Botão N/A (Agora chama a função de salvar direto)
                $('#btnSpedAnualNA').off('click').on('click', function(e) {
                    e.preventDefault(); // Impede recarregamento
                    processarEnvioSped('N/A');
                });

                // 3. Botão Pendência
                $('#btnSpedAnualPendencia').off('click').on('click', function(e) {
                    e.preventDefault();
                    let motivo = prompt("Informe o responsável ou motivo da pendência:");
                    if (motivo) {
                        if (motivo.trim() === "") motivo = "Geral";
                        processarEnvioSped('Pendência - ' + motivo);
                    }
                });

                // 4. Submit do Formulário (Botão Salvar Verde)
                $('#formSpedAnual').off('submit').on('submit', function(e) {
                    e.preventDefault();
                    processarEnvioSped(null); // Null significa: use a lógica dos checkboxes
                });

                // --- FUNÇÃO CENTRALIZADA DE ENVIO ---
                function processarEnvioSped(statusForcado) {
                    // PEGA O ID DIRETAMENTE DO CAMPO OCULTO
                    const idControle = $('#sped_anual_id').val();

                    // VERIFICAÇÃO DE SEGURANÇA
                    if (!idControle) {
                        alert("Erro Crítico: O ID da empresa não foi carregado no formulário. Tente fechar e abrir o modal novamente.");
                        console.error("Tentativa de envio sem ID definido no #sped_anual_id");
                        return;
                    }

                    var mesesMarcados = [];
                    $('.check-mes-sped:checked').each(function() {
                        mesesMarcados.push($(this).val());
                    });

                    var textoStatusParaEnviar = '';

                    // Lógica de decisão do status
                    if (statusForcado) {
                        textoStatusParaEnviar = statusForcado;
                    } else {
                        // Lógica dos Checkboxes
                        var isCompleto = (mesesMarcados.length === 12);
                        if (isCompleto) {
                            var dataInput = prompt("Todos os meses selecionados! Informe a data de entrega:", getDataAtualFormatada());
                            if (dataInput === null) return; // Cancelou
                            textoStatusParaEnviar = "OK - " + (dataInput.trim() || getDataAtualFormatada());
                        } else {
                            textoStatusParaEnviar = (mesesMarcados.length === 0) ? "Pendente" : "Pendente (" + mesesMarcados.length + "/12)";
                        }
                    }

                    console.log("Enviando...", {
                        id: idControle,
                        status: textoStatusParaEnviar
                    });

                    // Envia para o PHP
                    $.ajax({
                        url: 'assets/backend/salvar_detalhes_sped_anual.php',
                        method: 'POST',
                        data: {
                            id_controle: idControle,
                            meses: mesesMarcados,
                            status_formatado: textoStatusParaEnviar
                        },
                        dataType: 'json',
                        cache: false,
                        success: function(res) {
                            if (res.success) {
                                $('#modalSpedAnual').removeClass('active');

                                // Atualiza visualmente na tabela
                                const cell = $(`.data-table tr[data-id="${idControle}"] td[data-coluna="sped_contribuicao"]`);
                                let novoStatus = res.novo_status;
                                let htmlBadge = '';

                                if (novoStatus === 'N/A') {
                                    htmlBadge = '<span class="badge badge-na">N/A</span>';
                                } else if (novoStatus.indexOf('Pendência') === 0) {
                                    htmlBadge = `<span class="badge badge-pendencia" title="${novoStatus}">Pendência</span>`;
                                } else if (novoStatus.indexOf('OK') === 0) {
                                    htmlBadge = `<span class="badge badge-ok">${novoStatus}</span>`;
                                } else {
                                    htmlBadge = `<span class="badge bg-warning text-dark">${novoStatus}</span>`;
                                }
                                cell.html(htmlBadge);
                            } else {
                                alert('Erro do servidor: ' + res.message);
                                console.log('Debug PHP:', res);
                            }
                        },
                        error: function(xhr) {
                            alert('Erro de comunicação. Veja o console.');
                            console.error(xhr.responseText);
                        }
                    });
                }

                // 2. Botão Marcar/Desmarcar Todos (Corrigido)
                $('#btnMarcarTodosSped').on('click', function(e) {
                    e.preventDefault(); // Evita qualquer submit acidental

                    const checkboxes = $('.check-mes-sped');
                    const total = checkboxes.length;
                    const marcados = checkboxes.filter(':checked').length;

                    // Se todos estiverem marcados, desmarca tudo. Se faltar algum, marca tudo.
                    const novoEstado = (marcados < total);

                    checkboxes.prop('checked', novoEstado);
                    atualizarVisualCards(); // Força a atualização da cor verde
                });

                // 3. Clique no Card Individual (Para atualizar a cor instantaneamente)
                // O onclick no HTML já clica no input, então ouvimos a mudança do input
                $(document).on('change', '.check-mes-sped', function() {
                    atualizarVisualCards();
                });

                function mostrarPopup(mensagem) {
                    alert(mensagem);
                }

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
                        'btnEmpresasAtivas': 'modalEmpresasAtivas',
                        'btnNovasObrigacoes': 'modalNovasObrigacoes',
                        'btnObrigacoesFuturas': 'modalObrigacoesFuturas',
                        'btnEmpresasSaindoMes': 'modalEmpresasSaindoMes',
                        'btnEmpresasSaindoFuturo': 'modalEmpresasSaindoFuturo',
                        // Modais de certificados removidos dos botões principais, mas mantidos no código
                        'btnAbrirModalCertificados': 'modalCertificados'
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
                    document.querySelectorAll('.modal-close').forEach(btn => {
                        btn.addEventListener('click', function() {
                            const modal = this.closest('.modal-overlay');
                            if (modal) {
                                modal.classList.remove('active');
                                document.body.style.overflow = '';
                            }
                        });
                    });
                    document.querySelectorAll('.modal-overlay').forEach(modal => {
                        modal.addEventListener('click', function(e) {
                            if (e.target === this) {
                                this.classList.remove('active');
                                document.body.style.overflow = '';
                            }
                        });
                    });
                }

                function toggleEditaveis() {
                    const table = document.querySelector('.data-table');
                    table.classList.toggle('show-all');
                    const btn = document.querySelector('.filter-buttons .btn');
                    btn.textContent = table.classList.contains('show-all') ?
                        'Mostrar Apenas Editáveis' : 'Mostrar Todos Campos';
                    setupFixedColumns();
                }

                function changeMonth() {
                    const select = document.getElementById('select-mes');
                    const selectedOption = select.options[select.selectedIndex];
                    const mesId = selectedOption.value;
                    const urlParams = new URLSearchParams(window.location.search);
                    const verComoId = urlParams.get('ver_como');
                    const area = urlParams.get('area');
                    let novaUrl = `fiscal.php?mes_id=${mesId}`;
                    if (verComoId && area) {
                        novaUrl += `&ver_como=${verComoId}&area=${area}`;
                    }
                    window.location.href = novaUrl;
                }

                function setupFixedColumns() {
                    const table = document.querySelector('.data-table');
                    if (!table) return;
                    const rows = table.querySelectorAll('tr');
                    const numColunasFixas = 4;
                    rows.forEach(row => {
                        let offsetLeft = 0;
                        for (let i = 0; i < numColunasFixas; i++) {
                            const cell = row.children[i];
                            if (cell) {
                                const cellWidth = cell.offsetWidth;
                                cell.style.left = `${offsetLeft}px`;
                                cell.classList.remove('coluna-fixa');
                                if (i === numColunasFixas - 1) {
                                    cell.classList.add('coluna-fixa');
                                }
                                offsetLeft += cellWidth;
                            }
                        }
                    });
                }

                function setupTableSorting() {
                    $('.data-table th.sortable').on('click', function() {
                        const th = $(this);
                        const table = th.closest('table');
                        const tbody = table.find('tbody');
                        const column = th.data('column');
                        const columnIndex = th.index();
                        let currentDirection = th.hasClass('sorted-asc') ? 'asc' : (th.hasClass('sorted-desc') ? 'desc' : 'none');
                        let newDirection = (currentDirection === 'asc') ? 'desc' : 'asc';
                        table.find('th.sortable').removeClass('sorted-asc sorted-desc').find('.sort-icon').attr('class', 'fas fa-sort sort-icon');
                        th.addClass(newDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');
                        th.find('.sort-icon').attr('class', newDirection === 'asc' ? 'fas fa-sort-up sort-icon' : 'fas fa-sort-down sort-icon');
                        const rows = tbody.find('tr').toArray();
                        rows.sort(function(a, b) {
                            const valA = $(a).find('td').eq(columnIndex).text().trim();
                            const valB = $(b).find('td').eq(columnIndex).text().trim();
                            let comparison = 0;
                            if (column === 'codigo') {
                                comparison = parseInt(valA, 10) - parseInt(valB, 10);
                            } else {
                                comparison = valA.localeCompare(valB, 'pt-BR', {
                                    sensitivity: 'base'
                                });
                            }
                            return newDirection === 'asc' ? comparison : -comparison;
                        });
                        tbody.empty().append(rows);

                        // Recalcula posições das colunas fixas após reordenar
                        if (typeof setupFixedColumns === 'function') {
                            setupFixedColumns();
                        }
                    });
                }

                function setupEdicaoCelulas() {
                    const EDICAO_ESTA_LIBERADA = <?= $edicao_liberada ? 'true' : 'false' ?>;
                    document.querySelectorAll('.editavel[contenteditable="true"]').forEach(celula => {
                        celula.addEventListener('focus', function() {
                            if (!EDICAO_ESTA_LIBERADA) {
                                mostrarPopup("Este mês está bloqueado para edições. Contate o administrador.");
                                this.blur();
                                return;
                            }
                            this.dataset.originalValue = this.textContent;
                        });
                        celula.addEventListener('blur', function() {
                            if (!EDICAO_ESTA_LIBERADA) return;
                            if (this.textContent !== this.dataset.originalValue) {
                                salvarAlteracao(this);
                            }
                        });
                    });
                }

                function salvarAlteracao(elemento) {
                    const linha = elemento.closest('tr');
                    const empresaId = linha.dataset.id;
                    const coluna = elemento.closest('.editavel').dataset.coluna;
                    let valor = elemento.textContent.trim();

                    fetch('salvar_alteracao_fiscal.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded'
                            },
                            body: `id=${empresaId}&coluna=${coluna}&valor=${encodeURIComponent(valor)}`
                        })
                        .then(response => response.json())
                        .then(data => {
                            if (!data.success) {
                                mostrarPopup(data.message || 'Erro ao salvar alteração.');
                                elemento.textContent = elemento.dataset.originalValue;
                            }
                        })
                        .catch(() => {
                            mostrarPopup('Erro ao conectar com o servidor.');
                            elemento.textContent = elemento.dataset.originalValue;
                        });
                }

                function setupTema() {
                    const currentTheme = localStorage.getItem('theme') || 'light';
                    document.documentElement.setAttribute('data-theme', currentTheme);
                    updateThemeIcon(currentTheme);
                    document.getElementById('themeToggle').addEventListener('click', function() {
                        const currentTheme = document.documentElement.getAttribute('data-theme');
                        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                        document.documentElement.setAttribute('data-theme', newTheme);
                        localStorage.setItem('theme', newTheme);
                        updateThemeIcon(newTheme);
                    });

                    function updateThemeIcon(theme) {
                        const icon = document.querySelector('#themeToggle i');
                        if (theme === 'dark') {
                            icon.classList.remove('fa-moon');
                            icon.classList.add('fa-sun');
                        } else {
                            icon.classList.remove('fa-sun');
                            icon.classList.add('fa-moon');
                        }
                    }
                }

                function setupNotificacoes() {
                    const notificationsBtn = document.querySelector('.notifications-btn');
                    const notificationsNav = document.querySelector('.notifications-nav');
                    if (notificationsBtn && notificationsNav) {
                        notificationsBtn.addEventListener('click', function() {
                            notificationsNav.classList.toggle('active');
                        });
                    }
                }

                function setupPesquisa() {
                    const searchInput = document.getElementById('search-input');
                    if (searchInput) {
                        searchInput.addEventListener('input', function() {
                            const termo = this.value.toLowerCase();
                            document.querySelectorAll('.data-table tbody tr').forEach(linha => {
                                linha.style.display = linha.textContent.toLowerCase().includes(termo) ? '' : 'none';
                            });
                        });
                    }
                }

                function setupLogout() {
                    const logoutButton = document.getElementById('logoutBtn');
                    if (logoutButton) {
                        logoutButton.addEventListener('click', function() {
                            this.style.transform = 'scale(1.2)';
                            this.style.background = 'var(--error-color)';
                            this.style.color = 'white';
                            setTimeout(() => window.location.href = 'logout.php', 300);
                        });
                    }
                }

                function setupEnterKeyNavigation() {
                    const tableBody = document.querySelector('.data-table tbody');
                    if (!tableBody) return;
                    tableBody.addEventListener('keydown', function(event) {
                        if (event.key === 'Enter' && event.target.matches('td.editavel[contenteditable="true"]')) {
                            event.preventDefault();
                            const currentCell = event.target;
                            const currentRow = currentCell.closest('tr');
                            const cellIndex = currentCell.cellIndex;
                            const nextRow = currentRow.nextElementSibling;
                            if (nextRow) {
                                const targetCell = nextRow.children[cellIndex];
                                if (targetCell && targetCell.hasAttribute('contenteditable')) {
                                    targetCell.focus();
                                }
                            }
                        }
                    });
                }

                document.addEventListener('DOMContentLoaded', function() {
                    setupModais();
                    setupModalSearchBars();
                    setupEdicaoCelulas();
                    setupTema();
                    setupNotificacoes();
                    setupPesquisa();
                    setupLogout();
                    setupTableSorting();
                    setupFixedColumns();
                    setupEnterKeyNavigation();
                    window.addEventListener('resize', setupFixedColumns);
document.querySelectorAll('.salvar-select').forEach(select => {
    select.addEventListener('change', function () {
        const empresaId = this.dataset.id;
        const coluna = this.dataset.coluna;
        const valor = this.value;

        fetch('salvar_alteracao_fiscal.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `id=${empresaId}&coluna=${coluna}&valor=${encodeURIComponent(valor)}`
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                alert(data.message || 'Erro ao salvar alteração.');
            }
        })
        .catch(() => {
            alert('Erro ao conectar com o servidor.');
        });
    });
});
                    // Password modal e outros setups...
                    const modalOverlay = document.getElementById('passwordModalOverlay');
                    const openBtn = document.getElementById('changePasswordBtn');
                    const closeBtn = document.getElementById('closePasswordModalBtn');
                    const form = document.getElementById('changePasswordForm');
                    const messageDiv = document.getElementById('modal-message');

                    if (openBtn) {
                        openBtn.onclick = function() {
                            if (form) form.reset();
                            if (messageDiv) {
                                messageDiv.style.display = 'none';
                                messageDiv.className = 'modal-message';
                            }
                            if (modalOverlay) modalOverlay.classList.add('active');
                        }
                    }

                    // Setup Filtering logic
                    const table = document.querySelector('.data-table');
                    if (table) {
                        const headers = table.querySelectorAll('thead th');
                        const tbody = table.querySelector('tbody');
                        let activeFilterMenu = null;
                        const activeFilters = {};

                        headers.forEach((header, colIndex) => {
                            const filterIcon = header.querySelector('.filter-icon');
                            if (!filterIcon) return;
                            activeFilters[colIndex] = new Set();
                            filterIcon.addEventListener('click', (event) => {
                                event.stopPropagation();
                                if (activeFilterMenu) {
                                    activeFilterMenu.remove();
                                }
                                const filterMenu = createFilterMenu(colIndex);
                                const iconRect = filterIcon.getBoundingClientRect();
                                let leftPosition = iconRect.left + window.scrollX;
                                if (leftPosition + 200 > window.innerWidth) {
                                    leftPosition = iconRect.right + window.scrollX - 200;
                                }
                                filterMenu.style.left = `${leftPosition}px`;
                                filterMenu.style.top = `${iconRect.bottom + window.scrollY + 5}px`;
                                document.body.appendChild(filterMenu);
                                filterMenu.style.display = 'block';
                                activeFilterMenu = filterMenu;
                            });
                        });

                        document.addEventListener('click', () => {
                            if (activeFilterMenu) {
                                activeFilterMenu.remove();
                                activeFilterMenu = null;
                            }
                        });

                        function createFilterMenu(colIndex) {
                            const menu = document.createElement('div');
                            menu.className = 'filter-menu';
                            menu.addEventListener('click', e => e.stopPropagation());
                            const allRows = Array.from(tbody.querySelectorAll('tr'));
                            const uniqueValues = new Set();
                            allRows.forEach(row => {
                                const cell = row.querySelector(`td:nth-child(${colIndex + 1})`);
                                if (cell) {
                                    const cellValue = cell.textContent.trim();
                                    if (cellValue) uniqueValues.add(cellValue);
                                }
                            });
                            const sortedValues = Array.from(uniqueValues).sort((a, b) => a.localeCompare(b, 'pt-BR'));
                            let optionsHTML = '<ul class="filter-menu-list">';
                            sortedValues.forEach(value => {
                                const isChecked = activeFilters[colIndex].size === 0 || activeFilters[colIndex].has(value);
                                const escapedValue = value.replace(/"/g, '&quot;');
                                optionsHTML += `
                                    <li><label><input type="checkbox" class="filter-option" value="${escapedValue}" ${isChecked ? 'checked' : ''}> ${value}</label></li>
                                `;
                            });
                            optionsHTML += '</ul>';
                            const buttonsHTML = `
                                <div class="filter-menu-buttons">
                                    <button class="apply-btn">Aplicar</button>
                                    <button class="clear-btn">Limpar Filtro</button>
                                </div>
                            `;
                            menu.innerHTML = optionsHTML + buttonsHTML;
                            menu.querySelector('.apply-btn').addEventListener('click', () => {
                                const selectedValues = new Set();
                                menu.querySelectorAll('.filter-option:checked').forEach(cb => {
                                    selectedValues.add(cb.value);
                                });
                                if (selectedValues.size === sortedValues.length || selectedValues.size === 0) {
                                    activeFilters[colIndex].clear();
                                } else {
                                    activeFilters[colIndex] = selectedValues;
                                }
                                applyAllFilters();
                                menu.remove();
                                activeFilterMenu = null;
                            });
                            menu.querySelector('.clear-btn').addEventListener('click', () => {
                                activeFilters[colIndex].clear();
                                applyAllFilters();
                                menu.remove();
                                activeFilterMenu = null;
                            });
                            return menu;
                        }

                        function applyAllFilters() {
                            const allRows = Array.from(tbody.querySelectorAll('tr'));
                            allRows.forEach(row => {
                                let isVisible = true;
                                for (const colIndex in activeFilters) {
                                    const allowedValues = activeFilters[colIndex];
                                    if (allowedValues.size === 0) continue;
                                    const cell = row.querySelector(`td:nth-child(${parseInt(colIndex) + 1})`);
                                    const cellValue = cell ? cell.textContent.trim() : '';
                                    if (!allowedValues.has(cellValue)) {
                                        isVisible = false;
                                        break;
                                    }
                                }
                                row.style.display = isVisible ? '' : 'none';
                            });
                        }
                    }

                    // Fechar modal de senha
                    function closeModal() {
                        if (modalOverlay) modalOverlay.classList.remove('active');
                    }
                    if (closeBtn) closeBtn.onclick = closeModal;
                    if (modalOverlay) {
                        modalOverlay.addEventListener('click', function(event) {
                            if (event.target === modalOverlay) closeModal();
                        });
                    }
                    if (form) {
                        form.addEventListener('submit', function(event) {
                            event.preventDefault();
                            if (messageDiv) {
                                messageDiv.style.display = 'none';
                                messageDiv.textContent = '';
                            }
                            const novaSenha = document.getElementById('nova_senha').value;
                            const confirmarSenha = document.getElementById('confirmar_senha').value;
                            if (novaSenha !== confirmarSenha) {
                                messageDiv.textContent = 'As novas senhas não coincidem!';
                                messageDiv.className = 'modal-message error';
                                return;
                            }
                            const formData = new FormData(form);
                            fetch('alterar_senha.php', {
                                    method: 'POST',
                                    body: formData
                                })
                                .then(response => response.json())
                                .then(data => {
                                    messageDiv.textContent = data.message;
                                    if (data.success) {
                                        messageDiv.className = 'modal-message success';
                                        form.reset();
                                        setTimeout(() => closeModal(), 2500);
                                    } else {
                                        messageDiv.className = 'modal-message error';
                                    }
                                })
                                .catch(error => {
                                    messageDiv.textContent = 'Ocorreu um erro de comunicação com o servidor.';
                                    messageDiv.className = 'modal-message error';
                                });
                        });
                    }
                });

                window.toggleEditaveis = toggleEditaveis;
                window.changeMonth = changeMonth;
            </script>
            <script>
                $(document).ready(function() {

                    // Função auxiliar para data atual
                    function getDataAtualFormatada() {
                        const hoje = new Date();
                        const dia = String(hoje.getDate()).padStart(2, '0');
                        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
                        const ano = hoje.getFullYear();
                        return `${dia}/${mes}/${ano}`;
                    }

                    /* =================================================================
                       LÓGICA REINF (OPERADOR - COM TRAVA DE MÊS FECHADO)
                       ================================================================= */

                    // 1. Abrir Modal Reinf
                    $('.data-table').on('click', '.reinf-trigger', function() {
                        const cell = $(this);
                        const row = cell.closest('tr');
                        const id = row.data('id');

                        // [DIFERENÇA IMPORTANTE] Aqui pegamos a permissão do PHP
                        const edicaoLiberada = <?= $edicao_liberada ? 'true' : 'false' ?>;

                        if (!edicaoLiberada) {
                            alert('Mês fechado para edições.');
                            return;
                        }

                        $('#modalDetalhesReinf').addClass('active');
                        $('#reinf_id_controle').val(id);
                        $('#reinf_status_forced').val('');
                        $('#formReinfDetalhes input[type="text"]').val('...');
                        $('#reinf_msg_status').hide().text('');

                        $.ajax({
                            url: 'assets/backend/obter_detalhes_reinf.php',
                            method: 'GET',
                            data: {
                                id: id
                            },
                            dataType: 'json',
                            cache: false,
                            success: function(res) {
                                if (res.success) {
                                    $('#reinf_irrf_1708').val(res.dados.irrf_1708);
                                    $('#reinf_crf_5952').val(res.dados.crf_5952);
                                    $('#reinf_inss_prestados').val(res.dados.inss_prestados);
                                    $('#reinf_inss_tomados').val(res.dados.inss_tomados);
                                    $('#reinf_desoneracao').val(res.dados.desoneracao);
                                    $('#reinf_irrf_3208').val(res.dados.irrf_3208);
                                    $('#reinf_outros').val(res.dados.outros);

                                    // Salva memória do status anterior
                                    $('#formReinfDetalhes').data('status-atual', res.dados.status_atual);

                                    if (res.dados.status_atual && res.dados.status_atual.indexOf('Pendência') !== -1) {
                                        $('#reinf_msg_status').text("Status Atual: " + res.dados.status_atual).show();
                                    }
                                } else {
                                    alert('Erro ao buscar detalhes.');
                                }
                            }
                        });
                    });

                    // 2. Botão N/A
                    $('#btnReinfNA').on('click', function() {
                        $('#reinf_status_forced').val('N/A');
                        $('#formReinfDetalhes').submit();
                    });

                    // 2.5 Botão OK - Sem Movimento (abre confirmação)
                    let _pendingOkSem = { formSelector: null, statusField: null };
                    $('#btnReinfOkSemMovimento').on('click', function() {
                        _pendingOkSem.formSelector = '#formReinfDetalhes';
                        _pendingOkSem.statusField = '#reinf_status_forced';
                        $('#confirmOkSemMovimentoModal .confirm-message').html('Confirma <strong>OK - SEM MOVIMENTO</strong> para este REINF?');
                        $('#confirmOkSemMovimentoModal').addClass('active');
                    });

                    // Confirmar/Cancelar no modal
                    $('#confirmOkSemMovimentoBtn').on('click', function() {
                        // Proteção: só age se houver um pending definido
                        if (!_pendingOkSem.formSelector || !_pendingOkSem.statusField) {
                            $('#confirmOkSemMovimentoModal').removeClass('active');
                            return;
                        }

                        let apiVal = $('#selectApiOkSemMovimento').val();
                        let suffix = apiVal ? " - " + apiVal : "";

                        $(_pendingOkSem.statusField).val('OK - SEM MOVIMENTO' + suffix);
                        $(_pendingOkSem.formSelector).submit();

                        // Limpa o estado pendente e fecha
                        _pendingOkSem = { formSelector: null, statusField: null };
                        $('#confirmOkSemMovimentoModal').removeClass('active');
                    });

                    function resetPendingOkSem() {
                        _pendingOkSem = { formSelector: null, statusField: null };
                        $('#confirmOkSemMovimentoModal').removeClass('active');
                    }

                    $('#cancelOkSemMovimentoBtn').on('click', resetPendingOkSem);

                    // Fecha ao clicar fora do modal: também limpa o estado pendente
                    $('#confirmOkSemMovimentoModal').on('click', function(e) {
                        if (e.target === this) resetPendingOkSem();
                    });

                    // Se fechar pelo X também limpa a pendência
                    $('#confirmOkSemMovimentoModal .modal-close').on('click', resetPendingOkSem);

                    // ESC também cancela
                    $(document).on('keydown', function(e) {
                        if (e.key === 'Escape' && $('#confirmOkSemMovimentoModal').hasClass('active')) {
                            resetPendingOkSem();
                        }
                    });

                    // 3. Botão Pendência
                    $('#btnReinfPendencia').on('click', function() {
                        let responsavel = prompt("Informe o motivo para esta pendência:");
                        if (responsavel === null) return;
                        if (responsavel.trim() === "") responsavel = "Geral";
                        $('#reinf_status_forced').val('Pendência - ' + responsavel);
                        $('#formReinfDetalhes').submit();
                    });

                    // 4. Submit Reinf
                    $('#formReinfDetalhes').on('submit', function(e) {
                        e.preventDefault();

                        let statusFinal = $('#reinf_status_forced').val();

                        if (statusFinal === '') {
                            let totalCampos = 0;
                            let camposPreenchidos = 0;

                            // Conta quantos campos obrigatórios estão preenchidos
                            $('.check-full-reinf').each(function() {
                                totalCampos++;
                                let val = $(this).val().trim();
                                if (val !== '' && val !== '...') {
                                    camposPreenchidos++;
                                }
                            });

                            if (camposPreenchidos === totalCampos) {
                                // Tudo cheio = OK
                                let dataInput = prompt("Todos os campos obrigatórios preenchidos! Informe a data:", getDataAtualFormatada());
                                if (dataInput === null) return;
                                let isApi = confirm("Foi enviado via API?\n\n[OK] = Sim, API\n[Cancelar] = Não, S/API");
                                statusFinal = "OK - " + dataInput + (isApi ? " - API" : " - S/API");
                            } else if (camposPreenchidos === 0) {
                                // [NOVO] Se tudo vazio = Pendente (Reseta N/A ou Pendência antiga)
                                statusFinal = "Pendente";
                            } else {
                                // Parcialmente cheio = Mantém status especial ou vira Pendente
                                let statusAnterior = $('#formReinfDetalhes').data('status-atual');
                                if (statusAnterior === 'N/A' || (statusAnterior && statusAnterior.indexOf('Pendência') === 0)) {
                                    statusFinal = statusAnterior;
                                } else {
                                    statusFinal = "Pendente";
                                }
                            }

                            $('#reinf_status_forced').val(statusFinal);
                        }

                        const formData = $(this).serialize();
                        const idControle = $('#reinf_id_controle').val();

                        $.ajax({
                            url: 'assets/backend/salvar_detalhes_reinf.php',
                            method: 'POST',
                            data: formData,
                            dataType: 'json',
                            success: function(res) {
                                if (res.success) {
                                    $('#modalDetalhesReinf').removeClass('active');
                                    const cell = $(`.data-table tr[data-id="${idControle}"] td[data-coluna="reinf"]`);

                                    let statusParaExibir = $('#reinf_status_forced').val() || res.novo_status;

                                    if (statusParaExibir.includes('OK -')) {
                                        cell.html(`<span class="badge badge-ok">${statusParaExibir}</span>`);
                                    } else if (statusParaExibir === 'N/A') {
                                        cell.html(`<span class="badge badge-na">N/A</span>`);
                                    } else if (statusParaExibir.includes('Pendência')) {
                                        cell.html(`<span class="badge badge-pendencia" title="${statusParaExibir}">Pendência</span>`);
                                    } else {
                                        cell.html(`<span class="badge bg-secondary">Pendente</span>`);
                                    }
                                } else {
                                    alert('Erro ao salvar: ' + res.message);
                                }
                            },
                            error: function() {
                                alert('Erro de comunicação.');
                            }
                        });
                    });

                    /* =================================================================
                       LÓGICA CARNÊ LEÃO (OPERADOR - COM TRAVA DE MÊS FECHADO)
                       ================================================================= */

                    let currentCarneLeaoCell = null;

                    $(document).off('click', '.carne-leao-trigger').on('click', '.carne-leao-trigger', function() {
                        currentCarneLeaoCell = $(this);
                        const row = currentCarneLeaoCell.closest('tr');
                        const id = row.data('id');

                        const edicaoLiberada = <?= $edicao_liberada ? 'true' : 'false' ?>;

                        if (!edicaoLiberada) {
                            alert('Mês fechado para edições.');
                            return;
                        }

                        $('#modalDetalhesCarneLeao').addClass('active');
                        $('#carne_leao_id_controle').val(id);
                        $('#carne_leao_status_forced').val('');
                        $('#formCarneLeaoDetalhes input[type="text"]').val('');
                        $('#carne_leao_msg_status').hide().text('');

                        $.ajax({
                            url: 'assets/backend/obter_detalhes_carne_leao.php',
                            method: 'GET',
                            data: { id: id },
                            dataType: 'json',
                            cache: false,
                            success: function(res) {
                                if (res.success) {
                                    $('#carne_leao_recibo_saude').val(res.dados.recibo_saude);
                                    $('#carne_leao_receitas_diversas').val(res.dados.receitas_diversas);
                                    $('#carne_leao_despesas_dedutiveis').val(res.dados.despesas_dedutiveis);
                                    $('#carne_leao_inss').val(res.dados.inss);
                                    $('#carne_leao_iss').val(res.dados.iss);
                                    $('#carne_leao_irrf').val(res.dados.irrf);

                                    $('#formCarneLeaoDetalhes').data('status-atual', res.dados.status_atual);

                                    if (res.dados.status_atual && res.dados.status_atual.indexOf('Pendência') !== -1) {
                                        $('#carne_leao_msg_status').text("Status Atual: " + res.dados.status_atual).show();
                                    }
                                }
                            }
                        });
                    });

                    $(document).off('click', '#btnCarneLeaoNA').on('click', '#btnCarneLeaoNA', function(e) {
                        e.preventDefault();
                        $('#carne_leao_status_forced').val('N/A');
                        $('#formCarneLeaoDetalhes').trigger('submit');
                    });

                    $(document).off('click', '#btnCarneLeaoOkSemMovimento').on('click', '#btnCarneLeaoOkSemMovimento', function(e) {
                        e.preventDefault();
                        $('#carne_leao_status_forced').val('OK - SEM MOVIMENTO');
                        $('#formCarneLeaoDetalhes').trigger('submit');
                    });

                    $(document).off('click', '#btnCarneLeaoPendencia').on('click', '#btnCarneLeaoPendencia', function(e) {
                        e.preventDefault();
                        let responsavel = prompt("Informe o motivo para esta pendência:");
                        if (responsavel === null) return;
                        if (responsavel.trim() === "") responsavel = "Geral";
                        $('#carne_leao_status_forced').val('Pendência - ' + responsavel.trim());
                        $('#formCarneLeaoDetalhes').trigger('submit');
                    });

                    $('#formCarneLeaoDetalhes').off('submit').on('submit', function(e) {
                        e.preventDefault();

                        let statusFinal = $('#carne_leao_status_forced').val();

                        if (!statusFinal || statusFinal.trim() === '') {
                            let totalCampos = 0;
                            let camposPreenchidos = 0;

                            $('.check-full-carne-leao').each(function() {
                                totalCampos++;
                                let val = $(this).val().trim();
                                if (val !== '' && val !== '...') {
                                    camposPreenchidos++;
                                }
                            });

                            if (camposPreenchidos === totalCampos) {
                                let dataInput = prompt("Todos os campos preenchidos! Informe a data:", getDataAtualFormatada());
                                if (dataInput === null) return;
                                statusFinal = "OK - " + (dataInput.trim() !== "" ? dataInput : getDataAtualFormatada());
                            } else if (camposPreenchidos > 0) {
                                statusFinal = "Pendente (" + camposPreenchidos + "/" + totalCampos + ")";
                            } else {
                                statusFinal = "Pendente";
                            }
                            $('#carne_leao_status_forced').val(statusFinal);
                        }

                        const formData = $(this).serialize();
                        const idControle = $('#carne_leao_id_controle').val();

                        $.ajax({
                            url: 'assets/backend/salvar_detalhes_carne_leao.php',
                            method: 'POST',
                            data: formData,
                            dataType: 'json',
                            success: function(res) {
                                if (typeof res === 'string') {
                                    try { res = JSON.parse(res); } catch(err) {}
                                }
                                if (res && res.success) {
                                    $('#modalDetalhesCarneLeao').removeClass('active');
                                    const cell = currentCarneLeaoCell || $(`.data-table tr[data-id="${idControle}"] td[data-coluna="carne_leao"]`);

                                    let statusParaExibir = $('#carne_leao_status_forced').val() || res.novo_status;

                                    if (statusParaExibir === 'Preenchido' || statusParaExibir.indexOf('OK') === 0) {
                                        cell.html(`<span class="badge badge-ok">${statusParaExibir}</span>`);
                                    } else if (statusParaExibir === 'N/A') {
                                        cell.html(`<span class="badge badge-na">N/A</span>`);
                                    } else if (statusParaExibir.indexOf('Pendência') === 0) {
                                        cell.html(`<span class="badge badge-pendencia" title="${statusParaExibir}">Pendência</span>`);
                                    } else {
                                        cell.html(`<span class="badge bg-secondary">${statusParaExibir}</span>`);
                                    }
                                } else {
                                    alert('Erro ao salvar: ' + (res ? res.message : 'Erro desconhecido'));
                                }
                            },
                            error: function(xhr, status, error) {
                                alert('Erro na comunicação com o servidor. Status: ' + xhr.status);
                            }
                        });
                    });

                    /* =================================================================
                       LÓGICA IMPOSTOS (OPERADOR - COM TRAVA DE MÊS FECHADO)
                       ================================================================= */

                    // 1. Abrir Modal Impostos
                    $('.data-table').on('click', '.impostos-trigger', function() {
                        const cell = $(this);
                        const row = cell.closest('tr');
                        const id = row.data('id');
                        const edicaoLiberada = <?= $edicao_liberada ? 'true' : 'false' ?>;

                        if (!edicaoLiberada) {
                            alert('Mês fechado.');
                            return;
                        }

                        $('#modalDetalhesImpostos').addClass('active');
                        $('#impostos_id_controle').val(id);
                        $('#impostos_status_forced').val('');
                        $('#formImpostosDetalhes input[type="text"]').val('...');
                        $('#imp_msg_status').hide().text('');

                        $.ajax({
                            url: 'assets/backend/obter_detalhes_impostos.php',
                            data: {
                                id: id
                            },
                            dataType: 'json',
                            cache: false,
                            success: function(res) {
                                if (res.success) {
                                    $('#imp_faturamento').val(res.dados.faturamento);
                                    $('#imp_iss_prestados').val(res.dados.iss_prestados);
                                    $('#imp_iss_tomados').val(res.dados.iss_tomados);
                                    $('#imp_das').val(res.dados.das);
                                    $('#imp_darf_pis_cofins').val(res.dados.darf_pis_cofins);
                                    $('#imp_darf_irpj_csll').val(res.dados.darf_irpj_csll);
                                    $('#imp_icms').val(res.dados.icms);
                                    $('#imp_outros').val(res.dados.outros);

                                    $('#formImpostosDetalhes').data('status-atual', res.dados.status_atual);

                                    if (res.dados.status_atual && res.dados.status_atual.indexOf('Pendência') !== -1) {
                                        $('#imp_msg_status').text("Status Atual: " + res.dados.status_atual).show();
                                    }
                                } else {
                                    alert('Erro ao carregar dados.');
                                }
                            }
                        });
                    });

                    // 2. Botão N/A
                    $('#btnImpostosNA').on('click', function() {
                        $('#impostos_status_forced').val('N/A');
                        $('#formImpostosDetalhes').submit();
                    });

                    // 2.5 Botão OK - Sem Movimento (abre confirmação)
                    $('#btnImpostosOkSemMovimento').on('click', function() {
                        _pendingOkSem.formSelector = '#formImpostosDetalhes';
                        _pendingOkSem.statusField = '#impostos_status_forced';
                        $('#confirmOkSemMovimentoModal .confirm-message').html('Confirma <strong>OK - SEM MOVIMENTO</strong> para este IMPOSTOS?');
                        $('#confirmOkSemMovimentoModal').addClass('active');
                    });

                    // 3. Botão Pendência
                    $('#btnImpostosPendencia').on('click', function() {
                        let responsavel = prompt("Informe o motivo para esta pendência:");
                        if (responsavel === null) return;
                        if (responsavel.trim() === "") responsavel = "Geral";
                        $('#impostos_status_forced').val('Pendência - ' + responsavel);
                        $('#formImpostosDetalhes').submit();
                    });

                    // 4. Submit Impostos
                    $('#formImpostosDetalhes').on('submit', function(e) {
                        e.preventDefault();

                        let statusFinal = $('#impostos_status_forced').val();

                        if (statusFinal === '') {
                            let totalCampos = 0;
                            let camposPreenchidos = 0;

                            // Conta quantos campos obrigatórios estão preenchidos
                            $('.check-full-imp').each(function() {
                                totalCampos++;
                                let val = $(this).val().trim();
                                if (val !== '' && val !== '...') {
                                    camposPreenchidos++;
                                }
                            });

                            if (camposPreenchidos === totalCampos) {
                                let dataInput = prompt("Todos os impostos obrigatórios preenchidos! Informe a data:", getDataAtualFormatada());
                                if (dataInput === null) return;
                                let isApi = confirm("Foi enviado via API?\n\n[OK] = Sim, API\n[Cancelar] = Não, S/API");
                                statusFinal = "OK - " + dataInput + (isApi ? " - API" : " - S/API");
                            } else if (camposPreenchidos === 0) {
                                // [NOVO] Se tudo vazio = Pendente
                                statusFinal = "Pendente";
                            } else {
                                let statusAnterior = $('#formImpostosDetalhes').data('status-atual');
                                if (statusAnterior === 'N/A' || (statusAnterior && statusAnterior.indexOf('Pendência') === 0)) {
                                    statusFinal = statusAnterior;
                                } else {
                                    statusFinal = "Pendente";
                                }
                            }

                            $('#impostos_status_forced').val(statusFinal);
                        }

                        const formData = $(this).serialize();
                        const id = $('#impostos_id_controle').val();

                        $.post('assets/backend/salvar_detalhes_impostos.php', formData, function(res) {
                            if (res.success) {
                                $('#modalDetalhesImpostos').removeClass('active');
                                const cell = $(`.data-table tr[data-id="${id}"] td[data-coluna="impostos"]`);

                                let statusParaExibir = $('#impostos_status_forced').val() || res.novo_status;

                                if (statusParaExibir.includes('OK -')) {
                                    cell.html(`<span class="badge badge-ok">${statusParaExibir}</span>`);
                                } else if (statusParaExibir === 'N/A') {
                                    cell.html(`<span class="badge badge-na">N/A</span>`);
                                } else if (statusParaExibir.includes('Pendência')) {
                                    cell.html(`<span class="badge badge-pendencia" title="${statusParaExibir}">Pendência</span>`);
                                } else {
                                    cell.html(`<span class="badge bg-secondary">Pendente</span>`);
                                }
                            } else {
                                alert('Erro ao salvar: ' + res.message);
                            }
                        }, 'json');
                    });

                    // Modal Parcelamento e Empresa
                    $('#abrir-modal-parcelamento-btn').on('click', function() {
                        $('#selecionarEmpresaModal').addClass('active');
                        carregarListaEmpresasParcelamento();
                    });

                    function carregarListaEmpresasParcelamento() {
                        const lista = $('#lista-empresas-parcelamento');
                        const selectResponsaveis = $('#responsavel-parcelamento');
                        lista.html('<div class="loading-content"><div class="loading-spinner"></div><p>Carregando empresas...</p></div>');
                        $.ajax({
                            url: 'assets/backend/obter_empresas_para_parcelamento.php',
                            method: 'GET',
                            dataType: 'json',
                            success: function(response) {
                                if (response.success && response.empresas.length > 0) {
                                    lista.empty();
                                    response.empresas.forEach(empresa => {
                                        let dataSaida = empresa.data_saida || null;
                                        let status = 'ativa';
                                        if (dataSaida) {
                                            try {
                                                const hoje = new Date();
                                                hoje.setHours(0, 0, 0, 0);
                                                const dtSaida = new Date(dataSaida + 'T00:00:00');
                                                if (dtSaida < hoje) status = 'inativa';
                                            } catch (e) {}
                                        }
                                        lista.append(`
                                            <div class="empresa-item" 
                                                data-id="${empresa.id}" 
                                                data-codigo="${empresa.codigo}" 
                                                data-nome="${empresa.empresa}" 
                                                data-cnpj="${empresa.cnpj}"
                                                data-status="${status}"> 
                                                <span>${empresa.empresa} (${empresa.codigo})</span>
                                                ${status === 'inativa' ? '<span class="badge bg-danger ms-2" style="font-size: 0.8em;">Inativa</span>' : ''}
                                            </div>
                                        `);
                                    });
                                    selectResponsaveis.empty();
                                    selectResponsaveis.append('<option value="">Selecione um responsável</option>');
                                    response.responsaveis.forEach(responsavel => {
                                        selectResponsaveis.append(`<option value="${responsavel.id}">${responsavel.nome}</option>`);
                                    });
                                    aplicarFiltrosModalParcelamento();
                                } else {
                                    lista.html('<p class="text-center">Nenhuma empresa encontrada.</p>');
                                }
                            },
                            error: function() {
                                lista.html('<p class="text-center text-danger">Erro ao carregar dados.</p>');
                            }
                        });
                    }

                    $(document).on('click', '.empresa-item', function() {
                        const empresaItem = $(this);
                        const empresa = {
                            id: empresaItem.data('id'),
                            codigo: empresaItem.data('codigo'),
                            nome: empresaItem.data('nome'),
                            cnpj: empresaItem.data('cnpj')
                        };
                        $('#info-empresa-existente').show();
                        $('#info-empresa-avulsa').hide();
                        $('#parcelamento-nome-avulso').val('');
                        $('#parcelamento-cnpj-avulso').val('');
                        $('#parcelamento-id-empresa').val(empresa.id);
                        $('#parcelamento-codigo-empresa').val(empresa.codigo);
                        $('#parcelamento-nome-empresa').val(empresa.nome);
                        $('#parcelamento-cnpj-empresa').val(empresa.cnpj);
                        $('#parcelamento-empresa-nome').text(empresa.nome);
                        $('#selecionarEmpresaModal').removeClass('active');
                        $('#detalhesParcelamentoModal').addClass('active');
                    });

                    $('#btn-parcelamento-avulso').on('click', function() {
                        $('#info-empresa-existente').hide();
                        $('#info-empresa-avulsa').show();
                        $('#parcelamento-empresa-nome').text('');
                        $('#parcelamento-id-empresa').val('0');
                        $('#parcelamento-codigo-empresa').val('AVULSO');
                        $('#parcelamento-nome-empresa').val('');
                        $('#parcelamento-cnpj-empresa').val('');
                        $('#selecionarEmpresaModal').removeClass('active');
                        $('#detalhesParcelamentoModal').addClass('active');
                        $('#parcelamento-nome-avulso').focus();
                    });

                    $('#parcelamento-nome-avulso').on('keyup', function() {
                        $('#parcelamento-nome-empresa').val($(this).val());
                    });
                    $('#parcelamento-cnpj-avulso').on('keyup', function() {
                        $('#parcelamento-cnpj-empresa').val($(this).val());
                    });

                    $('#formParcelamento').on('submit', function(e) {
                        e.preventDefault();
                        const form = $(this);
                        const btn = form.find('button[name="salvar_parcelamento"]');
                        const originalHtml = btn.html();
                        const dadosForm = form.serializeArray();
                        dadosForm.push({
                            name: 'salvar_parcelamento',
                            value: true
                        });
                        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Salvando...');

                        $.ajax({
                            url: 'salvar_parcelamento.php',
                            method: 'POST',
                            data: $.param(dadosForm),
                            dataType: 'json',
                            success: function(response) {
                                if (response.success) {
                                    alert('Sucesso: ' + response.message);
                                    $('#detalhesParcelamentoModal').removeClass('active');
                                    const empresaId = $('#parcelamento-id-empresa').val();
                                    const responsavelId = $('#responsavel-parcelamento').val();
                                    const nomeEmpresa = $('#parcelamento-nome-empresa').val();
                                    delegarTarefaParcelamento(empresaId, responsavelId, nomeEmpresa);
                                } else {
                                    alert('Erro: ' + response.message);
                                }
                            },
                            error: function() {
                                alert('Erro ao comunicar com o servidor.');
                            },
                            complete: function() {
                                btn.prop('disabled', false).html(originalHtml);
                            }
                        });
                    });

                    function delegarTarefaParcelamento(id_empresa, id_usuario, nome_empresa) {
                        const id_mes = <?= $mes_selecionado ?? 'null' ?>;
                        if (!id_mes) return;
                        $.ajax({
                            url: 'salvar_delegacao.php',
                            method: 'POST',
                            data: {
                                id_empresa: id_empresa,
                                id_usuario: id_usuario,
                                id_mes: id_mes,
                                tipo_tarefa: 'fiscal_parcelamento',
                                nome_empresa_avulsa: nome_empresa
                            }
                        });
                    }

                    function aplicarFiltrosModalParcelamento() {
                        const termo = $('#filtro-empresas-parcelamento').val().toLowerCase();
                        const statusFiltro = $('input[name="filtro_status_parcelamento"]:checked').val();
                        $('#lista-empresas-parcelamento .empresa-item').each(function() {
                            const item = $(this);
                            const statusEmpresa = item.data('status');
                            let statusVisivel = false;
                            if (statusFiltro === 'todas') statusVisivel = true;
                            else if (statusFiltro === 'ativas' && statusEmpresa === 'ativa') statusVisivel = true;
                            else if (statusFiltro === 'inativas' && statusEmpresa === 'inativa') statusVisivel = true;

                            const nome = item.data('nome').toLowerCase();
                            const codigo = item.data('codigo').toString().toLowerCase();
                            const cnpj = item.data('cnpj').toLowerCase();
                            let textoVisivel = (nome.includes(termo) || codigo.includes(termo) || cnpj.includes(termo));
                            item.toggle(statusVisivel && textoVisivel);
                        });
                    }

                    $('#filtro-empresas-parcelamento').on('keyup', aplicarFiltrosModalParcelamento);
                    $('input[name="filtro_status_parcelamento"]').on('change', aplicarFiltrosModalParcelamento);
                    $('.modal-close').click(function() {
                        $(this).closest('.modal-overlay').removeClass('active');
                    });
                });
            </script>
            <script src="scripts_globais.js"></script>
            <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
            <script src="password_modal.js"></script>
            <script>
                $(document).ready(function() {

                    function formatarDataParaBR(dataISO) {
                        if (!dataISO) return '';
                        const [ano, mes, dia] = dataISO.split('-');
                        return `${dia}/${mes}/${ano}`;
                    }
                    $(document).on('change', '.iss-select', function() {
                        var select = $(this);
                        var novoValor = select.val();
                        var idEmpresa = select.data('id');
                        var valorAnterior = select.find('option[selected]').val(); // Backup caso cancele

                        // Caso usuário escolha "Informar Data..."
                        if (novoValor === 'CUSTOM_DATA') {
                            var dataDigitada = prompt("Digite o dia (ex: 15) ou a data completa (15/01/2026):");

                            if (dataDigitada) {
                                // Formatação simples de dia para data completa
                                if (dataDigitada.length <= 2) {
                                    var hoje = new Date();
                                    var mes = (hoje.getMonth() + 1).toString().padStart(2, '0');
                                    var ano = hoje.getFullYear();
                                    dataDigitada = dataDigitada.padStart(2, '0') + '/' + mes + '/' + ano;
                                }

                                novoValor = "OK - " + dataDigitada;

                                // Adiciona visualmente no select para não precisar recarregar
                                select.prepend('<option value="' + novoValor + '" selected>' + novoValor + '</option>');
                                select.val(novoValor);
                            } else {
                                // Se cancelar o prompt, volta ao valor anterior
                                select.val(valorAnterior);
                                return;
                            }
                        }

                        // Feedback Visual (Fica levemente transparente enquanto salva)
                        select.css('opacity', '0.5');

                        // Envia para o Backend
                        // Nota: Usamos 'salvar_alteracao_fiscal.php' pois este parece ser o painel do operador
                        $.ajax({
                            url: 'salvar_alteracao_fiscal.php',
                            method: 'POST',
                            data: {
                                id: idEmpresa,
                                coluna: 'iss',
                                valor: novoValor
                            },
                            dataType: 'json',
                            success: function(response) {
                                select.css('opacity', '1');

                                if (response.success || response === true || response === '1') {
                                    // Sucesso: Pisca borda verde
                                    select.css('border-bottom', '2px solid #198754');
                                    setTimeout(function() {
                                        select.css('border-bottom', 'none');
                                    }, 2000);
                                } else {
                                    alert('Erro ao salvar: ' + (response.message || 'Erro desconhecido'));
                                    select.css('border-bottom', '2px solid red');
                                }
                            },
                            error: function(xhr) {
                                select.css('opacity', '1');
                                console.error(xhr.responseText);
                                alert('Erro de conexão ao salvar o ISS.');
                            }
                        });
                    });


                    function salvarNoBanco(cell, valor) {
                        const row = cell.closest('tr');
                        const id = row.data('id');
                        let urlDestino = '';

                        if (window.location.href.indexOf('fiscal_admin.php') > -1 || window.location.href.indexOf('painel_lider') > -1) {
                            urlDestino = 'salvar_edicao_fiscal.php';
                        } else {
                            urlDestino = 'salvar_alteracao_fiscal.php';
                        }

                        cell.css('color', '#007bff'); // Feedback visual

                        $.ajax({
                            url: urlDestino,
                            method: 'POST',
                            data: {
                                id: id,
                                coluna: 'iss',
                                valor: valor
                            },
                            dataType: 'json',
                            success: function(response) {
                                if (response.success || response === true || response === '1') {
                                    cell.css('color', '');
                                    cell.css('background-color', '#d4edda');
                                    setTimeout(() => cell.css('background-color', '#fff'), 1000);
                                } else {
                                    alert('Erro ao salvar: ' + (response.message || 'Erro desconhecido'));
                                    cell.css('color', 'red');
                                }
                            },
                            error: function(xhr) {
                                console.error(xhr.responseText);
                                cell.css('color', 'red');
                            }
                        });
                    }
                });
            </script>
            <script src="scripts_globais.js?v=<?= filemtime('scripts_globais.js') ?>"></script>

    </body>

</html>