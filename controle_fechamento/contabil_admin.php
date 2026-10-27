<?php
session_start();
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once 'assets/backend/config.php';

// =======================================================================
// == FUNÇÃO DE FORMATAÇÃO DE DATA (ADICIONADA) ==
// =======================================================================
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

// 1. VERIFICAÇÃO DE ACESSO
if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['tipo_conta'], ['admin', 'lider_contabil', 'lider_fiscal', 'fiscal','contabil'])) {
    $_SESSION['mensagem'] = 'Acesso restrito à área de gestão contábil.';
    header('Location: index.php');
    exit();
}

$usuario_nome = $_SESSION['usuario_nome'] ?? 'Administrador';
$ano_atual = date('Y');
$mes_atual_numero = date('n');
// 2. FUNÇÕES DE BUSCA DE DADOS
function obterMesesDoAnoAdmin($conexao, $ano)
{
    $query = "SELECT id, mes FROM controle_meses WHERE ano = ? ORDER BY mes ASC";
    $stmt = $conexao->prepare($query);
    $stmt->bind_param('i', $ano);
    $stmt->execute();
    $result = $stmt->get_result();
    return $result->fetch_all(MYSQLI_ASSOC);
}

function obterAnosDisponiveisAdmin($conexao)
{
    $query = "SELECT DISTINCT ano FROM controle_meses ORDER BY ano DESC";
    $stmt = $conexao->prepare($query);
    $stmt->execute();
    $result = $stmt->get_result();
    return $result->fetch_all(MYSQLI_ASSOC);
}

function obterResponsaveisContabeis($conexao)
{
    // Adicionado 'admin' dentro dos parenteses
    $query = "SELECT id, nome FROM usuarios WHERE tipo_conta IN ('contabil', 'lider_contabil', 'admin') ORDER BY nome ASC";
    $stmt = $conexao->prepare($query);
    $stmt->execute();
    $result = $stmt->get_result();
    return $result->fetch_all(MYSQLI_ASSOC);
}

function obterTributacoesDistintas($conexao)
{
    $query = "SELECT DISTINCT tributacao FROM controle_fechamento WHERE tributacao IS NOT NULL AND tributacao != '' ORDER BY tributacao";
    return $conexao->query($query)->fetch_all(MYSQLI_ASSOC);
}

function obterGruposDistintos($conexao)
{
    $query = "SELECT DISTINCT grupo FROM controle_fechamento WHERE grupo IS NOT NULL AND grupo != '' ORDER BY grupo";
    return $conexao->query($query)->fetch_all(MYSQLI_ASSOC);
}

require_once 'funcoes_contabil_admin.php';
function obterTotalObrigacoesFuturasAdmin($conexao)
{
    $stmt = $conexao->prepare("SELECT COUNT(id) as total FROM controle_fechamento WHERE data_obrigacao > CURDATE()");
    $stmt->execute();
    return $stmt->get_result()->fetch_assoc()['total'] ?? 0;
}

function obterTotalEmpresasSaindoAdmin($conexao)
{
    $stmt = $conexao->prepare("SELECT COUNT(id) as total FROM controle_fechamento WHERE data_saida > CURDATE()");
    $stmt->execute();
    return $stmt->get_result()->fetch_assoc()['total'] ?? 0;
}
$ano_atual = date('Y');
$mes_atual_numero = date('n');

// Busca os anos disponíveis para o dropdown
$anos_disponiveis = obterAnosDisponiveisAdmin($conexao);

// Determina o ano a ser exibido: Pega do GET ou usa o ano atual como padrão
$ano_selecionado = isset($_GET['ano']) ? (int)$_GET['ano'] : $ano_atual;

$mes_selecionado_id = null;

// Verifica se o ano selecionado é o ano atual
if ($ano_selecionado == $ano_atual) {
    // Se for o ano atual, busca o ID do MÊS ATUAL
    $stmt_mes = $conexao->prepare("SELECT id FROM controle_meses WHERE ano = ? AND mes = ? LIMIT 1");
    if ($stmt_mes) {
        $stmt_mes->bind_param('ii', $ano_selecionado, $mes_atual_numero);
        $stmt_mes->execute();
        $result_mes = $stmt_mes->get_result();
        if ($row = $result_mes->fetch_assoc()) {
            $mes_selecionado_id = (int)$row['id'];
        }
        $stmt_mes->close();
    }
} else {
    // Se for um ano ANTERIOR, busca o ID do ÚLTIMO MÊS daquele ano
    $stmt_mes = $conexao->prepare("SELECT id FROM controle_meses WHERE ano = ? ORDER BY mes DESC LIMIT 1");
    if ($stmt_mes) {
        $stmt_mes->bind_param('i', $ano_selecionado);
        $stmt_mes->execute();
        $result_mes = $stmt_mes->get_result();
        if ($row = $result_mes->fetch_assoc()) {
            $mes_selecionado_id = (int)$row['id'];
        }
        $stmt_mes->close();
    }
}
// $ano_selecionado = $ano_atual; // Esta linha parecia ser um reset, removi para manter o GET

if ($mes_selecionado_id === null) {
    if ($ano_selecionado == $ano_atual) {
        die("Erro crítico: O mês atual ($mes_atual_numero/$ano_selecionado) não foi encontrado na tabela 'controle_meses'. Verifique a criação de meses.");
    } else {
        die("Erro crítico: Nenhum mês encontrado para o ano $ano_selecionado na tabela 'controle_meses'.");
    }
}
$filtros = [
    'ano'            => $ano_selecionado, // Adiciona o ano aos filtros para os links de ordenação
    'busca'          => $_GET['busca'] ?? '',
    'responsavel_id' => $_GET['responsavel_id'] ?? '',
    'tributacao'     => $_GET['tributacao'] ?? '',
    'grupo'          => $_GET['grupo'] ?? '',
    'status'         => $_GET['status'] ?? 'ativas',
    'sort'           => $_GET['sort'] ?? 'empresa',
    'dir'            => $_GET['dir'] ?? 'ASC',
];

// Função generateSortLink (precisa ser ajustada para incluir o ano)
function generateSortLink($current_filters, $column, $current_sort, $current_dir)
{
    $new_dir = 'ASC';
    $arrow = 'fa-sort';

    if ($current_sort === $column) {
        $new_dir = $current_dir === 'ASC' ? 'DESC' : 'ASC';
        $arrow = $current_dir === 'ASC' ? 'fa-sort-up' : 'fa-sort-down';
    }

    // Mantém todos os filtros, incluindo o 'ano'
    $params = array_merge($current_filters, ['sort' => $column, 'dir' => $new_dir]);
    // Remove 'mes_id' se existir, pois não é mais usado na URL principal
    unset($params['mes_id']);

    $link = 'contabil_admin.php?' . http_build_query($params);

    return "<a href=\"{$link}\" class=\"sort-link\" style=\"text-decoration:none; color:inherit;\"><i class=\"fas {$arrow}\"></i></a>";
}


// A busca de empresas agora usa o $ano_selecionado e o $mes_selecionado_id calculado

// 1. CRIAMOS UMA CÓPIA DOS FILTROS PARA O SQL IGNORAR A TRAVA E TRAZER TUDO
$filtros_sql = $filtros;
$filtros_sql['status'] = 'todas';

// 2. PASSAMOS $filtros_sql NO LUGAR DE $filtros PARA A FUNÇÃO
$resultado_empresas = $mes_selecionado_id ? obterEmpresasContabeisAdmin($conexao, $ano_selecionado, $mes_selecionado_id, $filtros_sql) : null;
$empresas = $resultado_empresas ? $resultado_empresas->fetch_all(MYSQLI_ASSOC) : [];

