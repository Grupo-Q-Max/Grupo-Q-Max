<?php
session_start();
// --- NOVO CÓDIGO PARA EVITAR CACHE DO NAVEGADOR ---
// --- ADICIONE ISTO NO TOPO ---
header("Cache-Control: no-cache, no-store, must-revalidate");
header("Expires: 0");
set_time_limit(300); // Aumenta o tempo de execução para 5 min
ini_set('display_errors', 1);
error_reporting(E_ALL);
require_once 'assets/backend/config.php';
require_once 'funcoes_fiscal_admin.php'; // Sua função obterEmpresasFiscalAdmin deve estar aqui

// =======================================================================
// == FUNÇÃO DE FORMATAÇÃO DE DATA (ADICIONADA POR VOCÊ) ==
// =======================================================================
// Função auxiliar para renderizar os badges coloridos
function renderizarBadge($status)
{
    $status = htmlspecialchars($status);
    if (empty($status)) {
        echo '<span class="badge bg-secondary">Pendente</span>';
    } elseif ($status === 'N/A') {
        echo '<span class="badge badge-na">N/A</span>';
    } elseif (strpos($status, 'Pendência') === 0) {
        echo '<span class="badge badge-pendencia" title="' . $status .
            '">Pendência</span>';
    } elseif (strpos($status, 'OK') === 0) {
        // Pega OK - Data ou OK - SEM MOVIMENTO e pinta de verde
        echo '<span class="badge badge-ok">' . $status .
            '</span>';
    } else {
        // Caso tenha algum texto antigo/diferente
        echo '<span class="badge bg-info text-dark">' . $status .
            '</span>';
    }
}

function formatarDataBR($data)
{
    if (empty($data) || $data === '0000-00-00') {
        return ''; // Retorna vazio se não houver data
    }
    try {
        $dateObj = new DateTime($data);
        return $dateObj->format('d/m/Y');
    } catch (Exception $e) {
        return '';
    }
}
// =======================================================================

function documentoEhCPF(?string $documento): bool
{
    $numeros = preg_replace('/\D/', '', trim($documento ?? ''));

    // Pessoa física cadastrada no campo CNPJ, mas com CPF
    return strlen($numeros) === 11;
}
// Adicionado 'lider_dp' na lista de permissões
if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['tipo_conta'], ['admin', 'fiscal','lider_contabil', 'lider_fiscal', 'lider_dp'])) {
    $_SESSION['mensagem'] = 'Acesso restrito à área de gestão Fiscal.';
    header('Location: index.php');
    exit();
}

$meses_disponiveis = obterMesesDisponiveisFiscalAdmin($conexao);
if (isset($_GET['mes_id'])) {
    $mes_selecionado_id = (int)$_GET['mes_id'];
} else {
    // Tenta pegar o segundo mês da lista (índice 1), que geralmente é o anterior ao mais recente (índice 0)
    // Assumindo que obterMesesDisponiveisFiscalAdmin retorna ordenado DESC (mais recente primeiro)
    $mes_selecionado_id = $meses_disponiveis[1]['id'] ?? ($meses_disponiveis[0]['id'] ?? null);
} // --- LÓGICA PARA COLUNAS DE JANEIRO 2026 ---
$is_janeiro = false; // Mudei o nome da variável para ficar mais claro
$is_setembro_2026 = false;
if ($mes_selecionado_id) {
    $stmt_date_check = $conexao->prepare("SELECT mes, ano FROM controle_meses WHERE id = ?");
    $stmt_date_check->bind_param('i', $mes_selecionado_id);
    $stmt_date_check->execute();
    $res_date_check = $stmt_date_check->get_result()->fetch_assoc();
    if ($res_date_check) {
        // ALTERADO: Verifica APENAS se o mês é 1 (Janeiro), independente do ano
        $is_janeiro = ($res_date_check['mes'] == 1);
        $is_setembro_2026 = ($res_date_check['mes'] == 9 && $res_date_check['ano'] == 2026);
    }
    $stmt_date_check->close();
}
$is_maio = false;

if ($mes_selecionado_id) {
    $stmt_m = $conexao->prepare("SELECT mes FROM controle_meses WHERE id = ?");
    $stmt_m->bind_param('i', $mes_selecionado_id);
    $stmt_m->execute();
    $rm = $stmt_m->get_result()->fetch_assoc();

    if ($rm) {
        $is_maio = ((int)$rm['mes'] === 5);
    }

    $stmt_m->close();
}
$is_dezembro = false;
if ($mes_selecionado_id) {
    // Reutilizando a consulta se possível, ou fazendo nova leve
    if (isset($res_date_check)) {
        $is_dezembro = ($res_date_check['mes'] == 12);
    } else {
        // Caso a variável acima tenha sido fechada/sobrescrita
        $stmt_d = $conexao->prepare("SELECT mes FROM controle_meses WHERE id = ?");
        $stmt_d->bind_param('i', $mes_selecionado_id);
        $stmt_d->execute();
        $rd = $stmt_d->get_result()->fetch_assoc();
        if ($rd) $is_dezembro = ($rd['mes'] == 12);
        $stmt_d->close();
    }
    // --- LÓGICA PARA EXIBIÇÃO DA GIA (ATÉ DEZ/2025) ---
    $exibir_gia = true; // Padrão exibe
    if ($mes_selecionado_id) {
        // Verifica o ano do mês selecionado
        $stmt_ano = $conexao->prepare("SELECT ano, mes FROM controle_meses WHERE id = ?");
        $stmt_ano->bind_param('i', $mes_selecionado_id);
        $stmt_ano->execute();
        $res_ano = $stmt_ano->get_result()->fetch_assoc();
        if ($res_ano) {
            $ano_ref = (int)$res_ano['ano'];
            // Se for 2026 ou maior, esconde a GIA
            if ($ano_ref >= 2026) {
                $exibir_gia = false;
            }
        }
        $stmt_ano->close();
    }
}
// -------------------------------------------
// -------------------------------------------
// 1. Adicionar filtros de ordenação
$filtros = [
    'busca'          => $_GET['busca'] ?? '',
    'responsavel_id' => $_GET['responsavel_id'] ?? '',
    'sort'           => $_GET['sort'] ?? 'codigo', // Coluna padrão de ordenação
    'dir'            => $_GET['dir'] ?? 'ASC',    // Direção padrão
];

$resultado_empresas = $mes_selecionado_id ? obterEmpresasFiscalAdmin($conexao, $mes_selecionado_id, $filtros) : null;
$empresas = $resultado_empresas ? $resultado_empresas->fetch_all(MYSQLI_ASSOC) : [];
// =======================================================================
// == CÁLCULO DETALHADO DE STATUS (SUBSTITUIR LÓGICA ANTERIOR) ==
// =======================================================================
// =======================================================================
// == CÁLCULO DE STATUS DETALHADO (ATUALIZADO COM JANEIRO/2026) ==
// =======================================================================

// 1. Colunas Padrão (Todo mês)
// 1. Colunas Padrão
$colunas_monitoradas = [
    'reinf'             => 'REINF',
    'impostos'          => 'Impostos',
    'iss'               => 'ISS',
    'mit'               => 'MIT',
    'sped_fiscal'       => 'Sped Fiscal',
    'sped_contribuicao' => 'Sped Contrib.',
    'destda'            => 'Destda'
];
if ($is_maio) {
    $colunas_monitoradas['alteracoes_pasta'] = 'Alterações Pasta';
}
// Só adiciona GIA se estiver no período permitido (Até Dez/2025)
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
$empresas_100 = 0;

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
        $empresas_100++; // CORREÇÃO: Mudado de $empresas_100_porcento para $empresas_100
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
// =======================================================================
$responsaveis_disponiveis = obterResponsaveisFiscal($conexao);
// =======================================================================
// == CÁLCULO DE VENCIMENTOS (MODO TOTAL: SEM FILTROS DE SETOR OU STATUS) ==
// =======================================================================
$certificados_a_vencer = 0;
$procuracoes_a_vencer = 0;
$empresas_certificados_vencendo = [];
$empresas_procuracoes_vencendo = [];

$alerta_certificado_iminente = false;
$alerta_procuracao_iminente = false;

$hoje_obj = new DateTime('today');
$limite_vencimento_obj = (new DateTime('today'))->modify('+30 days');

// QUERY "LIMPA":
// 1. A Subquery (IN) agrupa por CNPJ e pega o MAX(id). Isso resolve o problema de duplicar meses.
//    Ele pega estritamente o último lançamento feito para aquele CNPJ, não importa o mês.
// 2. Removemos WHERE setores_permitidos. Agora pega Fiscal, DP, Contábil, tudo.
// 3. Removemos verificação de data_saida. Agora pega ativas e inativas.

$query_vencimentos = "
    SELECT 
        empresa,
        cnpj,
        grupo,
        data_vencimento_certificado,
        data_procuracao_target
    FROM controle_fechamento
    WHERE id IN (
        SELECT MAX(id)
        FROM controle_fechamento
        WHERE cnpj IS NOT NULL AND cnpj != ''
        GROUP BY cnpj
    )
    AND (
        (data_vencimento_certificado IS NOT NULL AND data_vencimento_certificado <> '0000-00-00') 
        OR 
        (data_procuracao_target IS NOT NULL AND data_procuracao_target <> '0000-00-00')
    )
";

$stmt_vencimentos = $conexao->prepare($query_vencimentos);
$stmt_vencimentos->execute();
$resultado_vencimentos = $stmt_vencimentos->get_result();
$empresas_com_vencimentos = $resultado_vencimentos->fetch_all(MYSQLI_ASSOC);
$stmt_vencimentos->close();

foreach ($empresas_com_vencimentos as $empresa_vencimento) {

    // --- LÓGICA CERTIFICADOS ---
    if (!empty($empresa_vencimento['data_vencimento_certificado']) && $empresa_vencimento['data_vencimento_certificado'] != '0000-00-00') {
        try {
            $data_vencimento_cert = new DateTime($empresa_vencimento['data_vencimento_certificado']);
            $intervalo = $hoje_obj->diff($data_vencimento_cert);

            // Calcula dias (negativo se já venceu)
            $dias_restantes = (int)$intervalo->days;
            if ($intervalo->invert) {
                $dias_restantes = $dias_restantes * -1;
            }

            // Define categoria para o filtro do modal
            $categoria = ($dias_restantes < 0) ? 'vencido' : 'nao_vencido';

            $certificados_a_vencer++;

            // Alerta visual no card se estiver vencido ou vencendo em 30 dias
            if ($dias_restantes < 30) {
                $alerta_certificado_iminente = true;
            }

$empresas_certificados_vencendo[] = [
    'empresa' => $empresa_vencimento['empresa'],
    'grupo' => $empresa_vencimento['grupo'] ?? '',
    'data_vencimento' => formatarDataBR($empresa_vencimento['data_vencimento_certificado']),
    'dias_restantes' => $dias_restantes,
    'categoria' => $categoria
];
        } catch (Exception $e) {
        }
    }

    // --- LÓGICA PROCURAÇÕES ---
    if (!empty($empresa_vencimento['data_procuracao_target']) && $empresa_vencimento['data_procuracao_target'] != '0000-00-00') {
        try {
            $data_vencimento_proc = new DateTime($empresa_vencimento['data_procuracao_target']);
            $intervalo = $hoje_obj->diff($data_vencimento_proc);

            $dias_restantes = (int)$intervalo->days;
            if ($intervalo->invert) {
                $dias_restantes = $dias_restantes * -1;
            }

            $categoria = ($dias_restantes < 0) ? 'vencido' : 'nao_vencido';

            $procuracoes_a_vencer++;

            if ($dias_restantes < 30) {
                $alerta_procuracao_iminente = true;
            }

            $empresas_procuracoes_vencendo[] = [
                'empresa' => $empresa_vencimento['empresa'],
                'data_vencimento' => formatarDataBR($empresa_vencimento['data_procuracao_target']),
                'dias_restantes' => $dias_restantes,
                'categoria' => $categoria
            ];
        } catch (Exception $e) {
        }
    }
}