// =======================================================================
// == FILTRO DE EXIBIÇÃO (Q-MAX E EMPRESAS QUE JÁ SAÍRAM) ==
// =======================================================================
if (!empty($empresas)) {
    // Adicionamos 'use' para acessar variáveis de fora ($filtros, $ano_selecionado)
    $empresas = array_filter($empresas, function ($empresa) use ($filtros, $ano_selecionado) {

        // 1. Lógica do Grupo Q-MAX
        // $grupo = isset($empresa['grupo']) ? strtoupper(trim($empresa['grupo'])) : '';
        // if ($grupo === 'Q-MAX') {
            // return false; // Remove Q-MAX
        // }

        // 2. Lógica Temporal de Data de Saída 
        $status_filtro = $filtros['status'] ?? 'ativas';
        $data_saida = $empresa['data_saida'] ?? null;
        
        // Verifica se a empresa tem uma data de saída válida registrada
        $saiu = (!empty($data_saida) && $data_saida !== '0000-00-00');
        $ano_saida = $saiu ? (int)date('Y', strtotime($data_saida)) : null;

        // REGRA DE OURO: Ela é considerada "Ativa" no contexto deste painel SE:
        // - Nunca saiu (não tem data_saida) OU
        // - A data que saiu é MAIOR ou IGUAL ao ano da planilha que estamos visualizando.
        // Ex: Olhando 2025. Saiu em 2026? Ativa. Saiu em 2024? Inativa.
        $ativa_no_ano = (!$saiu || $ano_saida >= $ano_selecionado);

        // Remove se o usuário pediu "Apenas Ativas", mas ela NÃO era ativa neste ano
        if ($status_filtro === 'ativas' && !$ativa_no_ano) {
            return false; 
        }

        // Remove se o usuário pediu "Apenas Inativas", mas ela ERA ativa neste ano
        if ($status_filtro === 'inativas' && $ativa_no_ano) {
            return false; 
        }

        return true; // Mantém a empresa na listagem
    });

    // Reorganiza os índices numéricos do array após o corte
    $empresas = array_values($empresas);
}
// =======================================================================
$num_empresas_filtradas = count($empresas);

// =======================================================================
// == CÁLCULO DE VENCIMENTOS (LÓGICA GLOBAL COM HORA CORRIGIDA) ==
// =======================================================================
$certificados_a_vencer = 0;
$procuracoes_a_vencer = 0;
$empresas_certificados_vencendo = [];
$empresas_procuracoes_vencendo = [];

// 1. Define o período de 30 dias, ZERANDO O RELÓGIO
$hoje_obj = new DateTime('today'); // Ex: 03/11/2025 00:00:00

// 2. Define o limite. 
// Queremos incluir 29 dias no futuro. O 30º dia é o limite exclusivo.
$limite_vencimento_obj = (new DateTime('today'))->modify('+30 days'); // Ex: 03/12/2025 00:00:00

// 3. Formata as datas para a consulta SQL
$hoje_sql = $hoje_obj->format('Y-m-d'); // '2025-11-03'
$limite_vencimento_sql = $limite_vencimento_obj->format('Y-m-d'); // '2025-12-03'
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
                OR setores_permitidos LIKE '%contabil%'
                OR setores_permitidos LIKE '%fiscal%'
                OR setores_permitidos LIKE '%cushman%'
                OR setores_permitidos LIKE '%dp%'
            )
            AND (data_vencimento_certificado IS NOT NULL OR data_procuracao_target IS NOT NULL)
    ) as sub
    WHERE 
        sub.rn = 1
        AND (
            (sub.data_vencimento_certificado >= ? AND sub.data_vencimento_certificado < ?) OR
            (sub.data_procuracao_target >= ? AND sub.data_procuracao_target < ?)
        )
";

$stmt_vencimentos = $conexao->prepare($query_vencimentos);

// 5. Binda os 4 parâmetros de data na query
$stmt_vencimentos->bind_param(
    "ssss",
    $hoje_sql,
    $limite_vencimento_sql,
    $hoje_sql,
    $limite_vencimento_sql
);

$stmt_vencimentos->execute();
$resultado_vencimentos = $stmt_vencimentos->get_result();
$empresas_com_vencimentos = $resultado_vencimentos->fetch_all(MYSQLI_ASSOC);
$stmt_vencimentos->close();

// 6. Loop sobre as empresas JÁ FILTRADAS
foreach ($empresas_com_vencimentos as $empresa_vencimento) {

    // Lógica para Certificados
    if (!empty($empresa_vencimento['data_vencimento_certificado'])) {
        try {
            $data_vencimento_cert = new DateTime($empresa_vencimento['data_vencimento_certificado']);

            // Verificação final (agora com datas 'zeradas')
            if ($data_vencimento_cert >= $hoje_obj && $data_vencimento_cert < $limite_vencimento_obj) {
                $certificados_a_vencer++;

                // Cálculo de dias restantes (agora correto)
                $intervalo_cert = $hoje_obj->diff($data_vencimento_cert);
                $dias_restantes_cert = $intervalo_cert->days;

                $empresas_certificados_vencendo[] = [
                    'empresa' => $empresa_vencimento['empresa'],
                    'data_vencimento' => formatarDataBR($empresa_vencimento['data_vencimento_certificado']),
                    'dias_restantes' => $dias_restantes_cert
                ];
            }
        } catch (Exception $e) { /* Ignora datas inválidas */
        }
    }

    // Lógica para Procurações Target
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
        } catch (Exception $e) { /* Ignora datas inválidas */
        }
    }
}
// =======================================================================

// O restante das buscas (responsaveis, tributacoes, etc.) permanece igual
$responsaveis_disponiveis = obterResponsaveisContabeis($conexao);
$tributacoes_disponiveis = obterTributacoesDistintasContabil($conexao); // Assumindo que esta função existe
$grupos_disponiveis = obterGruposDistintosContabil($conexao);

$total_obrigacoes_futuras = obterTotalObrigacoesFuturasAdmin($conexao);
$total_empresas_saindo = obterTotalEmpresasSaindoAdmin($conexao);
$opcoes_mes_select = ['COBRANÇA DOC.', 'DOC. REDE', 'OK - FINALIZADO', 'SEM MOVIMENTO'];
$meses_pt = [1 => 'Janeiro', 2 => 'Fevereiro', 3 => 'Março', 4 => 'Abril', 5 => 'Maio', 6 => 'Junho', 7 => 'Julho', 8 => 'Agosto', 9 => 'Setembro', 10 => 'Outubro', 11 => 'Novembro', 12 => 'Dezembro'];

$contadores_mensais = [];
$meses_colunas = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
// As opções de status que serão contadas. Adicionamos 'Pendente' para os campos vazios.
$opcoes_status = array_merge($opcoes_mes_select, ['Pendente']);

// Inicializa os contadores para cada mês
foreach ($meses_colunas as $mes_coluna) {
    $contadores_mensais[$mes_coluna] = [
        'total_relevante' => 0,
        'status' => array_fill_keys($opcoes_status, 0)
    ];
}

// Percorre as empresas filtradas para contar os status de cada mês
foreach ($empresas as $empresa) {
    $data_obrigacao = $empresa['data_obrigacao'] ?? null;
    $ano_obrigacao = $data_obrigacao ? (int)date('Y', strtotime($data_obrigacao)) : null;
    $mes_obrigacao = $data_obrigacao ? (int)date('m', strtotime($data_obrigacao)) : null;

    $data_saida = $empresa['data_saida'] ?? null;
    $ano_saida = $data_saida ? (int)date('Y', strtotime($data_saida)) : null;
    $mes_saida = $data_saida ? (int)date('m', strtotime($data_saida)) : null;

    foreach ($meses_colunas as $index => $mes_coluna) {
        $mes_numero = $index + 1;

        // Verifica se o mês é relevante para a empresa (não antes da obrigação e não depois da saída)
        $is_editavel = !(
            ($data_obrigacao && ($ano_selecionado < $ano_obrigacao || ($ano_selecionado == $ano_obrigacao && $mes_numero < $mes_obrigacao))) ||
            ($data_saida && ($ano_selecionado > $ano_saida || ($ano_selecionado == $ano_saida && $mes_numero > $mes_saida)))
        );

        if ($is_editavel) {
            $contadores_mensais[$mes_coluna]['total_relevante']++;
            $valor_mes = $empresa[$mes_coluna] ?? '';

            if (empty($valor_mes)) {
                $contadores_mensais[$mes_coluna]['status']['Pendente']++;
            } elseif (isset($contadores_mensais[$mes_coluna]['status'][$valor_mes])) {
                // Conta o status se ele estiver na nossa lista de opções
                $contadores_mensais[$mes_coluna]['status'][$valor_mes]++;
            }
        }
    }
}