// Ordenação: Do mais antigo/vencido para o mais futuro
$compararPorDias = function ($a, $b) {
    return $a['dias_restantes'] <=> $b['dias_restantes'];
};
usort($empresas_certificados_vencendo, $compararPorDias);
usort($empresas_procuracoes_vencendo, $compararPorDias);
function generateSortLink($current_filters, $column, $current_sort, $current_dir)
{
    $new_dir = 'ASC';
    $arrow = 'fa-sort';

    if ($current_sort === $column) {
        $new_dir = $current_dir === 'ASC' ? 'DESC' : 'ASC';
        $arrow = $current_dir === 'ASC' ? 'fa-sort-up' : 'fa-sort-down';
    }

    // Constrói os parâmetros da URL mantendo os filtros atuais
    $params = array_merge($current_filters, ['sort' => $column, 'dir' => $new_dir]);
    $link = 'fiscal_admin.php?' . http_build_query($params);

    return "<a href=\"{$link}\" class=\"sort-link\" style=\"text-decoration:none; color:inherit;\"><i class=\"fas {$arrow}\"></i></a>";
}
// =======================================================================
// == CÁLCULO DE MOVIMENTAÇÃO (CORRIGIDO PELO MÊS SELECIONADO) ==
// =======================================================================
$movimentacao = [
    'entrou_mes'   => [],
    'saiu_mes'     => [],
    'entra_futuro' => [],
    'sai_futuro'   => []
];