// Calcula as porcentagens para cada status em cada mês
$porcentagens_mensais = [];
foreach ($contadores_mensais as $mes => $dados_mes) {
    $porcentagens_mensais[$mes] = [];
    if ($dados_mes['total_relevante'] > 0) {
        foreach ($dados_mes['status'] as $status => $contagem) {
            $porcentagens_mensais[$mes][$status] = round(($contagem / $dados_mes['total_relevante']) * 100);
        }
    }
}
?>
<!DOCTYPE html>
<html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gestão Contábil Completa</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/contabil.css">

    <style>
        :root {
            --header-height: 70px;
        }

        .data-table tbody {
            position: relative;
            z-index: 1;
        }

        .data-table thead {
            position: sticky;
            top: 0;
            z-index: 10;
        }

        .data-table th {
            background: var(--primary-gradient);
        }

        /* Empresa: permite quebra de linha e mostra o nome completo via tooltip */
        .data-table th:nth-child(2),
        .data-table td:nth-child(2) {
            /* Removido truncamento para permitir nomes longos */
            /* max-width: 250px; overflow: hidden; text-overflow: ellipsis; */
            white-space: normal;
            word-wrap: break-word;
            min-width: 360px; /* padronizado para alinhar com view contábil */
            width: 360px; /* Ligeiro aumento para acomodar nomes maiores */
        }

        .data-table th:nth-child(1),
        .data-table td:nth-child(1) {
            position: sticky;
            left: 0;
            z-index: 11;
            width: 100px;
            min-width: 100px;
        }

        .data-table th:nth-child(3),
        .data-table td:nth-child(3) {
            width: 200px;
            min-width: 200px;
        }

        .data-table th:nth-child(4),
        .data-table td:nth-child(4) {
            width: 180px;
            min-width: 180px;
        }

        .data-table th:nth-child(1),
        .data-table td:nth-child(1) {
            position: sticky;
            left: 0;
        }

        .data-table th:nth-child(2),
        .data-table td:nth-child(2) {
            position: sticky;
            left: 100px;
        }

        .data-table th:nth-child(3),
        .data-table td:nth-child(3) {
            position: sticky;
            left: 460px; /* ajustado conforme largura da coluna Empresa (100 + 360 = 460) */
        }

        .data-table th:nth-child(4),
        .data-table td:nth-child(4) {
            position: sticky;
            left: 660px;
        }

        .data-table td:nth-child(-n+4) {
            z-index: 11;
            background-color: var(--card-bg);
        }

        .data-table th:nth-child(-n+4) {
            z-index: 12;
        }

        .data-table tr:hover td:nth-child(-n+4) {
            background-color: var(--card-bg) !important;
        }

        .data-table th:nth-child(4),
        .data-table td:nth-child(4) {
            border-right: 2px solid var(--border-color);
        }

        /* ======================================================= */
        /* == ESTILOS DOS CARDS DE AVISO (ADICIONADOS) == */
        /* ======================================================= */
        .stats-container {
            display: grid;
            grid-template-columns: repeat(3, 1fr);

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
    </style>
</head>

<body>

    <div id="modalCertificadosVencendo" class="modal-overlay">
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-exclamation-triangle"></i> Certificados Vencendo (Próximos 30 dias)</h3>
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
                                        $badge_class = 'badge-success'; // Verde por padrão
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
                <?php else : ?>
                    <div class="empty-message">
                        <i class="fas fa-check-circle"></i>
                        <p>Nenhum certificado vencendo nos próximos 30 dias.</p>
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
                                        $badge_class = 'badge-success'; // Verde por padrão
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
                <?php else : ?>
                    <div class="empty-message">
                        <i class="fas fa-check-circle"></i>
                        <p>Nenhuma procuração vencendo nos próximos 30 dias.</p>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    </div>
    <header class="header">
        <div>
            <h1>Gestão Contábil Completa</h1>
        </div>
        <div style="display: flex; gap: 10px;">
            <?php
            $tipo_conta = $_SESSION['tipo_conta'] ?? '';

            if ($tipo_conta === 'admin') {
                echo '<a href="dashboard.php" class="btn-voltar"><i class="fas fa-user-shield"></i> Painel Admin</a>';
            }

            if ($tipo_conta === 'admin' || $tipo_conta === 'lider_fiscal' || $tipo_conta === 'fiscal') {
                echo '<a href="fiscal_admin.php" class="btn-voltar"><i class="fas fa-landmark"></i> Fiscal Admin</a>';
            }

            $link_voltar = 'index.php';
            if ($tipo_conta === 'admin') {
                $link_voltar = 'dashboard.php';
            } elseif (strpos($tipo_conta, 'lider_') === 0) {
                $link_voltar = 'painel_lider.php';
            }
            ?>

            <a href="painel_lider.php?area=contabil" class="btn-voltar"><i class="fas fa-arrow-left"></i> Voltar</a>
        </div>
    </header>

    <div class="main-content">
        <div class="stats-container">
            <div class="stats-box <?= ($certificados_a_vencer > 0) ? 'alert' : '' ?>" id="btnCertificadosVencendo" style="position: relative; cursor: pointer;">
                <h3><i class="fas fa-exclamation-triangle"></i> Certificados a Vencer</h3>
                <div class="stats-numbers"><?= $certificados_a_vencer ?> certificados</div>
                <p>Nos próximos 30 dias</p>
                <?php if ($certificados_a_vencer > 0) : ?>
                    <a href="exportar_certificados.php" class="btn-exportar-dp" title="Exportar lista para Excel">
                        <i class="fas fa-file-excel"></i>
                    </a>
                <?php endif; ?>
            </div>

            <div class="stats-box <?= ($procuracoes_a_vencer > 0) ? 'alert' : '' ?>" id="btnProcuracoesVencendo" style="position: relative; cursor: pointer;">
                <h3><i class="fas fa-user-clock"></i> Procurações a Vencer</h3>
                <div class="stats-numbers"><?= $procuracoes_a_vencer ?> procurações</div>
                <p>Nos próximos 30 dias</p>
            </div>
            <div class="stats-box">
                <h3><i class="fas fa-building"></i> Empresas na Lista</h3>
                <div class="stats-numbers"><?= $num_empresas_filtradas; ?> empresas</div>
                <p>Dados referentes a <?= $ano_selecionado; ?></p>
            </div>
            <div class="stats-box">
                <h3><i class="fas fa-calendar-check"></i> Obrigações Futuras</h3>
                <div class="stats-numbers"><?= $total_obrigacoes_futuras; ?> próximas</div>
                <p>Total no sistema</p>
            </div>
            <div class="stats-box">
                <h3><i class="fas fa-calendar-minus"></i> Empresas Saindo</h3>
                <div class="stats-numbers"><?= $total_empresas_saindo; ?> programadas</div>
                <p>Total no sistema</p>
            </div>
            <div class="stats-box">
                <h3><i class="fas fa-calendar-alt"></i> Status Mensal</h3>

                <div class="accordion accordion-flush" id="statusMensalAccordion">
                    <?php
                    $accordion_item_index = 0;
                    foreach ($porcentagens_mensais as $mes_coluna => $dados_mes) :
                        if (empty($dados_mes) || $contadores_mensais[$mes_coluna]['total_relevante'] === 0) continue;

                        $accordion_item_index++;
                        // O array $meses_pt já existe no seu arquivo
                        $mes_nome = htmlspecialchars($meses_pt[array_search($mes_coluna, $meses_colunas) + 1]);
                    ?>
                        <div class="accordion-item">
                            <h2 class="accordion-header" id="heading-<?php echo $accordion_item_index; ?>">
                                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-<?php echo $accordion_item_index; ?>" aria-expanded="false" aria-controls="collapse-<?php echo $accordion_item_index; ?>">
                                    <?php echo $mes_nome; ?>
                                </button>
                            </h2>
                            <div id="collapse-<?php echo $accordion_item_index; ?>" class="accordion-collapse collapse" aria-labelledby="heading-<?php echo $accordion_item_index; ?>" data-bs-parent="#statusMensalAccordion">
                                <div class="accordion-body">
                                    <?php
                                    // Pegamos o total relevante para este mês específico
                                    $total_relevante_mes = $contadores_mensais[$mes_coluna]['total_relevante'];

                                    // Agora iteramos sobre as contagens, não as porcentagens
                                    foreach ($contadores_mensais[$mes_coluna]['status'] as $status => $contagem) :
                                        // Só exibe o status se a contagem for maior que zero
                                        if ($contagem > 0) :
                                            // Calcula a porcentagem aqui, na hora de exibir
                                            $porcentagem = round(($contagem / $total_relevante_mes) * 100);
                                    ?>
                                            <div class="status-percent-item">
                                                <span class="status-name"><?= htmlspecialchars($status); ?>:</span>
                                                <span class="status-value">
                                                    <?= $porcentagem; ?>% <span class="text-muted">- <?= $contagem; ?>/<?= $total_relevante_mes; ?></span>
                                                </span>
                                            </div>
                                    <?php
                                        endif;
                                    endforeach;
                                    ?>
                                </div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>

        <div class="filter-panel">
            <form method="GET" action="contabil_admin.php">
                <div class="filter-grid">
                    <div class="filter-group">
                        <label for="ano"><i class="fas fa-calendar-alt"></i> Ano de Referência</label>
                        <select id="ano" name="ano" class="form-select form-select-sm" onchange="this.form.submit()">
                            <?php
                            // Garante que $anos_disponiveis foi buscado antes
                            if (!isset($anos_disponiveis)) {
                                $anos_disponiveis = obterAnosDisponiveisAdmin($conexao);
                            }
                            foreach ($anos_disponiveis as $ano) : ?>
                                <option value="<?= $ano['ano'] ?>" <?= ($ano['ano'] == $ano_selecionado) ? 'selected' : '' ?>><?= $ano['ano'] ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label for="busca"><i class="fas fa-search"></i> Buscar Empresa</label>
                        <input type="text" id="searchInput" name="busca" class="form-control form-control-sm" placeholder="Pesquisar por Nome, CNPJ ou Código..." value="<?= htmlspecialchars($filtros['busca']) ?>">
                    </div>

                    <div class="filter-group">
                        <label for="filtro-status" class="form-label"><i class="fas fa-power-off"></i> Status</label>
                        <select id="filtro-status" name="status" class="form-select form-select-sm">
                            <option value="ativas" <?= ($_GET['status'] ?? 'ativas') == 'ativas' ? 'selected' : '' ?>>Apenas Ativas</option>
                            <option value="inativas" <?= ($_GET['status'] ?? '') == 'inativas' ? 'selected' : '' ?>>Apenas Inativas</option>
                            <option value="todas" <?= ($_GET['status'] ?? '') == 'todas' ? 'selected' : '' ?>>Todas (Ativas e Inativas)</option>
                        </select>
                    </div>
                    <div class="filter-buttons-action">
                        <button type="submit" class="btn btn-primary btn-sm"><i class="fas fa-filter"></i> Filtrar</button>
                        <a href="contabil_admin.php" class="btn btn-secondary btn-sm">Limpar</a>
                        <button type="button" id="btn-preparar-exportacao-contabil" class="btn btn-success btn-sm"
                                                            data-ano="<?= $ano_selecionado ?>"
                                                            data-mes-id="<?= $mes_selecionado_id ?>">
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
                        <th style="min-width: 100px;">
                            Código
                            <?= generateSortLink($filtros, 'codigo', $filtros['sort'], $filtros['dir']) ?>
                        </th>
                        <th style="min-width: 250px;">
                            Empresa
                            <?= generateSortLink($filtros, 'empresa', $filtros['sort'], $filtros['dir']) ?>
                        </th>
                    <th class="filterable" data-column="responsavel">
    Responsável
    <span class="filter-icon"><i class="fas fa-filter"></i></span>
</th>

<th>CNPJ</th>

<th class="filterable" data-column="situacao">
    Situação
    <span class="filter-icon"><i class="fas fa-filter"></i></span>
</th>

<th class="filterable" data-column="grupo">
    Grupo
    <span class="filter-icon"><i class="fas fa-filter"></i></span>
</th>
                        <th class="filterable" data-column="tributacao">Tributação <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                        <th class="filterable" data-column="observacoes_contabil" style="min-width: 200px;">Observações <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                        <th class="filterable" style="min-width: 120px;">
                            Meses
                            <span class="filter-icon"><i class="fas fa-filter"></i></span>
                        </th>
                        <th class="filterable" data-column="balancete" style="min-width: 150px;">Balancete <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                        <th class="filterable" data-column="distribuicao_dirf" style="min-width: 150px;">Distribuição DIRF <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                        <th class="filterable" data-column="defs" style="min-width: 150px;">DEFS <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                        <th class="filterable" data-column="dasn" style="min-width: 150px;">DASN <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                        <th class="filterable" data-column="ecd" style="min-width: 150px;">ECD <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                        <th class="filterable" data-column="ecf" style="min-width: 150px;">ECF <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($empresas)) : ?>
                        <tr>
                            <td colspan="15" style="text-align: center; padding: 20px;">Nenhuma empresa encontrada com os filtros aplicados.</td>
                        </tr>
                    <?php else : ?>
                        <?php foreach ($empresas as $empresa) : ?>
                            <tr data-id="<?= $empresa['id']; ?>"
                                data-id-mes="<?= $empresa['id_mes']; ?>"
                                data-inicio="<?= htmlspecialchars($empresa['data_obrigacao'] ?? ''); ?>"
                                data-saida="<?= htmlspecialchars($empresa['data_saida'] ?? ''); ?>">
                                <td><?= htmlspecialchars($empresa['codigo']); ?></td>
                                <td title="<?= htmlspecialchars($empresa['empresa']); ?>"><?= htmlspecialchars($empresa['empresa']); ?></td>
                                <td>
                                    <select class="form-select form-select-sm select-responsavel">
                                        <option value="0">Nenhum</option>
                                        <?php foreach ($responsaveis_disponiveis as $responsavel) : ?>
                                            <option value="<?= $responsavel['id']; ?>" <?= ($responsavel['id'] == $empresa['responsavel_id']) ? 'selected' : ''; ?>><?= htmlspecialchars($responsavel['nome']); ?></option>
                                        <?php endforeach; ?>
                                    </select>
                                </td>
                                <td><?= htmlspecialchars($empresa['cnpj']); ?></td>

<td>
    <?php
    $data_saida_situacao = $empresa['data_saida'] ?? null;

    $data_saida_valida = !empty($data_saida_situacao)
        && $data_saida_situacao !== '0000-00-00'
        && strtotime($data_saida_situacao) !== false;

    if ($data_saida_valida) {
        echo '<span class="badge bg-danger">Saiu em '
            . date('Y', strtotime($data_saida_situacao))
            . '</span>';
    } else {
        echo '<span class="badge bg-success">Ativa</span>';
    }
    ?>
</td>

<td><?= htmlspecialchars($empresa['grupo'] ?? ''); ?></td>
                                <td><?= htmlspecialchars($empresa['tributacao'] ?? ''); ?></td>
                                <td class="editable" contenteditable="true" data-coluna="observacoes_contabil"><?= htmlspecialchars($empresa['observacoes_contabil'] ?? ''); ?></td>

                                <td class="meses-trigger text-center" style="cursor: pointer;">
                                    <?php
                                    // Mapeamento de meses
                                    $meses_map = ['janeiro' => 1, 'fevereiro' => 2, 'marco' => 3, 'abril' => 4, 'maio' => 5, 'junho' => 6, 'julho' => 7, 'agosto' => 8, 'setembro' => 9, 'outubro' => 10, 'novembro' => 11, 'dezembro' => 12];
                                    $tudo_completo = true;
                                    $algum_dado = false;
                                    $contador_ok = 0;
                                    $ts_entrada = strtotime($empresa['data_contrato'] ?? '0000-00-00');
                                    $ts_saida = !empty($empresa['data_saida']) && $empresa['data_saida'] !== '0000-00-00' ? strtotime($empresa['data_saida']) : null;

                                    foreach ($meses_map as $col_nome => $mes_num) {
                                        $inicio_mes = mktime(0, 0, 0, $mes_num, 1, $ano_selecionado);
                                        $fim_mes    = mktime(23, 59, 59, $mes_num + 1, 0, $ano_selecionado);

                                        $eh_cliente_neste_mes = true;
                                        if ($ts_entrada > $fim_mes) $eh_cliente_neste_mes = false;
                                        if ($ts_saida && $ts_saida < $inicio_mes) $eh_cliente_neste_mes = false;

                                        $valor = trim($empresa[$col_nome] ?? '');

                                        if (!$eh_cliente_neste_mes) {
                                            // Se não era cliente, conta como OK para o cálculo de 12/12
                                            $contador_ok++;
                                        } else {
                                            // --- ALTERAÇÃO AQUI: Validação estrita ---
                                            if ($valor === 'OK - FINALIZADO') {
                                                $contador_ok++;
                                            } else {
                                                // Se for "DOC. REDE", "COBRANÇA" ou Vazio, falha o completo
                                                $tudo_completo = false;
                                            }

                                            // Mantemos isso para saber se mostramos "Pendente" ou "N/A"
                                            if (!empty($valor)) {
                                                $algum_dado = true;
                                            }
                                        }
                                    }

                                    if ($tudo_completo) {
                                        echo '<span class="badge bg-success">Completo</span>';
                                    } elseif ($algum_dado) {
                                        // Mostra a contagem real baseada apenas nos OK - FINALIZADO
                                        echo '<span class="badge bg-warning text-dark">Pendente (' . $contador_ok . '/12)</span>';
                                    } else {
                                        echo '<span class="badge bg-secondary">Pendente</span>';
                                    }
                                    ?>
                                </td>
                                <td class="editable" contenteditable="true" data-coluna="balancete"><?= htmlspecialchars($empresa['balancete'] ?? ''); ?></td>
                                <td class="editable" contenteditable="true" data-coluna="distribuicao_dirf"><?= htmlspecialchars($empresa['distribuicao_dirf'] ?? ''); ?></td>

                                <?php
                                // --- LÓGICA DE TRIBUTAÇÃO (Normalização) ---
                                $trib_raw = $empresa['tributacao'] ?? '';
                                $trib_lower = mb_strtolower(trim($trib_raw), 'UTF-8');
                                ?>

                                <?php
                                $eh_simples = ($trib_lower === 'simples_nacional' || strpos($trib_lower, 'simples') !== false);
                                $valor_defs = $empresa['defs'] ?? '';
                                ?>
                                <?php if ($eh_simples) : ?>
                                    <td data-coluna="defs" style="padding: 0; min-width: 130px;">
                                        <select class="form-select form-select-sm editable-select" style="border: none; background: transparent; width: 100%; height: 100%; padding: 0.25rem 0.5rem;">
                                            <option value="" class="text-muted" <?= $valor_defs === '' ? 'selected' : '' ?>>Pendente</option>
                                            <option value="PENDENTE" <?= $valor_defs === 'PENDENTE' ? 'selected' : '' ?> style="color: #dc3545; font-weight:bold;">PENDENTE</option>
                                            <option value="ENVIADO" <?= $valor_defs === 'ENVIADO' ? 'selected' : '' ?> style="color: #198754; font-weight:bold;">ENVIADO</option>
                                        </select>
                                    </td>
                                <?php else : ?>
                                    <td class="text-muted bg-light text-center" style="vertical-align: middle; background-color: #f8f9fa;"><small style="opacity: 0.6;">N/A</small></td>
                                <?php endif; ?>

                                <td class="editable" contenteditable="true" data-coluna="dasn"><?= htmlspecialchars($empresa['dasn'] ?? ''); ?></td>

                                <?php
                                // --- LÓGICA PARA ECD E ECF ---
                                // Lista de tributações permitidas para ECD e ECF
                                $tributacoes_ecd_ecf = [
                                    'associações',
                                    'condominios',
                                    'imune_irpj',
                                    'lucro_presumido',
                                    'lucro_real/anual',
                                    'lucro_real/estimativa',
                                    'lucro_real/trimestral'
                                ];

                                // Verifica se a tributação atual está na lista permitida
                                $mostrar_ecd_ecf = in_array($trib_lower, $tributacoes_ecd_ecf);

                                $valor_ecd = $empresa['ecd'] ?? '';
                                $valor_ecf = $empresa['ecf'] ?? '';
                                ?>

                                <?php if ($mostrar_ecd_ecf) : ?>
                                    <td data-coluna="ecd" style="padding: 0; min-width: 130px;">
                                        <select class="form-select form-select-sm editable-select" style="border: none; background: transparent; width: 100%; height: 100%; padding: 0.25rem 0.5rem;">
                                            <option value="" class="text-muted" <?= $valor_ecd === '' ? 'selected' : '' ?>>Pendente</option>
                                            <option value="PENDENTE" <?= $valor_ecd === 'PENDENTE' ? 'selected' : '' ?> style="color: #dc3545; font-weight:bold;">PENDENTE</option>
                                            <option value="ENVIADO" <?= $valor_ecd === 'ENVIADO' ? 'selected' : '' ?> style="color: #198754; font-weight:bold;">ENVIADO</option>
                                        </select>
                                    </td>
                                <?php else : ?>
                                    <td class="text-muted bg-light text-center" style="vertical-align: middle; background-color: #f8f9fa;"><small style="opacity: 0.6;">N/A</small></td>
                                <?php endif; ?>

                                <?php if ($mostrar_ecd_ecf) : ?>
                                    <td data-coluna="ecf" style="padding: 0; min-width: 130px;">
                                        <select class="form-select form-select-sm editable-select" style="border: none; background: transparent; width: 100%; height: 100%; padding: 0.25rem 0.5rem;">
                                            <option value="" class="text-muted" <?= $valor_ecf === '' ? 'selected' : '' ?>>Pendente</option>
                                            <option value="PENDENTE" <?= $valor_ecf === 'PENDENTE' ? 'selected' : '' ?> style="color: #dc3545; font-weight:bold;">PENDENTE</option>
                                            <option value="ENVIADO" <?= $valor_ecf === 'ENVIADO' ? 'selected' : '' ?> style="color: #198754; font-weight:bold;">ENVIADO</option>
                                        </select>
                                    </td>
                                <?php else : ?>
                                    <td class="text-muted bg-light text-center" style="vertical-align: middle; background-color: #f8f9fa;"><small style="opacity: 0.6;">N/A</small></td>
                                <?php endif; ?>

                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>
    <div id="modalDetalhesMeses" class="modal-overlay">
        <div class="modal-container" style="width: 800px; max-width: 95vw;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-calendar-alt"></i> Controle de Meses</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <form id="formMesesDetalhes">
                    <input type="hidden" id="meses_id_controle" name="id_controle">

                    <div class="row g-3">
                        <?php
                        $meses_form = [
                            'janeiro' => 'Janeiro',
                            'fevereiro' => 'Fevereiro',
                            'marco' => 'Março',
                            'abril' => 'Abril',
                            'maio' => 'Maio',
                            'junho' => 'Junho',
                            'julho' => 'Julho',
                            'agosto' => 'Agosto',
                            'setembro' => 'Setembro',
                            'outubro' => 'Outubro',
                            'novembro' => 'Novembro',
                            'dezembro' => 'Dezembro'
                        ];
                        $opcoes = ['COBRANÇA DOC.', 'DOC. REDE', 'OK - FINALIZADO', 'SEM MOVIMENTO']; // Suas opções

                        foreach ($meses_form as $key => $label):
                        ?>
                            <div class="col-md-3 col-6">
                                <label class="form-label small fw-bold"><?= $label ?></label>
                                <select class="form-select form-select-sm" name="<?= $key ?>" id="mes_<?= $key ?>">
                                    <option value="">Pendente</option>
                                    <?php foreach ($opcoes as $opt): ?>
                                        <option value="<?= $opt ?>"><?= $opt ?></option>
                                    <?php endforeach; ?>
                                </select>
                            </div>
                        <?php endforeach; ?>
                    </div>

                    <div class="d-grid gap-2 mt-4">
                        <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Salvar Meses</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    <div id="modalRelatorioExportacaoContabil" class="modal-overlay">
                <div class="modal-container">
                        <div class="modal-header">
                                <h3 class="modal-title"><i class="fas fa-clipboard-check"></i> Análise da Exportação (Contábil)</h3>
                                <button class="modal-close">&times;</button>
                            </div>
                        <div class="modal-body" id="feedback-exportacao-body-contabil">
                                                <div class="loading-content" style="text-align: center; padding: 20px;">
                                        <i class="fas fa-spinner fa-spin fa-2x"></i>
                                        <p style="margin-top: 10px;">Analisando dados para exportação...</p>
                                    </div>
                            </div>
                    </div>
            </div>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script>
        // --- VARIÁVEL GLOBAL DE FILTROS ---
        window.activeColumnFilters = {};

        $(document).ready(function() {

            // =========================================================
            // 1. CONFIGURAÇÃO DE MODAIS (MANTIDA)
            // =========================================================
            // =========================================================
            // FUNÇÃO ATUALIZADA: LER JSON E MONTAR TABELA
            // =========================================================
            function chamarAnaliseExportacaoContabil(ano, mesId) {
                const container = $('#feedback-exportacao-body-contabil');

                // 1. Feedback visual de carregamento
                container.html(`
            <div class="loading-content" style="text-align: center; padding: 20px;">
                <i class="fas fa-spinner fa-spin fa-2x"></i>
                <p style="margin-top: 10px;">Analisando dados do ano ${ano}...</p>
            </div>
        `);

                // 2. Requisição AJAX esperando JSON
                $.ajax({
                    url: 'analisar_exportacao_contabil.php',
                    method: 'GET',
                    data: {
                        ano: ano,
                        mes_id: mesId
                    },
                    dataType: 'json', // Importante: Força o JS a entender que é JSON
                    success: function(response) {
                        if (response.success) {
                            let html = '';

                            // -- Cabeçalho do Resumo --
                            // Se houver falhas, cor vermelha/amarela. Se não, verde.
                            let alertClass = response.falhas.length > 0 ? 'alert-warning' : 'alert-success';
                            let iconClass = response.falhas.length > 0 ? 'fa-exclamation-triangle' : 'fa-check-circle';

                            html += `
                        <div class="alert ${alertClass} d-flex align-items-center" role="alert">
                            <i class="fas ${iconClass} fa-2x me-3" style="margin-right: 15px;"></i>
                            <div>
                                <h5 class="alert-heading mb-1">Resultado da Análise</h5>
                                <p class="mb-0">
                                    Total de Empresas no Mês: <strong>${response.total}</strong><br>
                                    Aptas para Exportação: <strong>${response.validas}</strong>
                                </p>
                            </div>
                        </div>
                    `;

                            // -- Tabela de Erros (Se houver) --
                            if (response.falhas.length > 0) {
                                html += `
                            <div class="mt-3">
                                <h6><i class="fas fa-times-circle text-danger"></i> Empresas com Pendências (${response.falhas.length})</h6>
                                <p class="text-muted small">Estas empresas <strong>não aparecerão</strong> no Excel final pelos motivos abaixo:</p>
                                <div class="table-responsive" style="max-height: 300px; overflow-y: auto;">
                                    <table class="table table-sm table-bordered table-hover">
                                        <thead class="table-light">
                                            <tr>
                                                <th>Cód</th>
                                                <th>Empresa</th>
                                                <th>Motivo da Falha</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                        `;

                                // Loop pelos erros retornados pelo PHP
                                response.falhas.forEach(function(item) {
                                    html += `
                                <tr>
                                    <td>${item.codigo}</td>
                                    <td>${item.empresa}</td>
                                    <td class="text-danger small">${item.motivo}</td>
                                </tr>
                            `;
                                });

                                html += `
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        `;
                            } else {
                                // -- Sucesso Total --
                                html += `
                            <div class="text-center mt-4">
                                <p class="text-success fw-bold">Todas as empresas do mês estão validadas!</p>
                                <a href="exportar_contabil.php?ano=${ano}&mes_id=${mesId}" class="btn btn-success btn-lg">
                                    <i class="fas fa-file-excel"></i> Baixar Excel Agora
                                </a>
                            </div>
                        `;
                            }

                            // Injeta o HTML montado no modal
                            container.html(html);

                        } else {
                            // Caso o PHP retorne success: false
                            container.html(`<div class="alert alert-danger">${response.message}</div>`);
                        }
                    },
                    error: function(xhr, status, error) {
                        console.error("Erro AJAX:", xhr.responseText);
                        container.html(`
                    <div class="alert alert-danger">
                        <h4><i class="fas fa-exclamation-circle"></i> Erro Técnico</h4>
                        <p>O servidor retornou um erro inválido. Verifique o console (F12).</p>
                    </div>
                `);
                    }
                });
            }

            function setupModais() {
                const modais = {
                    'btnCertificadosVencendo': 'modalCertificadosVencendo',
                    'btnProcuracoesVencendo': 'modalProcuracoesVencendo',
                    'btn-preparar-exportacao-contabil': 'modalRelatorioExportacaoContabil'
                };

                Object.keys(modais).forEach(botaoId => {
                    const botao = document.getElementById(botaoId);
                    if (botao) {
                        botao.addEventListener('click', () => {
                            const modal = document.getElementById(modais[botaoId]);
                            if (modal) {
                                modal.classList.add('active');
                                document.body.style.overflow = 'hidden';
                                if (botaoId === 'btn-preparar-exportacao-contabil') {
                                    chamarAnaliseExportacaoContabil(botao.dataset.ano, botao.dataset.mesId);
                                }
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
                                if (!document.querySelector('.modal-overlay.active')) {
                                    document.body.style.overflow = '';
                                }
                            }
                        }
                    });
                });
            }
            setupModais();

            // =========================================================
            // 2. NAVEGAÇÃO COM ENTER (MANTIDA)
            // =========================================================
            function setupEnterKeyNavigation() {
                $('.data-table tbody').on('keydown', '.editable', function(event) {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        const currentCell = $(this);
                        const cellIndex = currentCell.index();
                        const nextRow = currentCell.closest('tr').next('tr');
                        if (nextRow.length > 0) {
                            const targetCell = nextRow.find('td').eq(cellIndex);
                            const focusable = targetCell.find('select, [contenteditable="true"]');
                            if (focusable.length > 0) focusable.focus();
                            else if (targetCell.hasClass('editable')) targetCell.focus();
                        }
                    }
                });
            }
            setupEnterKeyNavigation();
            // ---------------------------------------------------------
            // 3. LÓGICA DE FILTROS (ATUALIZADA PARA LER SELECTS)
            // ---------------------------------------------------------
            function applyAllFilters() {
                const searchTerm = $('#searchInput').val().toLowerCase().trim();

                $('.data-table tbody tr').each(function() {
                    let row = $(this);
                    let showRow = true;

                    // A. Busca Rápida
                    if (searchTerm) {
                        // Verifica texto nas colunas principais (Código, Empresa, CNPJ)
                        const rowText = row.find('td:lt(5)').text().toLowerCase();
                        if (!rowText.includes(searchTerm)) showRow = false;
                    }

                    // B. Filtros de Coluna
                    if (showRow) {
                        for (const columnKey in window.activeColumnFilters) {
                            const selectedOptions = window.activeColumnFilters[columnKey];
                            if (selectedOptions) { // Se o array existe (mesmo vazio)
                                const th = $(`.data-table th[data-column="${columnKey}"]`);
                                const cellIndex = th.index();
                                const cell = row.find('td').eq(cellIndex);

                                let cellValue = "";

                                // [MODIFICAÇÃO] Se for um SELECT (como Responsável), pega o TEXTO da opção selecionada
                                if (cell.find('select').length > 0) {
                                    cellValue = cell.find('select option:selected').text().trim();
                                } else {
                                    cellValue = cell.text().trim();
                                }

                                if (cellValue === null || cellValue === "") cellValue = "Pendente";

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

            $('#searchInput').on('keyup input', function() {
                applyAllFilters();
            });

            // Abrir Menu
            $('.data-table').on('click', 'th.filterable .filter-icon', function(e) {
                e.stopPropagation();
                $('.filter-menu').remove();

                const th = $(this).closest('th');
                const columnKey = th.data('column');
                const columnIndex = th.index();
                const options = new Set();

                // Coleta valores da coluna
                $('.data-table tbody tr').each(function() {
                    let cell = $(this).find('td').eq(columnIndex);
                    let val;
                    // [MODIFICAÇÃO] Pega o texto visível do select para criar a lista de filtros
                    if (cell.find('select').length > 0) {
                        val = cell.find('select option:selected').text().trim();
                    } else {
                        val = cell.text().trim();
                    }
                    options.add(val || "Pendente");
                });

                const allOptionsArray = Array.from(options).sort();

                // Define quais estão marcados (se não existe filtro salvo, marca todos)
                let currentActive;
                if (window.activeColumnFilters[columnKey]) {
                    currentActive = window.activeColumnFilters[columnKey];
                } else {
                    currentActive = allOptionsArray;
                }

                let optionsHtml = '';
                allOptionsArray.forEach(opt => {
                    const isChecked = currentActive.includes(opt) ? 'checked' : '';
                    optionsHtml += `<label style="display:block; margin-bottom:5px; cursor:pointer;">
                        <input type="checkbox" class="filter-checkbox" value="${opt}" ${isChecked}> ${opt}
                    </label>`;
                });

                const totalOptions = allOptionsArray.length;
                const checkedCount = currentActive.length;
                const btnText = (checkedCount === totalOptions) ? "Deselecionar Todos" : "Selecionar Todos";

                const menuHtml = `
                    <div class="filter-menu">
                        <div class="filter-menu-header">Filtrar: ${th.text().replace('Filtrar','').trim()}</div>
                        <div class="filter-menu-options" style="max-height: 200px; overflow-y: auto; margin-bottom: 10px;">${optionsHtml}</div>
                        <div class="filter-menu-footer" style="display:flex; justify-content:space-between; gap:5px;">
                            <button type="button" class="btn btn-outline-secondary btn-sm btn-toggle-all" style="font-size: 0.8rem;">${btnText}</button>
                            <button type="button" class="btn btn-primary btn-sm btn-apply-filter">Aplicar</button>
                        </div>
                    </div>`;

                th.append(menuHtml);
                th.find('.filter-menu').fadeIn(100);
            });

            // Botão Toggle All
            $(document).on('click', '.btn-toggle-all', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const menu = $(this).closest('.filter-menu');
                const checkboxes = menu.find('.filter-checkbox');
                const total = checkboxes.length;
                const checked = checkboxes.filter(':checked').length;

                if (checked === total) {
                    checkboxes.prop('checked', false);
                    $(this).text("Selecionar Todos");
                } else {
                    checkboxes.prop('checked', true);
                    $(this).text("Deselecionar Todos");
                }
            });

            // Botão Aplicar
            $(document).on('click', '.btn-apply-filter', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const menu = $(this).closest('.filter-menu');
                const th = menu.closest('th');
                const columnKey = th.data('column');
                const selected = [];
                const checkboxes = menu.find('.filter-checkbox');
                checkboxes.filter(':checked').each(function() {
                    selected.push($(this).val());
                });

                if (selected.length === checkboxes.length) {
                    delete window.activeColumnFilters[columnKey];
                    th.removeClass('filter-active');
                } else {
                    window.activeColumnFilters[columnKey] = selected;
                    th.addClass('filter-active');
                }
                applyAllFilters();
                menu.remove();
            });

            $(document).on('click', function(e) {
                if (!$(e.target).closest('.filter-menu').length) $('.filter-menu').remove();
            });

            // =========================================================
            // 4. EDIÇÃO E SALVAMENTO (MANTIDA)
            // =========================================================
            function salvarEdicao(elemento) {
                const cell = $(elemento);
                const row = cell.closest('tr');
                const id = row.data('id');
                const coluna = cell.data('coluna');
                const valor = cell.is('[contenteditable]') ? cell.text().trim() : cell.find('.editable-select').val();

                cell.css('opacity', 0.5);

                $.ajax({
                    url: 'salvar_edicao_contabil.php',
                    method: 'POST',
                    data: {
                        id,
                        coluna,
                        valor
                    },
                    dataType: 'json',
                    success: function(response) {
                        if (response.success) {
                            cell.css('border-color', 'green');
                        } else {
                            cell.css('border-color', 'red');
                        }
                    },
                    error: function() {
                        cell.css('border-color', 'red');
                    },
                    complete: function() {
                        cell.css('opacity', 1);
                        setTimeout(() => cell.css('border-color', ''), 2000);
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

            $('.select-responsavel').on('change', function() {
                const selectElement = $(this);
                const row = selectElement.closest('tr');
                const empresaId = row.data('id');
                const idMes = row.data('id-mes');
                const novoResponsavelId = selectElement.val();

                if (!idMes) {
                    alert('Erro: Mês não identificado.');
                    return;
                }

                $.ajax({
                    url: 'salvar_responsavel.php',
                    method: 'POST',
                    data: {
                        id_empresa: empresaId,
                        id_mes: idMes,
                        novo_responsavel_id: novoResponsavelId,
                        tipo_tarefa: 'contabil',
                        ano_referencia: $('#ano').val()
                    },
                    dataType: 'json',
                    success: function(res) {
                        if (res.success) {
                            selectElement.css('border-color', 'green');
                            setTimeout(() => selectElement.css('border-color', ''), 2000);
                        } else {
                            alert('Erro: ' + res.message);
                        }
                    }
                });
            });

            // --- LÓGICA DO MODAL DE MESES (ATUALIZADA) ---
            $(document).on('click', '.meses-trigger', function() {
                const r = $(this).closest('tr');
                const id = r.data('id');

                $('#modalDetalhesMeses').addClass('active');
                $('#meses_id_controle').val(id);

                // 1. Reseta o formulário completamente
                const selectores = $('#formMesesDetalhes select');
                selectores.each(function() {
                    $(this).prop('disabled', false)
                        .css('background-color', '')
                        .css('color', '')
                        .val(''); // Limpa seleção

                    // Remove opção 'NAO_CLIENTE' antiga se existir para não duplicar
                    $(this).find('option[value="NAO_CLIENTE"]').remove();
                });

                // 2. Pega as datas e o ano selecionado no filtro principal
                const dataInicioStr = r.data('inicio'); // Agora pega data_obrigacao
                const dataSaidaStr = r.data('saida');
                const anoSelecionado = parseInt($('#ano').val());

                // Função auxiliar para criar objeto Date (lida com YYYY-MM-DD)
                const parseData = (str) => {
                    if (!str || str === '0000-00-00') return null;
                    const parts = str.split('-'); // O PHP envia como Y-m-d
                    // Cria data as 12:00 para evitar problemas de fuso horário
                    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
                };

                const dataInicio = parseData(dataInicioStr);
                const dataSaida = parseData(dataSaidaStr);

                // 3. Itera sobre os meses para aplicar o bloqueio visual
                const meses = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

                meses.forEach((mesNome, index) => {
                    const mesNum = index; // 0 = Janeiro, 11 = Dezembro
                    const select = $('#mes_' + mesNome);

                    // Define o intervalo de tempo desse mês no ano selecionado
                    // Primeiro dia do mês as 00:00
                    const inicioMesAtual = new Date(anoSelecionado, mesNum, 1, 0, 0, 0);
                    // Último dia do mês as 23:59
                    const fimMesAtual = new Date(anoSelecionado, mesNum + 1, 0, 23, 59, 59);

                    let bloquear = false;

                    // A. Bloqueia se a data de obrigação for DEPOIS do fim deste mês
                    // Ex: Obrigação começa em Março. Janeiro e Fevereiro bloqueiam.
                    if (dataInicio && dataInicio > fimMesAtual) {
                        bloquear = true;
                    }

                    // B. Bloqueia se a data de saída for ANTES do início deste mês
                    // Ex: Saiu em Maio. Junho em diante bloqueia.
                    if (dataSaida && dataSaida < inicioMesAtual) {
                        bloquear = true;
                    }

                    if (bloquear) {
                        // Adiciona a opção "NAO_CLIENTE"
                        select.append('<option value="NAO_CLIENTE">NÃO É CLIENTE</option>');
                        select.val('NAO_CLIENTE');
                        select.prop('disabled', true); // Bloqueia o campo
                        select.css({
                            'background-color': '#e9ecef', // Cinza
                            'color': '#dc3545', // Texto vermelho
                            'font-weight': 'bold',
                            'font-size': '0.75rem'
                        });
                    }
                });

                // 4. Busca os dados reais do banco via AJAX
                // Importante: Só preenchemos o valor se o campo NÃO estiver bloqueado pela data.
                // Isso garante que a regra da data prevaleça visualmente.
                $.getJSON('assets/backend/obter_detalhes_meses.php', {
                    id: id
                }, function(res) {
                    if (res.success) {
                        $.each(res.dados, (key, value) => {
                            const select = $('#mes_' + key);

                            // Se o campo não estiver desabilitado (ou seja, é um mês válido), preenche com o valor do banco
                            if (!select.prop('disabled')) {
                                select.val(value);
                            }
                            // Se o banco tiver um valor mas a data diz que deve bloquear, 
                            // mantemos bloqueado como "NAO_CLIENTE" (regra de negócio da data vence).
                        });
                    }
                });
            });

            // O código de salvar (submit) continua igual ao que te passei antes, 
            // pois ele já trata campos disabled habilitando-os temporariamente.
            // [LÓGICA ATUALIZADA] - Salvar e atualizar visualmente com regra estrita
            $('#formMesesDetalhes').on('submit', function(e) {
                e.preventDefault();

                // Habilita campos desabilitados temporariamente para enviar "NAO_CLIENTE"
                const camposDesabilitados = $(this).find('select:disabled');
                camposDesabilitados.prop('disabled', false);

                // Cálculo para atualizar a UI imediatamente (X/Y)
                let totalContrato = 0; // Total de meses que a empresa é cliente
                let totalPreenchido = 0; // Total de meses com "OK - FINALIZADO"

                $(this).find('select').each(function() {
                    let valor = $(this).val();

                    // Se for NAO_CLIENTE, ignoramos na contagem
                    if (valor !== 'NAO_CLIENTE') {
                        totalContrato++;

                        // --- AQUI ESTÁ A MUDANÇA NO JS ---
                        // Só incrementa o contador de sucesso se for exatamente "OK - FINALIZADO"
                        if (valor === 'OK - FINALIZADO') {
                            totalPreenchido++;
                        }
                    }
                });

                const dados = $(this).serialize();
                const id = $('#meses_id_controle').val();

                // Desabilita de volta os campos que eram travados
                camposDesabilitados.prop('disabled', true);

                $.post('assets/backend/salvar_detalhes_meses.php', dados, function(r) {
                    if (r.success) {
                        $('#modalDetalhesMeses').removeClass('active');

                        // Atualiza a bolinha visualmente na tabela
                        const celula = $(`.data-table tr[data-id="${id}"] .meses-trigger`);

                        if (totalContrato === 0) {
                            celula.html('<span class="badge bg-secondary">N/A</span>');
                        } else if (totalPreenchido === totalContrato) {
                            // Só fica verde se TUDO for "OK - FINALIZADO"
                            celula.html('<span class="badge bg-success">Completo</span>');
                        } else {
                            // Caso contrário, mostra pendente amarelo com a contagem (ex: 10/12)
                            celula.html(`<span class="badge bg-warning text-dark">Pendente (${totalPreenchido}/${totalContrato})</span>`);
                        }

                    } else {
                        alert('Erro ao salvar: ' + r.message);
                    }
                }, 'json').fail(function() {
                    alert('Erro de comunicação com o servidor.');
                });
            });
            $('.modal-close').click(function() {
                $(this).closest('.modal-overlay').removeClass('active');
            });
        });
    </script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>

    <script src="scripts_globais.js"></script>

</body>

</html>