if ($mes_selecionado_id) {
    // 1. Descobrir qual mês/ano o usuário selecionou no filtro
    $stmt_info_mes = $conexao->prepare("SELECT mes, ano FROM controle_meses WHERE id = ?");
    $stmt_info_mes->bind_param('i', $mes_selecionado_id);
    $stmt_info_mes->execute();
    $res_info = $stmt_info_mes->get_result()->fetch_assoc();
    $stmt_info_mes->close();

    if ($res_info) {
        $mes_ref = (int)$res_info['mes'];
        $ano_ref = (int)$res_info['ano'];

        // Define o último dia do mês selecionado para calcular "Futuro"
        // Ex: Se selecionou Outubro/2025, o fim é 31/10/2025
        $fim_mes_selecionado = new DateTime("$ano_ref-$mes_ref-01");
        $fim_mes_selecionado->modify('last day of this month');
        $fim_mes_selecionado->setTime(23, 59, 59);

        // 2. Buscar dados das empresas
        $query_mov = "SELECT id, empresa, codigo, data_contrato, data_saida FROM controle_fechamento WHERE id_mes = ?";
        $stmt_mov = $conexao->prepare($query_mov);
        $stmt_mov->bind_param('i', $mes_selecionado_id);
        $stmt_mov->execute();
        $result_mov = $stmt_mov->get_result();

        while ($row = $result_mov->fetch_assoc()) {
            // --- Análise de Entrada (data_contrato) ---
            if (!empty($row['data_contrato']) && $row['data_contrato'] !== '0000-00-00') {
                try {
                    $dt_entrada = new DateTime($row['data_contrato']);
                    // Zera hora para comparação justa
                    $dt_entrada->setTime(0, 0, 0);

                    // Entrou EXATAMENTE no mês/ano selecionado?
                    if ((int)$dt_entrada->format('m') === $mes_ref && (int)$dt_entrada->format('Y') === $ano_ref) {
                        $movimentacao['entrou_mes'][] = $row;
                    }
                    // Vai entrar DEPOIS do mês selecionado?
                    elseif ($dt_entrada > $fim_mes_selecionado) {
                        $movimentacao['entra_futuro'][] = $row;
                    }
                } catch (Exception $e) {
                }
            }

            // --- Análise de Saída (data_saida) ---
            if (!empty($row['data_saida']) && $row['data_saida'] !== '0000-00-00') {
                try {
                    $dt_saida = new DateTime($row['data_saida']);
                    $dt_saida->setTime(0, 0, 0);

                    // Saiu EXATAMENTE no mês/ano selecionado?
                    if ((int)$dt_saida->format('m') === $mes_ref && (int)$dt_saida->format('Y') === $ano_ref) {
                        $movimentacao['saiu_mes'][] = $row;
                    }
                    // Vai sair DEPOIS do mês selecionado?
                    elseif ($dt_saida > $fim_mes_selecionado) {
                        $movimentacao['sai_futuro'][] = $row;
                    }
                } catch (Exception $e) {
                }
            }
        }
        $stmt_mov->close();
    }
}
?>
<!DOCTYPE html>
<html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gestão Fiscal</title>
    <link rel="stylesheet" href="assets/css/fiscal.css?v=<?= filemtime('assets/css/fiscal.css') ?>">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/contabil.css">
    <style>
        /* --- NOVAS CORES DE STATUS --- */
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
            /* Remove padding da célula para o select caber todo */
            margin: 0 !important;
        }

        .iss-select {
            width: 100%;
            height: 100%;
            border: none;
            /* Remove borda para parecer parte da tabela */
            background: transparent;
            cursor: pointer;
            font-size: 0.9rem;
            padding: 5px;
            color: #333;
        }

        .iss-select:focus {
            outline: none;
            background-color: #e8f0fe;
            /* Corzinha leve ao clicar */
        }

        .detail-card {
            background: #fff;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
            margin-bottom: 20px;
        }

        .detail-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
        }

        .detail-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            /* Colunas responsivas */
            gap: 15px;
        }

        .detail-item {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 6px;
            border: 1px solid #e9ecef;
        }

        .detail-title {
            font-size: 0.85rem;
            font-weight: 600;
            color: #555;
            margin-bottom: 5px;
            display: flex;
            justify-content: space-between;
        }

        .mini-progress {
            height: 6px;
            background: #ddd;
            border-radius: 3px;
            overflow: hidden;
        }

        .mini-fill {
            height: 100%;
            transition: width 0.5s;
        }

        /* Cores */
        .fill-red {
            background-color: #dc3545;
        }

        .fill-yellow {
            background-color: #ffc107;
        }

        .fill-green {
            background-color: #198754;
        }

        .reinf-trigger {
            cursor: pointer;
            transition: background-color 0.3s;
        }

        .reinf-trigger:hover {
            background-color: rgba(0, 0, 0, 0.05);
        }

        /* Garante que o cabeçalho fique fixo no topo ao rolar para baixo também */
        .data-table thead th {
            position: -webkit-sticky;
            position: sticky;
            top: 0;
            z-index: 3;
        }

        .impostos-trigger {
            cursor: pointer;
            transition: background-color 0.3s;
        }

        .impostos-trigger:hover {
            background-color: rgba(0, 0, 0, 0.05);
        }

        .sticky-col {
            position: -webkit-sticky;
            position: sticky;
            background-color: var(--card-bg-color, #fff);
        }

        /* Garante que o CABEÇALHO FIXO fique por cima de TUDO */
        .data-table thead .sticky-col {
            z-index: 4;
            /* O z-index mais alto para a intersecção */
        }

        /* Garante que as CÉLULAS FIXAS DO CORPO fiquem na camada do meio */
        .data-table tbody .sticky-col {
            z-index: 2;
        }

        /* Posição horizontal de cada coluna (isso não muda) */
        .first-col {
            left: 0;
        }

        .second-col {
            left: 80px;
        }

        .third-col {
            left: 330px;
        }

        .fourth-col {
            left: 450px;
            border-right: 2px solid #dee2e6;
        }

        /* Correção de alinhamento da tabela: somente Código e Empresa ficam fixos. */
        .data-table {
            width: max-content;
            min-width: 100%;
            table-layout: auto;
            border-collapse: separate;
            border-spacing: 0;
        }

        .data-table th,
        .data-table td {
            box-sizing: border-box;
            white-space: nowrap;
        }

        .data-table thead th {
            overflow: visible;
        }

        /* --- FIM DO CÓDIGO CORRIGIDO --- */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

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

        .filter-group label {
            margin-bottom: 5px;
            font-weight: 500;
            font-size: 0.9em;
        }

        .filter-buttons-action {
            display: flex;
            gap: 10px;
        }

        .table-container {
            overflow-x: auto;
        }

        .data-table td.editable {
            cursor: pointer;
        }

        .data-table td[contenteditable="true"]:focus {
            background-color: #e8f0fe;
            outline: 2px solid #1a73e8;
        }

        /* --- ESTILOS PARA FILTROS DE COLUNA (ESTILO EXCEL) --- */
        .filterable-header {
            position: relative;
            padding-right: 30px !important;
        }

        .filterable-header .filter-icon-wrapper {
            position: absolute;
            top: 50%;
            right: 5px;
            transform: translateY(-50%);
            cursor: pointer;
            padding: 5px;
            color: #ccc;
            transition: color 0.3s ease;
        }

        .filterable-header:hover .filter-icon-wrapper,
        .filterable-header .filter-icon-wrapper.active {
            color: var(--primary-color, #007bff);
        }

        /* Container Principal do Dropdown */
        .filter-dropdown {
            display: flex !important;
            flex-direction: column !important;
            max-height: 400px !important;
            /* Altura máxima total */
            min-height: 150px;
            /* Garante um tamanho mínimo */
            position: absolute;
            top: 100%;
            left: 0;
            background-color: #fff;
            border: 1px solid #bbb;
            border-radius: 4px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
            z-index: 1000;
            width: 280px;
            font-family: sans-serif;
            color: #333;
            padding-bottom: 0 !important;
            /* AQUI ESTAVA O ERRO: overflow hidden cortava a lista */
            overflow: visible !important;
        }

        /* Área do Topo (Busca e Select All) */
        .filter-header-area {
            padding: 10px;
            background-color: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
            flex-shrink: 0;
            /* Impede que o topo encolha */
        }

        .filter-dropdown-search {
            width: 100%;
            padding: 6px 10px;
            margin-bottom: 8px;
            border: 1px solid #ced4da;
            border-radius: 3px;
            font-size: 0.9em;
        }

        .filter-select-all-label {
            display: block;
            font-weight: 600;
            font-size: 0.9em;
            margin: 0;
            cursor: pointer;
            user-select: none;
        }

        /* Área da Lista (Scrollável) */
        .filter-dropdown-options {
            flex-grow: 1;
            /* Ocupa todo o espaço restante */
            overflow-y: auto !important;
            /* FORÇA a barra de rolagem */
            padding: 5px 0;
            background-color: #fff;
            max-height: 250px;
            /* Limite específico para a lista */
            margin-bottom: 45px;
            /* Espaço para o rodapé não cobrir o último item */
        }

        /* Estilização da barra de rolagem para ficar visível */
        .filter-dropdown-options::-webkit-scrollbar {
            width: 8px;
        }

        .filter-dropdown-options::-webkit-scrollbar-track {
            background: #f1f1f1;
        }

        .filter-dropdown-options::-webkit-scrollbar-thumb {
            background: #888;
            border-radius: 4px;
        }

        .filter-dropdown-options label {
            display: block;
            padding: 5px 15px;
            cursor: pointer;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-size: 0.9em;
            font-weight: normal;
            user-select: none;
            margin: 0;
        }

        .filter-dropdown-options label:hover {
            background-color: #e9ecef;
        }

        .filter-dropdown-options input[type="checkbox"] {
            margin-right: 8px;
            vertical-align: middle;
        }

        /* Rodapé Fixo (Botões) */
        .filter-footer-area {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 45px;
            background-color: #f1f1f1;
            border-top: 1px solid #ddd;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 10px;
            z-index: 10;
            /* Fica acima da lista ao rolar */
        }

        .btn-filter-action {
            border: 1px solid transparent;
            padding: 4px 12px;
            font-size: 0.85rem;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .btn-filter-clear {
            background-color: transparent;
            border: 1px solid #ccc;
            color: #555;
        }

        .btn-filter-clear:hover {
            background-color: #e2e6ea;
        }

        .btn-filter-apply {
            background-color: #0d6efd;
            color: #fff;
        }

        .btn-filter-apply:hover {
            background-color: #0b5ed7;
        }

        /* ======================================================= */
        /* == ESTILOS DOS CARDS DE AVISO (ADICIONADOS) == */
        /* ======================================================= */
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

        .stats-box p {
            font-size: 0.9rem;
            color: var(--text-muted-color);
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

        /* BARRA DE PROGRESSO - STATUS MENSAL */
        .progress-container {
            background: #fff;
            padding: 15px 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        }

        .progress-bar-bg {
            height: 25px;
            background-color: #e9ecef;
            border-radius: 12px;
            overflow: hidden;
            margin-top: 10px;
        }

        .progress-fill {
            height: 100%;
            text-align: center;
            line-height: 25px;
            color: white;
            font-weight: bold;
            font-size: 0.85rem;
            transition: width 0.6s ease;
        }

        /* Cores Dinâmicas */
        .bg-danger {
            background-color: #dc3545;
        }

        .bg-warning {
            background-color: #ffc107;
            color: #000;
        }

        .bg-success {
            background-color: #198754;
        }

        /* Ajuste para alinhar ícones e texto */
        .progress-container h5 {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        /* PAINEL DE STATUS */
        .status-panel {
            background: #fff;
            border-radius: 8px;
            padding: 15px 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .status-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 600;
            color: #444;
        }

        .progress-track {
            background-color: #e9ecef;
            height: 12px;
            border-radius: 6px;
            overflow: hidden;
            width: 100%;
        }

        .progress-bar-fill {
            height: 100%;
            transition: width 0.6s ease;
            border-radius: 6px;
        }

        /* Cores de status */
        .fill-danger {
            background-color: #dc3545;
        }

        .fill-warning {
            background-color: #ffc107;
        }

        .fill-success {
            background-color: #198754;
        }

        .status-metrics {
            display: flex;
            gap: 20px;
            font-size: 0.85rem;
            color: #666;
        }

        .metric-item strong {
            color: #222;
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
    
        /* CORRECAO: celula bloqueada deve continuar ocupando espaco */
        .data-table tbody td.non-editable {
            display: table-cell !important;
            visibility: visible !important;
            opacity: 1 !important;
            position: static !important;
            min-width: 120px !important;
        }

        .data-table tbody td[data-coluna="carne_leao"] {
            display: table-cell !important;
            visibility: visible !important;
            min-width: 120px !important;
            width: 120px !important;
            max-width: 120px !important;
            box-sizing: border-box !important;
            text-align: center !important;
        }

        .data-table thead th[data-coluna="carne_leao"] {
            min-width: 120px !important;
            width: 120px !important;
            max-width: 120px !important;
            box-sizing: border-box !important;
        }
</style>
</head>

<body>
    <?php
    function renderModalMovimentacao($id, $titulo, $icone, $lista, $tipo_data)
    {
    ?>
        <div id="<?= $id ?>" class="modal-overlay">
            <div class="modal-container" style="width: 600px;">
                <div class="modal-header">
                    <h3 class="modal-title"><i class="fas <?= $icone ?>"></i> <?= $titulo ?></h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <?php if (!empty($lista)) : ?>
                        <div style="max-height: 400px; overflow-y: auto;">
                            <table class="modal-table table table-striped table-hover table-sm">
                                <thead style="position: sticky; top: 0; background: white;">
                                    <tr>
                                        <th>Cód.</th>
                                        <th>Empresa</th>
                                        <th>Data <?= ucfirst($tipo_data) ?></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php foreach ($lista as $emp) :
                                        $data_exib = ($tipo_data == 'entrada') ? $emp['data_contrato'] : $emp['data_saida'];
                                    ?>
                                        <tr>
                                            <td><strong><?= htmlspecialchars($emp['codigo']) ?></strong></td>
                                            <td><?= htmlspecialchars($emp['empresa']) ?></td>
                                            <td><?= date('d/m/Y', strtotime($data_exib)) ?></td>
                                        </tr>
                                    <?php endforeach; ?>
                                </tbody>
                            </table>
                        </div>
                    <?php else : ?>
                        <div class="empty-message text-center p-4">
                            <i class="fas fa-info-circle fa-2x text-muted mb-2"></i>
                            <p class="text-muted">Nenhuma empresa nesta categoria para o período.</p>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    <?php }

    // Gera os 4 modais escondidos
    renderModalMovimentacao('modalEntrouMes', 'Entradas no Mês Selecionado', 'fa-sign-in-alt', $movimentacao['entrou_mes'], 'entrada');
    renderModalMovimentacao('modalSaiuMes', 'Saídas no Mês Selecionado', 'fa-sign-out-alt', $movimentacao['saiu_mes'], 'saída');
    renderModalMovimentacao('modalEntraFuturo', 'Entradas Futuras (Pós Mês Selecionado)', 'fa-clock', $movimentacao['entra_futuro'], 'entrada');
    renderModalMovimentacao('modalSaiFuturo', 'Saídas Futuras (Pós Mês Selecionado)', 'fa-history', $movimentacao['sai_futuro'], 'saída');
    ?>
    <div id="modalCertificadosVencendo" class="modal-overlay">
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-exclamation-triangle"></i> Gestão de Certificados</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
<div class="mb-3" style="background: #f8f9fa; padding: 12px; border-radius: 5px;">
    <div class="row g-2 align-items-end">
        <div class="col-md-4">
            <label class="fw-bold mb-1"><i class="fas fa-filter"></i> Situação:</label>
            <select class="form-select form-select-sm" id="filtro-situacao-certificados" onchange="filtrarCertificados()">
                <option value="todos">Todos</option>
                <option value="vencido">Apenas Vencidos</option>
                <option value="nao_vencido">A Vencer (Futuro)</option>
            </select>
        </div>

        <div class="col-md-4">
            <label class="fw-bold mb-1"><i class="fas fa-building"></i> Empresa:</label>
            <input type="text" class="form-control form-control-sm" id="filtro-empresa-certificados" placeholder="Digite a empresa..." onkeyup="filtrarCertificados()">
        </div>

        <div class="col-md-4">
            <label class="fw-bold mb-1"><i class="fas fa-layer-group"></i> Grupo:</label>
            <select class="form-select form-select-sm" id="filtro-grupo-certificados" onchange="filtrarCertificados()">
                <option value="todos">Todos os grupos</option>
                <?php
                $grupos_certificados = array_unique(array_filter(array_map(function($item) {
                    return trim($item['grupo'] ?? '');
                }, $empresas_certificados_vencendo)));
                sort($grupos_certificados);

                foreach ($grupos_certificados as $grupo) :
                ?>
                    <option value="<?= htmlspecialchars($grupo) ?>"><?= htmlspecialchars($grupo) ?></option>
                <?php endforeach; ?>
            </select>
        </div>
    </div>
</div>

                <?php if (!empty($empresas_certificados_vencendo)) : ?>
                    <div style="max-height: 400px; overflow-y: auto;">
                       <table class="modal-table table table-hover" id="tabela-certificados">
    <thead style="position: sticky; top: 0; background: white; z-index: 1;">
        <tr>
            <th>Empresa</th>
            <th>Grupo</th>
            <th>Data Vencimento</th>
            <th>Situação</th>
        </tr>
    </thead>
    <tbody>
        <?php foreach ($empresas_certificados_vencendo as $item) : ?>
            <tr
                data-category="<?= htmlspecialchars($item['categoria']) ?>"
                data-empresa="<?= htmlspecialchars(mb_strtolower($item['empresa'])) ?>"
                data-grupo="<?= htmlspecialchars(mb_strtolower($item['grupo'] ?? '')) ?>"
            >
                <td><?= htmlspecialchars($item['empresa']) ?></td>
                <td><?= htmlspecialchars($item['grupo'] ?? '-') ?></td>
                <td><?= htmlspecialchars($item['data_vencimento']) ?></td>
                <td>
                    <?php
                    $dias = $item['dias_restantes'];
                    if ($dias < 0) {
                        echo '<span class="badge bg-danger">Vencido há ' . abs($dias) . ' dias</span>';
                    } elseif ($dias <= 7) {
                        echo '<span class="badge bg-danger">Vence em ' . $dias . ' dias</span>';
                    } elseif ($dias <= 30) {
                        echo '<span class="badge bg-warning text-dark">Vence em ' . $dias . ' dias</span>';
                    } else {
                        echo '<span class="badge bg-success">Vence em ' . $dias . ' dias</span>';
                    }
                    ?>
                </td>
            </tr>
        <?php endforeach; ?>
    </tbody>
</table>
                    </div>
                <?php else : ?>
                    <div class="empty-message">
                        <i class="fas fa-check-circle"></i>
                        <p>Nenhum certificado cadastrado com data de validade.</p>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    </div>

    <div id="modalProcuracoesVencendo" class="modal-overlay">
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-user-clock"></i> Gestão de Procurações</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">

                <div class="mb-3 d-flex align-items-center gap-2" style="background: #f8f9fa; padding: 10px; border-radius: 5px;">
                    <label class="fw-bold"><i class="fas fa-filter"></i> Filtrar:</label>
                    <select class="form-select form-select-sm" onchange="filtrarVencimentos(this, 'tabela-procuracoes')">
                        <option value="todos">Todos (Vencidos e A Vencer)</option>
                        <option value="vencido">Apenas Vencidos</option>
                        <option value="nao_vencido">A Vencer (Futuro)</option>
                    </select>
                </div>

                <?php if (!empty($empresas_procuracoes_vencendo)) : ?>
                    <div style="max-height: 400px; overflow-y: auto;">
                        <table class="modal-table table table-hover" id="tabela-procuracoes">
                            <thead style="position: sticky; top: 0; background: white; z-index: 1;">
                                <tr>
                                    <th>Empresa</th>
                                    <th>Data Vencimento</th>
                                    <th>Situação</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($empresas_procuracoes_vencendo as $item) : ?>
                                    <tr data-category="<?= $item['categoria'] ?>">
                                        <td><?= htmlspecialchars($item['empresa']) ?></td>
                                        <td><?= htmlspecialchars($item['data_vencimento']) ?></td>
                                        <td>
                                            <?php
                                            $dias = $item['dias_restantes'];
                                            if ($dias < 0) {
                                                echo '<span class="badge bg-danger">Vencido há ' . abs($dias) . ' dias</span>';
                                            } elseif ($dias <= 7) {
                                                echo '<span class="badge bg-danger">Vence em ' . $dias . ' dias</span>';
                                            } elseif ($dias <= 30) {
                                                echo '<span class="badge bg-warning text-dark">Vence em ' . $dias . ' dias</span>';
                                            } else {
                                                echo '<span class="badge bg-success">Vence em ' . $dias . ' dias</span>';
                                            }
                                            ?>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                <?php else : ?>
                    <div class="empty-message">
                        <i class="fas fa-check-circle"></i>
                        <p>Nenhuma procuração cadastrada com data de validade.</p>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    </div>
    <header class="header">
        <h1><i class="fas fa-file-invoice-dollar"></i> Gestão Fiscal</h1>

        <div class="header-actions">
            <button id="abrir-modal-parcelamento-btn" class="btn btn-primary">
                <i class="fas fa-handshake"></i> Gerar Parcelamento
            </button>

            <?php if ($_SESSION['tipo_conta'] === 'admin') : ?>
                <a href="painel_lider.php?area=fiscal" class="btn btn-info">
                    <i class="fas fa-user-shield"></i> Painel Líder
                </a>
                <a href="dashboard.php" class="btn btn-secondary">
                    <i class="fas fa-arrow-left"></i> Painel Admin
                </a>
            <?php elseif ($_SESSION['tipo_conta'] === 'lider_fiscal') : ?>
                <a href="painel_lider.php" class="btn btn-secondary">
                    <i class="fas fa-arrow-left"></i> Voltar ao Painel
                </a>
            <?php endif; ?>
        </div>
    </header>
    <div class="main-content">
        <style>
            .stats-grid-6 {
                display: grid;
                /* 6 colunas iguais em telas grandes */
                grid-template-columns: repeat(6, 1fr);
                gap: 15px;
                margin-bottom: 20px;
            }

            /* Estilo unificado dos cards */
            .stat-card-item {
                border-radius: 8px;
                padding: 15px;
                text-align: center;
                position: relative;
                cursor: pointer;
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
                transition: transform 0.2s, box-shadow 0.2s;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                min-height: 140px;
                /* Altura mínima para alinhar */
                border: 1px solid rgba(0, 0, 0, 0.05);
            }

            .stat-card-item:hover {
                transform: translateY(-3px);
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
            }

            .stat-icon {
                margin-bottom: 10px;
            }

            .stat-title {
                font-size: 0.85rem;
                font-weight: 700;
                text-transform: uppercase;
                margin-bottom: 5px;
            }

            .stat-value {
                font-size: 2rem;
                font-weight: 800;
                line-height: 1.2;
            }

            .stat-footer {
                font-size: 0.7rem;
                margin-top: 10px;
                opacity: 0.8;
            }

            /* Responsividade: Quebra linhas em telas menores */
            @media (max-width: 1400px) {
                .stats-grid-6 {
                    grid-template-columns: repeat(3, 1fr);
                }
            }

            /* 3 por linha */
            @media (max-width: 768px) {
                .stats-grid-6 {
                    grid-template-columns: repeat(2, 1fr);
                }
            }

            /* 2 por linha */
            @media (max-width: 576px) {
                .stats-grid-6 {
                    grid-template-columns: 1fr;
                }
            }

            /* 1 por linha */
        </style>

        <h5 class="mb-3 text-muted"><i class="fas fa-chart-pie"></i> Visão Geral</h5>

        <div class="stats-grid-6">

            <div class="stat-card-item" id="btnEntrouMes" style="background: #e8f5e9; color: #198754;">
                <div class="stat-icon"><i class="fas fa-sign-in-alt fa-2x"></i></div>
                <div class="stat-title">Entraram (Mês)</div>
                <div class="stat-value"><?= count($movimentacao['entrou_mes']) ?></div>
                <div class="stat-footer"><i class="fas fa-list"></i> Ver Detalhes</div>
            </div>

            <div class="stat-card-item" id="btnSaiuMes" style="background: #ffebee; color: #dc3545;">
                <div class="stat-icon"><i class="fas fa-sign-out-alt fa-2x"></i></div>
                <div class="stat-title">Saíram (Mês)</div>
                <div class="stat-value"><?= count($movimentacao['saiu_mes']) ?></div>
                <div class="stat-footer"><i class="fas fa-list"></i> Ver Detalhes</div>
            </div>

            <div class="stat-card-item" id="btnEntraFuturo" style="background: #f8f9fa; color: #6c757d;">
                <div class="stat-icon"><i class="fas fa-clock fa-2x"></i></div>
                <div class="stat-title">Vão Entrar</div>
                <div class="stat-value text-dark"><?= count($movimentacao['entra_futuro']) ?></div>
                <div class="stat-footer">Futuramente</div>
            </div>

            <div class="stat-card-item" id="btnSaiFuturo" style="background: #fff3e0; color: #fd7e14;">
                <div class="stat-icon"><i class="fas fa-history fa-2x"></i></div>
                <div class="stat-title">Vão Sair</div>
                <div class="stat-value text-dark"><?= count($movimentacao['sai_futuro']) ?></div>
                <div class="stat-footer">Futuramente</div>
            </div>

            <div class="stat-card-item" id="btnCertificadosVencendo"
                style="background: <?= $alerta_certificado_iminente ? '#fff3cd' : '#fff' ?>; color: #b08d05; border: 1px solid #ffecb5;">
                <div class="stat-icon">
                    <?php if ($alerta_certificado_iminente): ?>
                        <i class="fas fa-exclamation-triangle fa-2x text-danger"></i>
                    <?php else: ?>
                        <i class="fas fa-id-card fa-2x"></i>
                    <?php endif; ?>
                </div>
                <div class="stat-title">Certificados</div>
                <div class="stat-value"><?= $certificados_a_vencer ?></div>
                <div class="stat-footer">
                    <?php if ($certificados_a_vencer > 0): ?>
                        <a href="exportar_certificados.php" class="text-decoration-none fw-bold" onclick="event.stopPropagation();" style="color: inherit;">
                            <i class="fas fa-download"></i> Baixar Excel
                        </a>
                    <?php else: ?>
                        Regular
                    <?php endif; ?>
                </div>
            </div>

            <div class="stat-card-item" id="btnProcuracoesVencendo"
                style="background: <?= $alerta_procuracao_iminente ? '#fff3cd' : '#fff' ?>; color: #0dcaf0; border: 1px solid #bee5eb;">
                <div class="stat-icon">
                    <?php if ($alerta_procuracao_iminente): ?>
                        <i class="fas fa-exclamation-circle fa-2x text-danger"></i>
                    <?php else: ?>
                        <i class="fas fa-user-clock fa-2x text-info"></i>
                    <?php endif; ?>
                </div>
                <div class="stat-title" style="color: #055160;">Procurações</div>
                <div class="stat-value" style="color: #055160;"><?= $procuracoes_a_vencer ?></div>
                <div class="stat-footer" style="color: #055160;">
                    <?php if ($procuracoes_a_vencer > 0): ?>
                        <a href="exportar_procuracoes.php" class="text-decoration-none fw-bold" onclick="event.stopPropagation();" style="color: inherit;">
                            <i class="fas fa-download"></i> Baixar Excel
                        </a>
                    <?php else: ?>
                        Regular
                    <?php endif; ?>
                </div>
            </div>
        </div>
        <div class="detail-card">
            <div class="detail-header">
                <div>
                    <h5 style="margin:0; color:#333;"><i class="fas fa-tasks"></i> Status Detalhado do Mês</h5>
                    <small class="text-muted">Progresso Geral: <strong><?= $porcentagem_geral ?>%</strong> (<?= $empresas_100 ?> empresas concluídas)</small>
                </div>

                <div style="width: 200px;">
                    <div class="progress" style="height: 10px;">
                        <?php
                        $cor_geral = 'bg-danger';
                        if ($porcentagem_geral >= 50) $cor_geral = 'bg-warning';
                        if ($porcentagem_geral >= 90) $cor_geral = 'bg-success';
                        ?>
                        <div class="progress-bar <?= $cor_geral ?>" role="progressbar" style="width: <?= $porcentagem_geral ?>%"></div>
                    </div>
                </div>
            </div>

            <div class="detail-grid">
                <?php foreach ($stats_detalhadas as $key => $stat):
                    $total = $stat['total'];
                    $feitos = $stat['feitos'];
                    $perc = ($total > 0) ? round(($feitos / $total) * 100) : 0;

                    // Cor da mini barra
                    $mini_cor = 'fill-red';
                    if ($perc >= 50) $mini_cor = 'fill-yellow';
                    if ($perc >= 90) $mini_cor = 'fill-green';
                ?>
                    <div class="detail-item">
                        <div class="detail-title">
                            <span><?= $stat['label'] ?></span>
                            <span style="font-size: 0.8rem;"><?= $perc ?>%</span>
                        </div>

                        <div class="mini-progress">
                            <div class="mini-fill <?= $mini_cor ?>" style="width: <?= $perc ?>%;"></div>
                        </div>

                        <div style="font-size: 0.75rem; color: #777; margin-top: 5px; text-align: right;">
                            Feitos: <strong><?= $feitos ?></strong> / <?= $total ?>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>

        <div class="filter-panel">
            <form method="GET" action="fiscal_admin.php">
                <div class="filter-grid">
                    <div class="filter-group">
                        <label for="mes_id"><i class="fas fa-calendar-alt"></i> Mês de Referência</label>
                        <select id="mes_id" name="mes_id" class="form-select form-select-sm" onchange="this.form.submit()">
                            <?php if (empty($meses_disponiveis)) : ?>
                                <option>Nenhum mês encontrado</option>
                            <?php else : ?>
                                <?php foreach ($meses_disponiveis as $mes) : ?>
                                    <option value="<?= $mes['id'] ?>" <?= ($mes['id'] == $mes_selecionado_id) ? 'selected' : '' ?>><?= str_pad($mes['mes'], 2, '0', STR_PAD_LEFT) . '/' . $mes['ano'] ?></option>
                                <?php endforeach; ?>
                            <?php endif; ?>
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
                    <div class="filter-buttons-action">
                        <button type="submit" class="btn btn-primary btn-sm"><i class="fas fa-filter"></i> Filtrar</button>
                        <a href="fiscal_admin.php?mes_id=<?= $mes_selecionado_id ?>" class="btn btn-secondary btn-sm">Limpar</a>

                        <button type="button" id="btn-preparar-exportacao" class="btn btn-success btn-sm" data-mes-id="<?= $mes_selecionado_id ?>">
                            <i class="fas fa-file-excel"></i> Exportar
                        </button>
                    </div>
                </div>
            </form>
        </div>

        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="min-width: 80px;" class="sortable-header sticky-col first-col filterable-header">
                            <span>Código <?= generateSortLink($filtros, 'codigo', $filtros['sort'], $filtros['dir']) ?></span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>
                        <th style="min-width: 250px;" class="sortable-header sticky-col second-col filterable-header">
                            <span>Empresa <?= generateSortLink($filtros, 'empresa', $filtros['sort'], $filtros['dir']) ?></span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>
                        <th style="min-width: 120px;" class="filterable-header">
                            <span>Status</span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>
                        <th style="min-width: 200px;" class="filterable-header">
                            <span>Responsável</span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>
                        <th style="min-width: 180px;" class="filterable-header">
                            <span>CNPJ</span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>
                       <?php if ($is_maio): ?>
    <th style="min-width: 150px;" class="filterable-header">
        <span>Alterações Pasta</span>
        <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
    </th>
<?php endif; ?>
                        <th style="min-width: 200px;" class="filterable-header">
                            <span>Observações</span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>
                        <th style="min-width: 100px;" class="filterable-header">
                            <span>Grupo</span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>
                        <th style="min-width: 100px;" class="filterable-header">
                            <span>Tributação</span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>
                        <th style="min-width: 100px;" class="filterable-header">
                            <span>Município</span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>

                        <?php if ($is_janeiro): ?>
                            <th style="min-width: 100px; background-color: #e3f2fd; border-bottom: 2px solid #2196f3;">
                                <span>DASN MEI</span>
                            </th>

                            <th style="min-width: 100px; background-color: #e3f2fd; border-bottom: 2px solid #2196f3;">
                                <span>Taxa Fiscal</span>
                            </th>
                        <?php endif; ?>

                        <th style="min-width: 120px;" class="filterable-header">
                            <span>Insc.Estadual</span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>

                        <th style="min-width: 120px;" class="filterable-header">
                            <span>Insc.Municipal</span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>

                        <th style="min-width: 150px;" class="filterable-header">
                            <span>Login Prefeitura</span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>

                        <th style="min-width: 150px;" class="filterable-header">
                            <span>Senha Prefeitura</span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>

                        <th style="min-width: 150px;" class="filterable-header">
                            <span>Senha GISS Online</span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>

                        <th style="min-width: 150px;" class="filterable-header">
                            <span>Link Prefeitura</span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>

                        <th style="min-width: 80px;" class="filterable-header">
                            <span>Tipo</span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>

                        <th style="min-width: 80px;" class="filterable-header">
                            <span>Envio</span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>
                        
                        <?php if ($is_setembro_2026): ?>
                            <th style="min-width: 120px;"
                                class="filterable-header"
                                data-coluna="api_jettax">
                                <span>API JETTAX</span>
                                <div class="filter-icon-wrapper">
                                    <i class="fas fa-filter"></i>
                                </div>
                            </th>
                        <?php endif; ?>

                        <th style="min-width: 120px;"
                            class="filterable-header"
                            data-coluna="carne_leao">
                            <span>Carnê-Leão</span>
                            <div class="filter-icon-wrapper">
                                <i class="fas fa-filter"></i>
                            </div>
                        </th>
                        <th style="min-width: 150px;" class="filterable-header">
                            <span>REINF</span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>
                        <th style="min-width: 150px;" class="filterable-header">
                            <span>Impostos</span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>
                        <th style="min-width: 150px;" class="filterable-header">
                            <span>ISS</span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>
                        <th style="min-width: 150px;" class="filterable-header">
                            <span>MIT</span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>
                        <th style="min-width: 150px;" class="filterable-header">
                            <span>Sped Fiscal</span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>
                        <th style="min-width: 150px;" class="filterable-header">
                            <span>Sped Contrib.</span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>
                        <th style="min-width: 150px;" class="filterable-header">
                            <span>Destda</span>
                            <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                        </th>


                        <?php if ($exibir_gia): ?>
                            <th style="min-width: 150px;" class="filterable-header">
                                <span>GIA</span>
                                <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
                            </th>
                        <?php endif; ?>
        <?php if ($is_dezembro): ?>
    <th style="min-width: 150px;" class="filterable-header">
        <span>Dist. DIRF</span>
        <div class="filter-icon-wrapper"><i class="fas fa-filter"></i></div>
    </th>
<?php endif; ?>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($empresas)) : ?>
                    <?php else : ?>
                        <?php foreach ($empresas as $empresa) : ?>
                            <tr data-id="<?= $empresa['id']; ?>" data-id-mes="<?= $empresa['id_mes']; ?>">
                                <td class="sticky-col first-col"><?= htmlspecialchars($empresa['codigo']); ?></td>
                                <td class="sticky-col second-col"><?= htmlspecialchars($empresa['empresa']); ?></td>
                                <td><span class="status-badge"><?= htmlspecialchars($empresa['status_fiscal'] ?? 'Pendente'); ?></span></td>
                                <td>
                                    <select class="form-select form-select-sm select-responsavel">
                                        <option value="0">Nenhum</option>
                                        <?php foreach ($responsaveis_disponiveis as $responsavel) : ?>
                                            <option value="<?= $responsavel['id']; ?>" <?= ($responsavel['id'] == $empresa['responsavel_id']) ? 'selected' : ''; ?>><?= htmlspecialchars($responsavel['nome']); ?></option>
                                        <?php endforeach; ?>
                                    </select>
                                </td>
                                <td><?= htmlspecialchars($empresa['cnpj']); ?></td>
                       <?php if ($is_maio): ?>
    <td data-coluna="alteracoes_pasta">
        <select class="form-select form-select-sm editable-select">
            <option value="Pendente" <?= ($empresa['alteracoes_pasta'] ?? 'Pendente') === 'Pendente' ? 'selected' : '' ?>>
                Pendente
            </option>
            <option value="Concluído" <?= ($empresa['alteracoes_pasta'] ?? '') === 'Concluído' ? 'selected' : '' ?>>
                Concluído
            </option>
        </select>
    </td>
<?php endif; ?>
                                <td class="editable" contenteditable="true" data-coluna="observacoes_fiscal"><?= htmlspecialchars($empresa['observacoes_fiscal'] ?? ''); ?></td>
                                <td><?= htmlspecialchars($empresa['grupo'] ?? ''); ?></td>
                                <td><?= htmlspecialchars($empresa['tributacao']); ?></td>
                                <td><?= htmlspecialchars($empresa['municipio'] ?? ''); ?></td>

                                <?php if ($is_janeiro): ?>
                                    <?php
                                    $trib = mb_strtolower(
                                        trim($empresa['tributacao'] ?? '')
                                    );

                                    $isMei = (
                                        strpos($trib, 'mei') !== false
                                    );

                                    $isSimples = (
                                        strpos($trib, 'simples') !== false ||
                                        strpos($trib, 'nacional') !== false
                                    );
                                    ?>

                                    <?php if ($isMei): ?>
                                        <td
                                            class="editable"
                                            contenteditable="true"
                                            data-coluna="dasnmei"
                                            style="background-color: #fff;"
                                        >
                                            <?= htmlspecialchars($empresa['dasnmei'] ?? '') ?>
                                        </td>
                                    <?php else: ?>
                                        <td
                                            class="text-center"
                                            style="background-color: #f0f0f0; color: #999; cursor: not-allowed;"
                                        >
                                            N/A
                                        </td>
                                    <?php endif; ?>

                                    <?php if (!$isMei && !$isSimples): ?>
                                        <td
                                            class="editable"
                                            contenteditable="true"
                                            data-coluna="taxa_fiscal"
                                            style="background-color: #fff;"
                                        >
                                            <?= htmlspecialchars($empresa['taxa_fiscal'] ?? '') ?>
                                        </td>
                                    <?php else: ?>
                                        <td
                                            class="text-center"
                                            style="background-color: #f0f0f0; color: #999; cursor: not-allowed;"
                                        >
                                            N/A
                                        </td>
                                    <?php endif; ?>
                                <?php endif; ?>

                                <td>
                                    <?= htmlspecialchars($empresa['insc_estadual'] ?? '') ?>
                                </td>

                                <td>
                                    <?= htmlspecialchars($empresa['insc_municipal'] ?? '') ?>
                                </td>

                                <td>
                                    <?= htmlspecialchars($empresa['login_prefeitura'] ?? '') ?>
                                </td>

                                <td>
                                    <?= htmlspecialchars($empresa['senha_prefeitura_ginfes'] ?? '') ?>
                                </td>

                                <td>
                                    <?= htmlspecialchars($empresa['senha_giss_online'] ?? '') ?>
                                </td>

                                <td>
                                    <?= htmlspecialchars($empresa['link_prefeitura'] ?? '') ?>
                                </td>

                                <td>
                                    <?= htmlspecialchars($empresa['tipo'] ?? '') ?>
                                </td>

                                <td>
                                    <?= htmlspecialchars($empresa['envio'] ?? '') ?>
                                </td>

                                <?php if ($is_setembro_2026): ?>
                                    <td>
                                        <select class="form-select form-select-sm salvar-select"
                                                data-coluna="api_jettax"
                                                data-id="<?= $empresa['id'] ?>">
                                            <option value="" <?= empty($empresa['api_jettax']) ? 'selected' : '' ?>></option>
                                            <option value="Sim" <?= ($empresa['api_jettax'] ?? '') == 'Sim' ? 'selected' : '' ?>>Sim</option>
                                            <option value="Não" <?= ($empresa['api_jettax'] ?? '') == 'Não' ? 'selected' : '' ?>>Não</option>
                                        </select>
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
                                        strpos(
                                            $statusCarneLeao,
                                            'Pendência'
                                        ) === 0 ||
                                        strpos(
                                            $statusCarneLeao,
                                            'Pendente ('
                                        ) === 0
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
                                    <?php renderizarBadge($empresa['iss'] ?? ''); ?>
                                </td>

                                <td class="generic-modal-trigger text-center" data-coluna="mit" data-titulo="MIT" style="cursor: pointer;">
                                    <?php renderizarBadge($empresa['mit'] ?? ''); ?>
                                </td>

                                <td class="generic-modal-trigger text-center" data-coluna="sped_fiscal" data-titulo="Sped Fiscal" style="cursor: pointer;">
                                    <?php renderizarBadge($empresa['sped_fiscal'] ?? ''); ?>
                                </td>

                                <?php if ($is_dezembro): ?>
                                    <td class="sped-anual-trigger text-center" data-coluna="sped_contribuicao" style="cursor: pointer;">
                                        <?php
                                        $valSped = htmlspecialchars($empresa['sped_contribuicao'] ?? '');
                                        if (strpos($valSped, 'OK') === 0) echo '<span class="badge bg-success">' . $valSped . '</span>';
                                        else echo '<span class="badge bg-warning text-dark">' . ($valSped ?: 'Pendente') . '</span>';
                                        ?>
                                    </td>
                                <?php else: ?>
                                    <td class="generic-modal-trigger text-center" data-coluna="sped_contribuicao" data-titulo="Sped Contribuição" style="cursor: pointer;">
                                        <?php renderizarBadge($empresa['sped_contribuicao'] ?? ''); ?>
                                    </td>
                                <?php endif; ?>

                                <td class="generic-modal-trigger text-center" data-coluna="destda" data-titulo="Destda" style="cursor: pointer;">
                                    <?php renderizarBadge($empresa['destda'] ?? ''); ?>
                                </td>
                                <?php if ($exibir_gia): ?>
                                    <td class="editable" contenteditable="true" data-coluna="gia"><?= htmlspecialchars($empresa['gia'] ?? ''); ?></td>
                                <?php endif; ?>
<?php if ($is_dezembro): ?>
    <td class="editable" contenteditable="true" data-coluna="distribuicao_dirf">
        <?= htmlspecialchars($empresa['distribuicao_dirf'] ?? ''); ?>
    </td>
<?php endif; ?>

</tr>
<?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>

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
                    <div class="loading-content">
                    </div>
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

    <div id="modalRelatorioExportacao" class="modal-overlay">
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-clipboard-check"></i> Análise da Exportação</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body" id="feedback-exportacao-body">
                <div class="loading-content" style="text-align: center; padding: 20px;">
                    <i class="fas fa-spinner fa-spin fa-2x"></i>
                    <p style="margin-top: 10px;">Analisando dados para exportação...</p>
                </div>
            </div>
        </div>
    </div>

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="scripts_globais.js"></script>

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

            if (!id) {
                alert("Erro: Não foi possível identificar o ID da empresa nesta linha.");
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

        // 2. Botão N/A
        $('#btnSpedAnualNA').off('click').on('click', function(e) {
            e.preventDefault();
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

        // 4. Botão Marcar/Desmarcar Todos
        $('#btnMarcarTodosSped').off('click').on('click', function(e) {
            e.preventDefault();
            const checkboxes = $('.check-mes-sped');
            const total = checkboxes.length;
            const marcados = checkboxes.filter(':checked').length;
            const novoEstado = (marcados < total);
            checkboxes.prop('checked', novoEstado);
            atualizarVisualCards();
        });

        // 5. Submit do Formulário (Botão Salvar Verde)
        $('#formSpedAnual').off('submit').on('submit', function(e) {
            e.preventDefault();
            processarEnvioSped(null); // Null = usa a lógica dos checkboxes
        });

        // --- FUNÇÃO CENTRALIZADA DE ENVIO ---
        function processarEnvioSped(statusForcado) {
            const idControle = $('#sped_anual_id').val();

            if (!idControle) {
                alert("Erro Crítico: O ID da empresa não foi carregado.");
                return;
            }

            var mesesMarcados = [];
            $('.check-mes-sped:checked').each(function() {
                mesesMarcados.push($(this).val());
            });

            var textoStatusParaEnviar = '';

            if (statusForcado) {
                textoStatusParaEnviar = statusForcado;
            } else {
                // Lógica dos Checkboxes
                var isCompleto = (mesesMarcados.length === 12);
                if (isCompleto) {
                    // Pega data formatada (função auxiliar já existente no seu código)
                    var dataAtual = getDataAtualFormatada();
                    var dataInput = prompt("Todos os meses selecionados! Informe a data de entrega:", dataAtual);
                    if (dataInput === null) return; // Cancelou
                    textoStatusParaEnviar = "OK - " + (dataInput.trim() || dataAtual);
                } else {
                    textoStatusParaEnviar = (mesesMarcados.length === 0) ? "Pendente" : "Pendente (" + mesesMarcados.length + "/12)";
                }
            }

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
                            htmlBadge = `<span class="badge badge-ok">${novoStatus}</span>`; // Verde
                        } else {
                            htmlBadge = `<span class="badge bg-warning text-dark">${novoStatus}</span>`; // Amarelo/Pendente
                        }
                        cell.html(htmlBadge);
                    } else {
                        alert('Erro do servidor: ' + res.message);
                    }
                },
                error: function(xhr) {
                    alert('Erro de comunicação.');
                }
            });
        }

        function setupModais() {
            const modais = {
                'btnCertificadosVencendo': 'modalCertificadosVencendo',
                'btnProcuracoesVencendo': 'modalProcuracoesVencendo',
                'btn-preparar-exportacao': 'modalRelatorioExportacao',
                'abrir-modal-parcelamento-btn': 'selecionarEmpresaModal',

                'btnEntrouMes': 'modalEntrouMes',
                'btnSaiuMes': 'modalSaiuMes',
                'btnEntraFuturo': 'modalEntraFuturo',
                'btnSaiFuturo': 'modalSaiFuturo'
            };
            Object.keys(modais).forEach(botaoId => {
                const botao = document.getElementById(botaoId);
                if (botao) {
                    botao.addEventListener('click', () => {
                        const modal = document.getElementById(modais[botaoId]);
                        if (modal) {
                            modal.classList.add('active');
                            document.body.style.overflow = 'hidden';

                            // [!] Se for o botão de exportar, já chama a análise
                            if (botaoId === 'btn-preparar-exportacao') {
                                if (typeof chamarAnaliseExportacao === 'function') {
                                    chamarAnaliseExportacao(botao.dataset.mesId);
                                }
                            }
                            // [!] Se for o botão de parcelamento, carrega a lista
                            if (botaoId === 'abrir-modal-parcelamento-btn') {
                                if (typeof carregarListaEmpresas === 'function') {
                                    carregarListaEmpresas();
                                }
                            }
                        }
                    });
                }
            });

            // Listeners para fechar QUALQUER modal
            document.querySelectorAll('.modal-close').forEach(btn => {
                btn.addEventListener('click', function() {
                    const modal = this.closest('.modal-overlay');
                    if (modal) {
                        modal.classList.remove('active');
                        if (!document.querySelector('.modal-overlay.active')) {
                            document.body.style.overflow = '';
                        }
                    }
                });
            });

            document.querySelectorAll('.modal-overlay').forEach(modal => {
                modal.addEventListener('click', function(e) {
                    if (e.target === this) {
                        this.classList.remove('active');
                        if (!document.querySelector('.modal-overlay.active')) {
                            document.body.style.overflow = '';
                        }
                    }
                });
            });
        }
    </script>

    <script>
        // [!] Script de Análise de Exportação
        function chamarAnaliseExportacao(mes_id) {
            const modal = $('#modalRelatorioExportacao');
            const modalBody = $('#feedback-exportacao-body');
            modalBody.html('<div class="loading-content" style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top: 10px;">Analisando dados...</p></div>');

            $.ajax({
                url: 'analisar_exportacao.php', // O arquivo que analisa
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
                                html += `<li style="margin-bottom: 5px;">
                                <strong>${falha.codigo} - ${falha.empresa}</strong><br>
                                <small>Motivo: ${falha.motivo}</small>
                            </li>`;
                            });
                            html += '</ul>';
                            html += '<p style="margin-top: 10px;"><small><strong>Possível Solução:</strong> Verifique se a coluna "setores_permitidos" desta empresa no banco de dados contém a palavra "fiscal" ou se está nula/vazia (que significa "todos").</small></p>';
                        } else {
                            html += '<p class="text-success">Tudo certo! Todas as empresas da competência serão exportadas.</p>';
                        }
                        const urlDownload = `exportar_fiscal.php?mes_id=${mes_id}&busca=&responsavel_id=`;
                        html += `
                        <div class="modal-footer" style="margin-top: 20px; border-top: 1px solid #eee; padding-top: 15px; text-align: right;">
                            <a href="${urlDownload}" class="btn btn-success">
                                <i class="fas fa-download"></i> Baixar Relatório (${response.validas} empresas)
                            </a>
                        </div>
                    `;
                        modalBody.html(html);
                    } else {
                        modalBody.html('<p class="text-danger"><strong>Erro ao analisar:</strong> ' + (response.message || 'Erro desconhecido') + '</p>');
                    }
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    let erroMsg = "<strong>Erro " + (jqXHR.status || 'desconhecido') + ": " + (errorThrown || 'Erro de Comunicação') + "</strong><br>";
                    let responseHtml = jqXHR.responseText || "Nenhuma resposta do servidor.";
                    let cleanText = responseHtml.replace(/<style([\s\S]*?)<\/style>/gi, '')
                        .replace(/<script([\s\S]*?)<\/script>/gi, '')
                        .replace(/<\/?[^>]+(>|$)/g, "\n")
                        .replace(/<br\s*[\/]?>/gi, "\n")
                        .replace(/&nbsp;/g, " ")
                        .replace(/\n\s*\n/g, '\n');
                    erroMsg += "<p>Ocorreu um erro fatal no servidor. A resposta foi:</p>";
                    erroMsg += "<pre style='background: #fff0f0; border: 1px solid #d00; padding: 10px; border-radius: 5px; max-height: 200px; overflow-y: auto; text-align: left; white-space: pre-wrap; word-wrap: break-word;'>" + cleanText + "</pre>";
                    modalBody.html(erroMsg);
                }
            });
        }

        $(document).ready(function() {
            setupModais();

            $('.select-responsavel').on('change', function() {
                const selectElement = $(this);
                const row = selectElement.closest('tr');
                const empresaId = row.data('id');
                const idMes = row.data('id-mes');
                const novoResponsavelId = selectElement.val();

                if (!idMes) {
                    alert('Não foi possível identificar o período (mês/ano) para esta empresa.');
                    return;
                }
                selectElement.css('opacity', 0.5);
                $.ajax({
                    url: 'salvar_responsavel_fiscal.php',
                    method: 'POST',
                    data: {
                        id_empresa: empresaId,
                        id_mes: idMes,
                        novo_responsavel_id: novoResponsavelId
                    },
                    dataType: 'json',
                    success: function(response) {
                        if (response.success) {
                            selectElement.css('border', '2px solid green');
                        } else {
                            selectElement.css('border', '2px solid red');
                            alert('Erro: ' + (response.message || 'Erro desconhecido.'));
                        }
                    },
                    error: function() {
                        selectElement.css('border', '2px solid red');
                        alert('Erro de comunicação ao salvar responsável.');
                    },
                    complete: function() {
                        selectElement.css('opacity', 1);
                        setTimeout(() => selectElement.css('border', ''), 2000);
                    }
                });
            });

            function salvarEdicao(elemento) {
                const cell = $(elemento);
                const row = cell.closest('tr');
                const id = row.data('id');
                const coluna = cell.data('coluna');
                const valor = cell.is('[contenteditable]') ? cell.text().trim() : cell.find('.editable-select').val();
                cell.css('opacity', 0.5);
                $.ajax({
                    url: 'salvar_edicao_fiscal.php',
                    method: 'POST',
                    data: {
                        id,
                        coluna,
                        valor
                    },
                    dataType: 'json',
                    success: function(response) {
                        if (response.success) {
                            cell.css('border', '2px solid green');
                        } else {
                            cell.css('border', '2px solid red');
                            alert('Erro: ' + (response.message || 'Erro desconhecido.'));
                        }
                    },
                    error: function() {
                        cell.css('border', '2px solid red');
                        alert('Erro de comunicação ao salvar edição.');
                    },
                    complete: function() {
                        cell.css('opacity', 1);
                        setTimeout(() => cell.css('border', ''), 2000);
                    }
                });
            }

            let valorOriginal = '';
            $('td[contenteditable="true"]').on('focus', function() {
                valorOriginal = $(this).text().trim();
            }).on('blur', function() {
                if ($(this).text().trim() !== valorOriginal) {
                    salvarEdicao(this);
                }
            });

            $('.editable-select').on('change', function() {
                salvarEdicao(this.closest('td'));
            });
        });
    </script>

    <script>
        function carregarListaEmpresas() {
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
                                    if (dtSaida < hoje) {
                                        status = 'inativa';
                                    }
                                } catch (e) {
                                    console.warn("Data de saída inválida: ", dataSaida);
                                }
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
                            selectResponsaveis.append(
                                `<option value="${responsavel.id}">${responsavel.nome}</option>`
                            );
                        });
                        aplicarFiltrosModal();
                    } else {
                        lista.html('<p class="text-center">Nenhuma empresa encontrada.</p>');
                    }
                },
                error: function() {
                    lista.html('<p class="text-center text-danger">Erro ao carregar dados.</p>');
                }
            });
        }

        function delegarTarefaParcelamento(id_empresa, id_usuario, nome_empresa) {
            const id_mes = <?= $mes_selecionado_id ?? 'null' ?>;
            if (!id_mes) {
                console.error('ID do mês não definido.');
                return;
            }
            $.ajax({
                url: 'salvar_delegacao.php',
                method: 'POST',
                data: {
                    id_empresa: id_empresa,
                    id_usuario: id_usuario,
                    id_mes: id_mes,
                    tipo_tarefa: 'fiscal_parcelamento',
                    nome_empresa_avulsa: nome_empresa
                },
                success: function(response) {
                    console.log('Tarefa de parcelamento delegada com sucesso.');
                },
                error: function() {
                    console.error('Erro ao delegar tarefa de parcelamento.');
                }
            });
        }

        function aplicarFiltrosModal() {
            const termo = $('#filtro-empresas-parcelamento').val().toLowerCase();
            const statusFiltro = $('input[name="filtro_status_parcelamento"]:checked').val();
            $('#lista-empresas-parcelamento .empresa-item').each(function() {
                const item = $(this);
                const statusEmpresa = item.data('status');
                let statusVisivel = false;
                if (statusFiltro === 'todas') {
                    statusVisivel = true;
                } else if (statusFiltro === 'ativas' && statusEmpresa === 'ativa') {
                    statusVisivel = true;
                } else if (statusFiltro === 'inativas' && statusEmpresa === 'inativa') {
                    statusVisivel = true;
                }
                const nome = item.data('nome').toLowerCase();
                const codigo = item.data('codigo').toString().toLowerCase();
                const cnpj = item.data('cnpj').toLowerCase();
                let textoVisivel = (nome.includes(termo) || codigo.includes(termo) || cnpj.includes(termo));
                item.toggle(statusVisivel && textoVisivel);
            });
        }

        $(document).ready(function() {
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

            $('#filtro-empresas-parcelamento').on('keyup', aplicarFiltrosModal);
            $('input[name="filtro_status_parcelamento"]').on('change', aplicarFiltrosModal);
        });
    </script>

    <script>
        $(document).ready(function() {
            // =================================================================
            // LÓGICA DE FILTRO AVANÇADA (VERSÃO ROBUSTA)
            // =================================================================

            // Armazena os filtros ativos
            const activeFilters = {};

            // Seletor universal para os ícones de filtro
            const filterSelector = '.filterable-header .filter-icon-wrapper, .filterable .filter-icon';

            // 1. CLIQUE NO ÍCONE DE FILTRO
            $(document).on('click', filterSelector, function(e) {
                e.stopPropagation();
                const icon = $(this);
                const header = icon.closest('th');
                const colIndex = header.index(); // Índice da coluna clicada

                console.log(`Abrindo filtro para coluna índice: ${colIndex}, Nome: ${header.text().trim()}`);

                // Fecha outros menus
                $('.filter-dropdown').not(icon.find('.filter-dropdown')).remove();

                // Se já estiver aberto, fecha
                if (icon.find('.filter-dropdown').length > 0) {
                    $('.filter-dropdown').remove();
                    return;
                }

                // Cria menu
                const loadingMenu = $('<div class="filter-dropdown" style="padding:15px; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>');
                icon.append(loadingMenu);
                const dropdown = icon.find('.filter-dropdown');
                dropdown.show();

                // Delay para não travar a UI instantaneamente
                setTimeout(() => {
                    const uniqueValues = new Set();

                    // Itera sobre as linhas visíveis E ocultas (para pegar tudo)
                    // Nota: Filtra apenas linhas que não são de detalhe ou agrupamento se houver
                    $('.data-table tbody tr').each(function() {
                        const row = $(this);

                        // Pega a célula correta
                        const cell = row.find('td').eq(colIndex);
                        let cellValue = '';

                        // Lógica de Extração
                        if (cell.find('select').length > 0) {
                            cellValue = cell.find('select option:selected').text();
                        } else if (cell.find('input').length > 0) {
                            cellValue = cell.find('input').val();
                        } else {
                            cellValue = cell.text();
                        }

                        // --- LIMPEZA PROFUNDA ---
                        // 1. Remove quebras de linha
                        // 2. Substitui espaço não quebrável (&nbsp;) por espaço normal
                        // 3. Remove espaços duplicados
                        // 4. Trim final
                        if (cellValue) {
                            cellValue = cellValue
                                .replace(/[\n\r]+/g, ' ') // Remove Enters
                                .replace(/\u00a0/g, " ") // Remove &nbsp;
                                .replace(/\s{2,}/g, ' ') // Remove espaços duplos
                                .trim();
                        }

                        if (!cellValue || cellValue === '...') cellValue = "(Vazio)";

                        uniqueValues.add(cellValue);
                    });

                    // Converte para array e ordena (Case Insensitive)
                    const sortedValues = Array.from(uniqueValues).sort((a, b) => {
                        return a.localeCompare(b, 'pt-BR', {
                            sensitivity: 'base'
                        });
                    });

                    console.log("Valores encontrados:", sortedValues); // Veja no Console (F12)

                    // Recupera estado anterior do filtro
                    let currentActive = activeFilters[colIndex];

                    // Monta HTML
                    let html = `
                    <div class="filter-header-area">
                        <input type="text" class="filter-dropdown-search" placeholder="Pesquisar..." autofocus>
                        <label class="filter-select-all-label">
                            <input type="checkbox" class="check-all-filters" checked> (Selecionar Tudo)
                        </label>
                    </div>
                    <div class="filter-dropdown-options">
                `;

                    sortedValues.forEach(val => {
                        // Se não temos filtro ativo para essa coluna, marca tudo.
                        // Se temos, marca só o que está na lista.
                        let isChecked = true;
                        if (currentActive && !currentActive.includes(val)) {
                            isChecked = false;
                        }

                        const checkedAttr = isChecked ? 'checked' : '';
                        const valSafe = val.replace(/"/g, '&quot;');

                        html += `
                        <label title="${valSafe}">
                            <input type="checkbox" class="filter-option" value="${valSafe}" ${checkedAttr}> ${val}
                        </label>
                    `;
                    });

                    html += `
                    </div>
                    <div class="filter-footer-area">
                        <button type="button" class="btn-filter-action btn-filter-clear">Limpar</button>
                        <button type="button" class="btn-filter-action btn-filter-apply">Aplicar</button>
                    </div>
                `;

                    dropdown.html(html);
                    atualizarSelectAllStatus(dropdown);

                    dropdown.find('.filter-dropdown-search').on('keyup', function(e) {
                        e.stopPropagation();
                        const term = $(this).val().toLowerCase();
                        dropdown.find('.filter-dropdown-options label').each(function() {
                            const text = $(this).text().toLowerCase();
                            $(this).toggle(text.indexOf(term) > -1);
                        });
                    });

                    dropdown.find('.check-all-filters').on('change', function(e) {
                        e.stopPropagation();
                        const isChecked = $(this).is(':checked');
                        dropdown.find('.filter-dropdown-options label:visible input').prop('checked', isChecked);
                    });

                    dropdown.find('.filter-option').on('change', function(e) {
                        e.stopPropagation();
                        atualizarSelectAllStatus(dropdown);
                    });

                    dropdown.find('.btn-filter-apply').on('click', function(e) {
                        e.stopPropagation();
                        const selected = [];
                        const allCheckboxes = dropdown.find('.filter-option');
                        const checkedCheckboxes = dropdown.find('.filter-option:checked');

                        checkedCheckboxes.each(function() {
                            selected.push($(this).val());
                        });

                        if (checkedCheckboxes.length === allCheckboxes.length || checkedCheckboxes.length === 0) {
                            delete activeFilters[colIndex];
                            icon.removeClass('active').css('color', '');
                        } else {
                            activeFilters[colIndex] = selected;
                            icon.addClass('active').css('color', '#0d6efd');
                        }

                        aplicarFiltrosNaTabela();
                        dropdown.remove();
                    });

                    dropdown.find('.btn-filter-clear').on('click', function(e) {
                        e.stopPropagation();
                        delete activeFilters[colIndex];
                        icon.removeClass('active').css('color', '');
                        aplicarFiltrosNaTabela();
                        dropdown.remove();
                    });

                    dropdown.on('click', function(e) {
                        e.stopPropagation();
                    });

                }, 50);
            });

            function aplicarFiltrosNaTabela() {
                const globalSearch = $('#busca, #searchInput').val()?.toLowerCase().trim() || '';

                $('.data-table tbody tr').each(function() {
                    const row = $(this);
                    let showRow = true;

                    if (globalSearch !== '') {
                        const rowText = row.text().toLowerCase();
                        if (!rowText.includes(globalSearch)) showRow = false;
                    }

                    if (showRow) {
                        for (const [colIdx, allowedValues] of Object.entries(activeFilters)) {
                            const cell = row.find(`td:eq(${colIdx})`);
                            let cellValue = '';

                            if (cell.find('select').length > 0) cellValue = cell.find('select option:selected').text();
                            else if (cell.find('input').length > 0) cellValue = cell.find('input').val();
                            else cellValue = cell.text();

                            if (cellValue) {
                                cellValue = cellValue
                                    .replace(/[\n\r]+/g, ' ')
                                    .replace(/\u00a0/g, " ")
                                    .replace(/\s{2,}/g, ' ')
                                    .trim();
                            }

                            if (!cellValue || cellValue === '...') cellValue = "(Vazio)";

                            if (!allowedValues.includes(cellValue)) {
                                showRow = false;
                                break;
                            }
                        }
                    }

                    row.toggle(showRow);
                });
            }

            // 3. Auxiliar Checkbox
            function atualizarSelectAllStatus(dropdown) {
                const visibleOptions = dropdown.find('.filter-dropdown-options label:visible input');
                const totalVisible = visibleOptions.length;
                const totalChecked = visibleOptions.filter(':checked').length;
                const checkAll = dropdown.find('.check-all-filters');

                checkAll.prop('checked', totalVisible > 0 && totalVisible === totalChecked);
                checkAll.prop('indeterminate', totalChecked > 0 && totalChecked < totalVisible);
            }

            // 4. Fechar ao clicar fora
            $(document).on('click', function() {
                $('.filter-dropdown').remove();
            });
        });
    </script>
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
    <div id="modalGenericStatus" class="modal-overlay">
        <div class="modal-container" style="width: 400px;">
            <div class="modal-header">
                <h3 class="modal-title" id="genericModalTitle">Atualizar Status</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
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
                        <i class="fas fa-eraser"></i> LIMPAR / VOLTAR PARA PENDENTE
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
    <script>
        $(document).ready(function() {

            // --- 1. FUNÇÕES AUXILIARES ---

            // Pega data de hoje dd/mm/yyyy
            function getDataAtualFormatada() {
                const hoje = new Date();
                const dia = String(hoje.getDate()).padStart(2, '0');
                const mes = String(hoje.getMonth() + 1).padStart(2, '0');
                const ano = hoje.getFullYear();
                return `${dia}/${mes}/${ano}`;
            }

            // ATUALIZA A BOLINHA SEM RECARREGAR A PÁGINA
            function atualizarVisualCelula(cell, status) {
                let htmlBadge = '';

                if (!status || status === 'Pendente' || status === '') {
                    htmlBadge = '<span class="badge bg-secondary">Pendente</span>';
                } else if (status === 'N/A') {
                    htmlBadge = '<span class="badge badge-na">N/A</span>';
                } else if (status.indexOf('Pendência') === 0) {
                    // Mostra só "Pendência" visualmente, nome no tooltip
                    htmlBadge = `<span class="badge badge-pendencia" title="${status}">Pendência</span>`;
                } else if (status.indexOf('OK') === 0 || status === 'Preenchido') {
                    htmlBadge = `<span class="badge badge-ok">${status}</span>`;
                } else {
                    htmlBadge = `<span class="badge bg-info text-dark">${status}</span>`;
                }

                cell.html(htmlBadge);
            }

            /* =================================================================
               LÓGICA MODAL GENÉRICO (ISS, MIT, SPEDS, DESTDA)
               ================================================================= */

            $('.generic-modal-trigger').on('click', function() {
                // No Admin, edição sempre liberada
                const edicaoLiberada = true;

                if (!edicaoLiberada) {
                    alert('Mês fechado.');
                    return;
                }

                const cell = $(this);
                $('#generic_id_controle').val(cell.closest('tr').data('id'));
                $('#generic_coluna').val(cell.data('coluna'));
                $('#genericModalTitle').html('<i class="fas fa-edit"></i> ' + cell.data('titulo'));
                $('#modalGenericStatus').addClass('active');
            });

            window.salvarStatusGenerico = function(statusTexto) {
                const id = $('#generic_id_controle').val();
                const coluna = $('#generic_coluna').val();

                if ((coluna === 'mit' || coluna === 'reinf' || coluna === 'impostos') && statusTexto.indexOf('OK') === 0) {
                    let isApi = confirm("Foi enviado via API?\n\n[OK] = Sim, API\n[Cancelar] = Não, S/API");
                    statusTexto += isApi ? " - API" : " - S/API";
                }

                // Define o arquivo de salvamento (se for admin, usa salvar_edicao_fiscal.php)
                // Se estiver usando o mesmo backend para ambos, mantenha o nome correto
                let urlDestino = 'salvar_edicao_fiscal.php';

                $.ajax({
                    url: urlDestino,
                    method: 'POST',
                    data: {
                        id: id,
                        coluna: coluna,
                        valor: statusTexto
                    },
                    dataType: 'json',
                    success: function(res) {
                        if (res.success) {
                            $('#modalGenericStatus').removeClass('active');

                            // AQUI ESTÁ A MÁGICA: Atualiza a célula sem F5
                            const cell = $(`.data-table tr[data-id="${id}"] td[data-coluna="${coluna}"]`);
                            atualizarVisualCelula(cell, statusTexto);

                        } else {
                            alert('Erro ao salvar: ' + (res.message || 'Erro desconhecido'));
                        }
                    },
                    error: function() {
                        alert('Erro de comunicação com o servidor.');
                    }
                });
            };

            $('#btnGenericData').click(function() {
                let dt = prompt("Informe a data:", getDataAtualFormatada());
                if (dt) salvarStatusGenerico("OK - " + dt);
            });

            $('#btnGenericPendencia').click(function() {
                let nm = prompt("Responsável:");
                if (nm) salvarStatusGenerico("Pendência - " + nm);
            });


            /* =================================================================
               LÓGICA REINF (SEM RELOAD)
               ================================================================= */

            $('.reinf-trigger').on('click', function() {
                const edicaoLiberada = true; // Admin sempre true
                if (!edicaoLiberada) {
                    alert('Mês fechado.');
                    return;
                }

                const cell = $(this);
                const id = cell.closest('tr').data('id');

                $('#modalDetalhesReinf').addClass('active');
                $('#reinf_id_controle').val(id);
                $('#reinf_status_forced').val('');
                $('#formReinfDetalhes input[type="text"]').val(''); // Limpa inputs visuais
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
                            // Preenche os campos
                            $('#reinf_irrf_1708').val(res.dados.irrf_1708);
                            $('#reinf_crf_5952').val(res.dados.crf_5952);
                            $('#reinf_inss_prestados').val(res.dados.inss_prestados);
                            $('#reinf_inss_tomados').val(res.dados.inss_tomados);
                            $('#reinf_desoneracao').val(res.dados.desoneracao);
                            $('#reinf_irrf_3208').val(res.dados.irrf_3208);
                            $('#reinf_outros').val(res.dados.outros);

                            // Salva status atual
                            $('#formReinfDetalhes').data('status-atual', res.dados.status_atual);

                            if (res.dados.status_atual && res.dados.status_atual.indexOf('Pendência') !== -1) {
                                $('#reinf_msg_status').text("Status Atual: " + res.dados.status_atual).show();
                            }
                        }
                    }
                });
            });

            $('#btnReinfNA').click(() => {
                $('#reinf_status_forced').val('N/A');
                $('#formReinfDetalhes').submit();
            });
            let _pendingOkSemAdmin = { formSelector: null, statusField: null };
            $('#btnReinfOkSemMovimento').click(() => {
                _pendingOkSemAdmin.formSelector = '#formReinfDetalhes';
                _pendingOkSemAdmin.statusField = '#reinf_status_forced';
                $('#confirmOkSemMovimentoModal .confirm-message').html('Confirma <strong>OK - SEM MOVIMENTO</strong> para este REINF?');
                $('#confirmOkSemMovimentoModal').addClass('active');
            });
            $('#confirmOkSemMovimentoBtn').click(() => {
                // Proteção: só age se houver pending definido
                if (!_pendingOkSemAdmin.formSelector || !_pendingOkSemAdmin.statusField) {
                    $('#confirmOkSemMovimentoModal').removeClass('active');
                    return;
                }

                let apiVal = $('#selectApiOkSemMovimento').val();
                let suffix = apiVal ? " - " + apiVal : "";

                $(_pendingOkSemAdmin.statusField).val('OK - SEM MOVIMENTO' + suffix);
                $(_pendingOkSemAdmin.formSelector).submit();

                _pendingOkSemAdmin = { formSelector: null, statusField: null };
                $('#confirmOkSemMovimentoModal').removeClass('active');
            });

            function resetPendingOkSemAdmin() {
                _pendingOkSemAdmin = { formSelector: null, statusField: null };
                $('#confirmOkSemMovimentoModal').removeClass('active');
            }

            $('#cancelOkSemMovimentoBtn').click(resetPendingOkSemAdmin);

            // Fecha ao clicar fora do modal: também limpa o estado pendente
            $('#confirmOkSemMovimentoModal').on('click', function(e) {
                if (e.target === this) resetPendingOkSemAdmin();
            });

            // Se fechar pelo X também limpa a pendência
            $('#confirmOkSemMovimentoModal .modal-close').click(resetPendingOkSemAdmin);

            // ESC também cancela
            $(document).on('keydown', function(e) {
                if (e.key === 'Escape' && $('#confirmOkSemMovimentoModal').hasClass('active')) {
                    resetPendingOkSemAdmin();
                }
            });
            $('#btnReinfPendencia').click(() => {
                let r = prompt("Responsável:");
                if (r) {
                    $('#reinf_status_forced').val('Pendência - ' + r);
                    $('#formReinfDetalhes').submit();
                }
            });

            $('#formReinfDetalhes').on('submit', function(e) {
                e.preventDefault();
                let status = $('#reinf_status_forced').val();

                if (status === '') {
                    let preenchidos = 0,
                        total = 0;
                    $('.check-full-reinf').each(function() {
                        total++;
                        if ($(this).val().trim() !== '') preenchidos++;
                    });

                    if (preenchidos === total) {
                        let d = prompt("Data:", getDataAtualFormatada());
                        if (!d) return;
                        let isApi = confirm("Foi enviado via API?\n\n[OK] = Sim, API\n[Cancelar] = Não, S/API");
                        status = "OK - " + d + (isApi ? " - API" : " - S/API");
                    } else if (preenchidos === 0) {
                        status = "Pendente";
                    } else {
                        let stAnt = $(this).data('status-atual');
                        if (stAnt === 'N/A' || (stAnt && stAnt.indexOf('Pendência') === 0)) status = stAnt;
                        else status = "Pendente";
                    }
                    $('#reinf_status_forced').val(status);
                }

                const id = $('#reinf_id_controle').val();

                $.post('assets/backend/salvar_detalhes_reinf.php', $(this).serialize(), function(res) {
                    if (res.success) {
                        $('#modalDetalhesReinf').removeClass('active');

                        // ATUALIZA VISUAL SEM RECARREGAR
                        const cell = $(`.data-table tr[data-id="${id}"] td[data-coluna="reinf"]`);
                        // Usa o status forçado OU o novo status retornado pelo PHP
                        let statusFinal = $('#reinf_status_forced').val() || res.novo_status;
                        atualizarVisualCelula(cell, statusFinal);
                    } else {
                        alert('Erro: ' + res.message);
                    }
                }, 'json');
            });

            function atualizarVisualCelula(cell, statusFinal) {
                if (!cell || cell.length === 0 || !statusFinal) return;
                statusFinal = String(statusFinal);

                if (statusFinal.indexOf('OK') === 0 || statusFinal === 'Preenchido') {
                    cell.html('<span class="badge badge-ok">' + statusFinal + '</span>');
                } else if (statusFinal === 'N/A') {
                    cell.html('<span class="badge badge-na">N/A</span>');
                } else if (statusFinal.indexOf('Pendência') === 0) {
                    cell.html('<span class="badge badge-pendencia" title="' + statusFinal + '">Pendência</span>');
                } else {
                    cell.html('<span class="badge bg-secondary">Pendente</span>');
                }
            }

            /* =================================================================
               LÓGICA CARNÊ LEÃO (SEM RELOAD)
               ================================================================= */
            let currentCarneLeaoAdminCell = null;

            $(document).off('click', '.carne-leao-trigger').on('click', '.carne-leao-trigger', function() {
                currentCarneLeaoAdminCell = $(this);
                const id = currentCarneLeaoAdminCell.closest('tr').data('id');

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
                let r = prompt("Motivo da pendência:");
                if (r !== null) {
                    let motivo = r.trim() !== '' ? r.trim() : 'Geral';
                    $('#carne_leao_status_forced').val('Pendência - ' + motivo);
                    $('#formCarneLeaoDetalhes').trigger('submit');
                }
            });

            $('#formCarneLeaoDetalhes').off('submit').on('submit', function(e) {
                e.preventDefault();
                let status = $('#carne_leao_status_forced').val();

                if (!status || status.trim() === '') {
                    let preenchidos = 0, total = 0;
                    $('.check-full-carne-leao').each(function() {
                        total++;
                        let val = $(this).val().trim();
                        if (val !== '' && val !== '...') preenchidos++;
                    });

                    if (preenchidos === total) {
                        let d = prompt("Data:", getDataAtualFormatada());
                        if (d === null) return;
                        status = "OK - " + (d.trim() !== '' ? d.trim() : getDataAtualFormatada());
                    } else if (preenchidos > 0) {
                        status = "Pendente (" + preenchidos + "/" + total + ")";
                    } else {
                        status = "Pendente";
                    }
                    $('#carne_leao_status_forced').val(status);
                }

                const id = $('#carne_leao_id_controle').val();

                $.post('assets/backend/salvar_detalhes_carne_leao.php', $(this).serialize(), function(res) {
                    if (typeof res === 'string') {
                        try { res = JSON.parse(res); } catch(err) {}
                    }
                    if (res && res.success) {
                        $('#modalDetalhesCarneLeao').removeClass('active');
                        const cell = currentCarneLeaoAdminCell || $(`.data-table tr[data-id="${id}"] td[data-coluna="carne_leao"]`);
                        let statusFinal = $('#carne_leao_status_forced').val() || res.novo_status;
                        atualizarVisualCelula(cell, statusFinal);
                    } else {
                        alert('Erro: ' + (res ? res.message : 'Erro desconhecido'));
                    }
                });
            });

            /* =================================================================
               LÓGICA IMPOSTOS (SEM RELOAD)
               ================================================================= */

            $('.impostos-trigger').on('click', function() {
                const edicaoLiberada = true; // Admin sempre true
                if (!edicaoLiberada) {
                    alert('Mês fechado.');
                    return;
                }

                const cell = $(this);
                const id = cell.closest('tr').data('id');

                $('#modalDetalhesImpostos').addClass('active');
                $('#impostos_id_controle').val(id);
                $('#impostos_status_forced').val('');
                $('#formImpostosDetalhes input[type="text"]').val('');
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
                        }
                    }
                });
            });

            $('#btnImpostosNA').click(() => {
                $('#impostos_status_forced').val('N/A');
                $('#formImpostosDetalhes').submit();
            });
            $('#btnImpostosOkSemMovimento').click(() => {
                _pendingOkSemAdmin.formSelector = '#formImpostosDetalhes';
                _pendingOkSemAdmin.statusField = '#impostos_status_forced';
                $('#confirmOkSemMovimentoModal .confirm-message').html('Confirma <strong>OK - SEM MOVIMENTO</strong> para este IMPOSTOS?');
                $('#confirmOkSemMovimentoModal').addClass('active');
            });
            $('#btnImpostosPendencia').click(() => {
                let r = prompt("Responsável:");
                if (r) {
                    $('#impostos_status_forced').val('Pendência - ' + r);
                    $('#formImpostosDetalhes').submit();
                }
            });

            $('#formImpostosDetalhes').on('submit', function(e) {
                e.preventDefault();
                let status = $('#impostos_status_forced').val();

                if (status === '') {
                    let preenchidos = 0,
                        total = 0;
                    $('.check-full-imp').each(function() {
                        total++;
                        if ($(this).val().trim() !== '') preenchidos++;
                    });

                    if (preenchidos === total) {
                        let d = prompt("Data:", getDataAtualFormatada());
                        if (!d) return;
                        let isApi = confirm("Foi enviado via API?\n\n[OK] = Sim, API\n[Cancelar] = Não, S/API");
                        status = "OK - " + d + (isApi ? " - API" : " - S/API");
                    } else if (preenchidos === 0) {
                        status = "Pendente";
                    } else {
                        let stAnt = $(this).data('status-atual');
                        if (stAnt === 'N/A' || (stAnt && stAnt.indexOf('Pendência') === 0)) status = stAnt;
                        else status = "Pendente";
                    }
                    $('#impostos_status_forced').val(status);
                }

                const id = $('#impostos_id_controle').val();

                $.post('assets/backend/salvar_detalhes_impostos.php', $(this).serialize(), function(res) {
                    if (res.success) {
                        $('#modalDetalhesImpostos').removeClass('active');

                        // ATUALIZA VISUAL SEM RECARREGAR
                        const cell = $(`.data-table tr[data-id="${id}"] td[data-coluna="impostos"]`);
                        let statusFinal = $('#impostos_status_forced').val() || res.novo_status;
                        atualizarVisualCelula(cell, statusFinal);
                    } else {
                        alert('Erro: ' + res.message);
                    }
                }, 'json');
            });

            // Fechar qualquer modal
            $('.modal-close').click(function() {
                $(this).closest('.modal-overlay').removeClass('active');
            });

            // Salvar Responsável (Simples - Sem Reload)
            $('.select-responsavel').change(function() {
                const el = $(this);
                el.css('opacity', '0.5');
                $.post('salvar_responsavel_fiscal.php', {
                    id_empresa: el.closest('tr').data('id'),
                    id_mes: el.closest('tr').data('id-mes'),
                    novo_responsavel_id: el.val()
                }, function(res) {
                    el.css('opacity', '1');
                    if (res.success) {
                        el.css('border', '2px solid green');
                        setTimeout(() => el.css('border', ''), 1000);
                    } else {
                        el.css('border', '2px solid red');
                        alert('Erro ao salvar responsável');
                    }
                }, 'json');
            });
        });
    </script>
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
    <script>
        $(document).ready(function() {

            function formatarDataParaBR(dataISO) {
                if (!dataISO) return '';
                const [ano, mes, dia] = dataISO.split('-');
                return `${dia}/${mes}/${ano}`;
            }

            // ============================================================
            // LÓGICA DO ISS SIMPLIFICADA (SEM TRAVAMENTOS)
            // ============================================================
            $(document).ready(function() {

                // Detecta mudança diretamente no Select (Nativo e Rápido)
                $(document).on('change', '.iss-select', function() {
                    var select = $(this);
                    var novoValor = select.val();
                    var idEmpresa = select.data('id');
                    var valorAnterior = select.find('option[selected]').val(); // Para caso de cancelamento

                    // Se o usuário escolher "Informar Data..."
                    if (novoValor === 'CUSTOM_DATA') {
                        var dataDigitada = prompt("Digite o dia (ex: 15) ou a data completa (15/01/2026):");

                        if (dataDigitada) {
                            // Lógica simples para formatar a data se digitar só o dia
                            if (dataDigitada.length <= 2) {
                                var hoje = new Date();
                                var mes = (hoje.getMonth() + 1).toString().padStart(2, '0');
                                var ano = hoje.getFullYear();
                                dataDigitada = dataDigitada.padStart(2, '0') + '/' + mes + '/' + ano;
                            }

                            novoValor = "OK - " + dataDigitada;

                            // Adiciona essa nova opção no select visualmente e seleciona ela
                            // (Evita ter que recarregar a página)
                            select.prepend('<option value="' + novoValor + '" selected>' + novoValor + '</option>');
                            select.val(novoValor);
                        } else {
                            // Se cancelar o prompt, volta para o valor que estava antes
                            select.val(valorAnterior);
                            return; // Para tudo, não salva
                        }
                    }

                    // Feedback Visual (Fica meio transparente enquanto salva)
                    select.css('opacity', '0.5');

                    // Envia para o Backend
                    $.ajax({
                        url: 'salvar_edicao_fiscal.php', // Confirme se o nome do arquivo é este mesmo
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
                                // Sucesso: Borda verde rápida
                                select.css('border-bottom', '2px solid #198754');
                                setTimeout(function() {
                                    select.css('border-bottom', 'none');
                                }, 2000);
                            } else {
                                // Erro backend
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
    <script>
        // Função para filtrar as linhas da tabela dentro do modal
        function filtrarVencimentos(selectElement, tableId) {
            const filtro = selectElement.value; // 'todos', 'vencido', 'nao_vencido'
            const linhas = document.querySelectorAll('#' + tableId + ' tbody tr');

            linhas.forEach(row => {
                const categoriaRow = row.getAttribute('data-category');

                if (filtro === 'todos') {
                    row.style.display = ''; // Mostra tudo
                } else {
                    if (categoriaRow === filtro) {
                        row.style.display = ''; // Mostra se bater com o filtro
                    } else {
                        row.style.display = 'none'; // Esconde
                    }
                }
            });
        }
    </script>
    <script>
function filtrarCertificados() {
    const situacao = document.getElementById('filtro-situacao-certificados').value;
    const empresa = document.getElementById('filtro-empresa-certificados').value.toLowerCase().trim();
    const grupo = document.getElementById('filtro-grupo-certificados').value.toLowerCase().trim();

    const linhas = document.querySelectorAll('#tabela-certificados tbody tr');

    linhas.forEach(linha => {
        const categoria = (linha.dataset.category || '').toLowerCase();
        const nomeEmpresa = (linha.dataset.empresa || '').toLowerCase();
        const nomeGrupo = (linha.dataset.grupo || '').toLowerCase();

        const filtroSituacao = (situacao === 'todos' || categoria === situacao);
        const filtroEmpresa = (empresa === '' || nomeEmpresa.includes(empresa));
        const filtroGrupo = (grupo === 'todos' || nomeGrupo === grupo);

        linha.style.display = (filtroSituacao && filtroEmpresa && filtroGrupo) ? '' : 'none';
    });
}
</script>
</body>

</html>