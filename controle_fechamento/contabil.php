<?php
session_start();
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once 'assets/backend/config.php';

// 1. VERIFICAÇÃO DE ACESSO
if (!isset($_SESSION['usuario_id'])) {
    $_SESSION['mensagem'] = 'Por favor, faça login para acessar esta página';
    header('Location: index.php');
    exit();
}

$permissoes_permitidas = ['contabil', 'lider_contabil', 'admin'];
if (!isset($_SESSION['tipo_conta']) || !in_array($_SESSION['tipo_conta'], $permissoes_permitidas)) {
    $_SESSION['mensagem'] = 'Acesso restrito à área Contábil.';
    header('Location: index.php');
    exit();
}

$usuario_logado_id = $_SESSION['usuario_id'];
$tipo_conta_logado = $_SESSION['tipo_conta'];
$usuario_id_alvo = $usuario_logado_id;

// Permite ver como outro funcionário (apenas Líder e Admin)
$id_funcionario_get = filter_input(INPUT_GET, 'ver_como', FILTER_VALIDATE_INT);
if ($id_funcionario_get && (strpos($tipo_conta_logado, 'lider_') === 0 || $tipo_conta_logado === 'admin')) {
    $usuario_id_alvo = $id_funcionario_get;
}

$params_adicionais_url = $id_funcionario_get ? "&ver_como=" . $id_funcionario_get : "";
$usuario_id = $usuario_id_alvo;

// Pega nome do usuário alvo
$stmt_nome = $conexao->prepare("SELECT nome FROM usuarios WHERE id = ?");
$stmt_nome->bind_param('i', $usuario_id);
$stmt_nome->execute();
$usuario_nome = $stmt_nome->get_result()->fetch_assoc()['nome'] ?? 'Usuário Contábil';
$stmt_nome->close();

$ano_atual = date('Y');
$mes_atual_num = date('n'); // Mês atual (1 a 12)
$meses_pt = [1 => 'Janeiro', 2 => 'Fevereiro', 3 => 'Março', 4 => 'Abril', 5 => 'Maio', 6 => 'Junho', 7 => 'Julho', 8 => 'Agosto', 9 => 'Setembro', 10 => 'Outubro', 11 => 'Novembro', 12 => 'Dezembro'];

// --- CONFIGURAÇÃO DE FILTROS ---
$filtros = [
    'ano'    => isset($_GET['ano']) ? (int)$_GET['ano'] : $ano_atual,
    'busca'  => $_GET['busca'] ?? '',
    'status' => $_GET['status'] ?? 'ativas',
    'sort'   => $_GET['sort'] ?? 'codigo',
    'dir'    => $_GET['dir'] ?? 'ASC'
];
$ano_selecionado = $filtros['ano'];
$stmt_mes_exportacao = $conexao->prepare(
    "SELECT id
     FROM controle_meses
     WHERE ano = ? AND mes = ?
     LIMIT 1"
);

$mes_exportacao_id = null;

if ($stmt_mes_exportacao) {
    $stmt_mes_exportacao->bind_param(
        'ii',
        $ano_selecionado,
        $mes_atual_num
    );

    $stmt_mes_exportacao->execute();

    $resultado_mes_exportacao = $stmt_mes_exportacao->get_result();

    if ($registro_mes_exportacao = $resultado_mes_exportacao->fetch_assoc()) {
        $mes_exportacao_id = (int) $registro_mes_exportacao['id'];
    }

    $stmt_mes_exportacao->close();
}
// 2. FUNÇÕES DE BUSCA

function obterAnosDisponiveis($conexao, $usuario_id)
{
    // Busca anos onde o usuário tem vínculo na tabela de responsaveis
    $query = "SELECT DISTINCT cm.ano 
              FROM controle_meses cm 
              JOIN responsaveis_empresa re ON cm.id = re.id_mes 
              WHERE re.id_usuario = ? AND re.tipo_tarefa = 'contabil' 
              ORDER BY ano DESC";
    $stmt = $conexao->prepare($query);
    $stmt->bind_param('i', $usuario_id);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}
function obterEmpresasContabeis($conexao, $usuario_id, $ano, $mes_ref, $filtros)
{
    $coluna_ordem = in_array($filtros['sort'], ['codigo', 'empresa']) ? $filtros['sort'] : 'codigo';
    $direcao_ordem = ($filtros['dir'] === 'DESC') ? 'DESC' : 'ASC';

    // QUERY PARA EVITAR DUPLICATAS
    $sql = "
        SELECT 
            cf.*, 
            DATE_FORMAT(cf.data_obrigacao, '%d/%m/%Y') as data_obrigacao_formatada,
            DATE_FORMAT(cf.data_saida, '%d/%m/%Y') as data_saida_formatada,
            DATE_FORMAT(cf.data_contrato, '%d/%m/%Y') as data_contrato_formatada
        FROM controle_fechamento cf
        JOIN controle_meses cm ON cf.id_mes = cm.id
        WHERE cm.ano = ?
    ";

    // SUBQUERY: Garante que pega apenas o MAIOR mês registrado para a empresa no ano
    $sql .= " AND cm.mes = (
                SELECT MAX(cm2.mes)
                FROM controle_fechamento cf2
                JOIN controle_meses cm2 ON cf2.id_mes = cm2.id
                WHERE cf2.codigo = cf.codigo 
                  AND cm2.ano = cm.ano
              ) ";

    // VÍNCULO DO USUÁRIO
    $sql .= " AND EXISTS (
        SELECT 1 
        FROM responsaveis_empresa re
        WHERE re.id_empresa = cf.id
          AND re.id_usuario = ?
          AND re.tipo_tarefa = 'contabil'
          AND re.responsavel_atual = 1
    )";

    $params = [$ano, $usuario_id];
    $types = "ii";

    if (!empty($filtros['busca'])) {
        $busca = "%{$filtros['busca']}%";
        $sql .= " AND (cf.codigo LIKE ? OR cf.empresa LIKE ? OR cf.cnpj LIKE ?)";
        $params[] = $busca;
        $params[] = $busca;
        $params[] = $busca;
        $types .= "sss";
    }

    $inicio_ano_selecionado = "$ano-01-01";
    if ($filtros['status'] === 'ativas') {
        $sql .= " AND (cf.data_saida IS NULL OR cf.data_saida = '0000-00-00' OR cf.data_saida >= '$inicio_ano_selecionado')";
    } elseif ($filtros['status'] === 'inativas') {
        $sql .= " AND (cf.data_saida IS NOT NULL AND cf.data_saida != '0000-00-00' AND cf.data_saida < '$inicio_ano_selecionado')";
    }

    // GROUP BY EXTRA DE SEGURANÇA
    $sql .= " GROUP BY cf.codigo ";

    if ($coluna_ordem === 'codigo') {
        $sql .= " ORDER BY CAST(cf.codigo AS UNSIGNED) $direcao_ordem";
    } else {
        $sql .= " ORDER BY cf.$coluna_ordem $direcao_ordem";
    }

    $stmt = $conexao->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}
// [RESTAURADO] Funções de Estatísticas
function obterNovasObrigacoesMes($conexao, $usuario_id, $mes, $ano)
{
    // Busca empresas onde a data de obrigação é neste mês/ano
    $stmt = $conexao->prepare("SELECT cf.* FROM controle_fechamento cf JOIN responsaveis_empresa re ON cf.id = re.id_empresa WHERE re.id_usuario = ? AND re.tipo_tarefa = 'contabil' AND MONTH(cf.data_obrigacao) = ? AND YEAR(cf.data_obrigacao) = ? AND re.responsavel_atual = 1");
    $stmt->bind_param('iii', $usuario_id, $mes, $ano);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}
function obterObrigacoesFuturas($conexao, $usuario_id)
{
    $stmt = $conexao->prepare("SELECT cf.* FROM controle_fechamento cf JOIN responsaveis_empresa re ON cf.id = re.id_empresa WHERE re.id_usuario = ? AND re.tipo_tarefa = 'contabil' AND cf.data_obrigacao > CURDATE() AND re.responsavel_atual = 1");
    $stmt->bind_param('i', $usuario_id);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}
function obterEmpresasSaindo($conexao, $usuario_id)
{
    $stmt = $conexao->prepare("SELECT cf.* FROM controle_fechamento cf JOIN responsaveis_empresa re ON cf.id = re.id_empresa WHERE re.id_usuario = ? AND re.tipo_tarefa = 'contabil' AND cf.data_saida > CURDATE() AND re.responsavel_atual = 1");
    $stmt->bind_param('i', $usuario_id);
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

// Função auxiliar para links de ordenação
function generateSortLink($filtros, $column, $params_adicionais)
{
    $new_dir = ($filtros['sort'] === $column && $filtros['dir'] === 'ASC') ? 'DESC' : 'ASC';
    $icon = '<i class="fas fa-sort" style="opacity:0.3;"></i>';
    if ($filtros['sort'] === $column) {
        $icon = $filtros['dir'] === 'ASC' ? '<i class="fas fa-sort-up"></i>' : '<i class="fas fa-sort-down"></i>';
    }
    $query = http_build_query(array_merge($filtros, ['sort' => $column, 'dir' => $new_dir]));
    return "<a href='?{$query}{$params_adicionais}'>{$column} {$icon}</a>";
}

// EXECUÇÃO
// EXECUÇÃO
$anos_disponiveis = obterAnosDisponiveis($conexao, $usuario_id);

// 1. CRIAMOS UMA CÓPIA DOS FILTROS PARA O SQL IGNORAR A TRAVA E TRAZER TUDO
$filtros_sql = $filtros;
$filtros_sql['status'] = 'todas';

// 2. PASSAMOS $filtros_sql NO LUGAR DE $filtros PARA A FUNÇÃO
// Passamos o mês atual ($mes_atual_num) para filtrar as responsabilidades
$empresas = obterEmpresasContabeis($conexao, $usuario_id, $ano_selecionado, $mes_atual_num, $filtros_sql);

// =======================================================================
// == FILTRO DE EXIBIÇÃO TEMPORAL (EMPRESAS QUE JÁ SAÍRAM) ==
// =======================================================================
if (!empty($empresas)) {
    $empresas = array_filter($empresas, function ($empresa) use ($filtros, $ano_selecionado) {
        
        $status_filtro = $filtros['status'] ?? 'ativas';
        $data_saida = $empresa['data_saida'] ?? null;
        
        // Verifica se a empresa tem uma data de saída válida registrada
        $saiu = (!empty($data_saida) && $data_saida !== '0000-00-00');
        $ano_saida = $saiu ? (int)date('Y', strtotime($data_saida)) : null;

        // REGRA DE OURO: Ela é considerada "Ativa" no contexto deste painel SE:
        // - Nunca saiu (não tem data_saida) OU
        // - A data que saiu é MAIOR ou IGUAL ao ano da planilha que estamos visualizando.
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

$num_empresas = count($empresas);


// Estatísticas Reais
$novas_obrigacoes_mes = obterNovasObrigacoesMes($conexao, $usuario_id, $mes_atual_num, $ano_atual);
$obrigacoes_futuras = obterObrigacoesFuturas($conexao, $usuario_id);
$empresas_saindo = obterEmpresasSaindo($conexao, $usuario_id);

// CÁLCULOS VISUAIS (Progresso e Gráficos)
$campos_editaveis = 0;
$campos_preenchidos = 0;
$contadores_mensais = [];
$meses_colunas = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
$opcoes_status = ['OK - FINALIZADO', 'DOC. REDE', 'Pendente'];

foreach ($meses_colunas as $mc) {
    $contadores_mensais[$mc] = ['total_relevante' => 0, 'status' => array_fill_keys($opcoes_status, 0)];
    if (!isset($contadores_mensais[$mc]['status']['Pendente'])) $contadores_mensais[$mc]['status']['Pendente'] = 0;
}
$outros_campos = ['balancete', 'distribuicao_dirf', 'defs', 'dasn', 'ecd', 'ecf'];

foreach ($empresas as $empresa) {
    // Lógica de datas (Para cálculo de progresso)
    $data_obrigacao = $empresa['data_obrigacao'] ?? null;
    $ano_obrigacao = $data_obrigacao ? date('Y', strtotime($data_obrigacao)) : null;
    $mes_obrigacao = $data_obrigacao ? date('m', strtotime($data_obrigacao)) : null;
    $data_saida = $empresa['data_saida'] ?? null;
    $ano_saida = $data_saida ? date('Y', strtotime($data_saida)) : null;
    $mes_saida = $data_saida ? date('m', strtotime($data_saida)) : null;

    // Contagem Global
    foreach (array_merge($meses_colunas, $outros_campos) as $campo) {
        $campos_editaveis++;
        if (!empty($empresa[$campo])) $campos_preenchidos++;
    }

    // Contagem Mensal para Gráficos
    foreach ($meses_colunas as $index => $mes_coluna) {
        $mes_numero = $index + 1;
        // Verifica se a empresa era cliente neste mês
        $is_cliente = !(
            ($data_obrigacao && ($ano_selecionado < $ano_obrigacao || ($ano_selecionado == $ano_obrigacao && $mes_numero < $mes_obrigacao))) ||
            ($data_saida && ($ano_selecionado > $ano_saida || ($ano_selecionado == $ano_saida && $mes_numero > $mes_saida)))
        );

        if ($is_cliente) {
            $contadores_mensais[$mes_coluna]['total_relevante']++;
            $valor = $empresa[$mes_coluna] ?? '';
            if (empty($valor)) $contadores_mensais[$mes_coluna]['status']['Pendente']++;
            elseif (isset($contadores_mensais[$mes_coluna]['status'][$valor])) $contadores_mensais[$mes_coluna]['status'][$valor]++;
        }
    }
}

$porcentagem_preenchido = $campos_editaveis > 0 ? round(($campos_preenchidos / $campos_editaveis) * 100) : 0;
$porcentagens_mensais = [];
foreach ($contadores_mensais as $m => $d) {
    $porcentagens_mensais[$m] = [];
    if ($d['total_relevante'] > 0) {
        foreach ($d['status'] as $s => $c) $porcentagens_mensais[$m][$s] = round(($c / $d['total_relevante']) * 100);
    }
}
$mostrar_editaveis = isset($_GET['editaveis']) && $_GET['editaveis'] == '1';
?>

<!DOCTYPE html>
<html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contábil</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">
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
            white-space: nowrap;
        }

        /* Empresa: permite quebra de linha e mostra o nome completo via tooltip */
        .data-table th:nth-child(2),
        .data-table td:nth-child(2) {
            /* Removido truncamento para permitir nomes longos */
            /* max-width: 250px; overflow: hidden; text-overflow: ellipsis; */
            white-space: normal;
            word-wrap: break-word;
            min-width: 250px;
            width: 360px; /* alinhado com versão admin para exibir nomes completos */
        }

        /* COLUNAS FIXAS (padronizado) */
        .data-table th:nth-child(1),
        .data-table td:nth-child(1) {
            position: sticky;
            left: 0;
            z-index: 11;
            width: 100px;
            min-width: 100px;
        }

        .data-table th:nth-child(2),
        .data-table td:nth-child(2) {
            position: sticky;
            left: 100px;
            z-index: 11;
            width: 360px;
            min-width: 360px;
        }

        /* CNPJ agora é a 3ª Coluna Fixa */
        .data-table th:nth-child(3),
        .data-table td:nth-child(3) {
            position: sticky;
            left: 460px; /* ajustado conforme largura da coluna Empresa (100 + 360 = 460) */
            z-index: 11;
            width: 150px;
            min-width: 150px;
            border-right: 2px solid var(--border-color);
        }

        .data-table td:nth-child(-n+3) {
            background-color: var(--card-bg);
            z-index: 11;
        }

        .data-table th:nth-child(-n+3) {
            z-index: 12;
        }

        .data-table tr:hover td:nth-child(-n+3) {
            background-color: var(--card-bg) !important;
        }

        /* ESTILO ÍCONE FILTRO */
        .filter-icon {
            margin-left: 5px;
            opacity: 0.6;
            cursor: pointer;
            font-size: 0.85em;
        }

        .filter-icon:hover {
            opacity: 1;
            color: #fff;
        }

        .filter-active .filter-icon {
            color: #ffeb3b;
            opacity: 1;
        }

        /* Estilo Não Cliente */
        .nao-cliente {
            background-color: #e9ecef !important;
            color: #adb5bd;
            pointer-events: none;
        }
    </style>
</head>

<body>

    <div id="modalDetalhesMeses" class="modal-overlay">
        <div class="modal-container" style="width:800px;max-width:95vw;">
            <div class="modal-header">
                <h3 class="modal-title">Controle de Meses</h3><button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <form id="formMesesDetalhes"><input type="hidden" id="meses_id_controle" name="id_controle">
                    <div class="row g-3"><?php $ops = ['COBRANÇA DOC.', 'DOC. REDE', 'OK - FINALIZADO', 'SEM MOVIMENTO'];
                                            foreach ($meses_colunas as $mc): ?><div class="col-md-3 col-6"><label class="form-label small fw-bold"><?= ucfirst($mc) ?></label><select class="form-select form-select-sm" name="<?= $mc ?>" id="mes_<?= $mc ?>">
                                    <option value="">Pendente</option><?php foreach ($ops as $o): ?><option value="<?= $o ?>"><?= $o ?></option><?php endforeach; ?>
                                </select></div><?php endforeach; ?></div>
                    <div class="d-grid gap-2 mt-4"><button type="submit" class="btn btn-primary">Salvar Meses</button></div>
                </form>
            </div>
        </div>
    </div>

    <div id="passwordModalOverlay" class="modal-overlay">
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-shield-alt"></i> <span>Alterar Senha</span></h3><button class="modal-close" id="closePasswordModalBtn">&times;</button>
            </div>
            <div class="modal-body">
                <form id="changePasswordForm" novalidate>
                    <div class="form-group"><label for="senha_atual">Senha Atual</label><input type="password" id="senha_atual" name="senha_atual" class="form-input" required></div>
                    <div class="form-group"><label for="nova_senha">Nova Senha</label><input type="password" id="nova_senha" name="nova_senha" class="form-input" required></div>
                    <div class="form-group"><label for="confirmar_senha">Confirmar Nova Senha</label><input type="password" id="confirmar_senha" name="confirmar_senha" class="form-input" required></div>
                    <div id="modal-message" class="modal-message"></div>
                    <div class="form-actions"><button type="submit" class="btn"><i class="fas fa-save"></i> <span>Salvar Alterações</span></button></div>
                </form>
            </div>
        </div>
    </div>

    <div class="progress-container-main">
        <div class="progress-bar-main" style="width: <?php echo $porcentagem_preenchido; ?>%"></div>
    </div>
    <div class="progress-text"><i class="fas fa-chart-line"></i> <span>Progresso: <?php echo $porcentagem_preenchido; ?>%</span></div>

    <header class="header">
        <div>
            <h1>Bem vindo(a), <?= htmlspecialchars($usuario_nome) ?></h1>
        </div>
        <div style="display: flex; align-items: center; gap: 1rem;">
                <a href="contabil_admin.php" target="_blank" class="btn-voltar" style="text-decoration: none; margin-right: 1rem;"><i class="fas fa-arrow-left"></i> Visão Geral</a>
            <div class="header-icon" id="changePasswordBtn" title="Alterar Senha"><i class="fas fa-key"></i></div>
            <div class="header-icon" id="logoutBtn" title="Sair"><i class="fas fa-sign-out-alt"></i></div>
        </div>
        <nav class="notifications-nav">
            <h3>Notificações (<span class="notification-count">0</span>)</h3>
            <div class="notifications-list"></div>
        </nav>
    </header>

    <div class="main-content">

        <div class="stats-container">
            <div class="stats-box animate__animated animate__fadeInLeft">
                <div class="wave-effect">
                    <div class="wave"></div>
                    <div class="wave"></div>
                    <div class="wave"></div>
                </div>
                <h3><i class="fas fa-building"></i> Empresas Ativas</h3>
                <div class="stats-numbers"><?php echo $num_empresas; ?> empresas</div>
                <p>Ano: <?php echo $ano_selecionado; ?></p>
                <div class="progress-container">
                    <div class="progress-bar" style="width: 100%"></div>
                </div>
            </div>
            <div class="stats-box animate__animated animate__fadeInLeft" style="animation-delay: 0.1s">
                <div class="wave-effect">
                    <div class="wave"></div>
                    <div class="wave"></div>
                    <div class="wave"></div>
                </div>
                <h3><i class="fas fa-calendar-plus"></i> Novas Obrigações</h3>
                <div class="stats-numbers"><?php echo count($novas_obrigacoes_mes); ?> este mês</div>
                <p><?php echo $meses_pt[$mes_atual_num] . ' ' . $ano_atual; ?></p>
                <div class="progress-container">
                    <div class="progress-bar" style="width: <?php echo count($novas_obrigacoes_mes) > 0 ? '100%' : '0%'; ?>"></div>
                </div>
            </div>
            <div class="stats-box animate__animated animate__fadeInLeft" style="animation-delay: 0.2s">
                <div class="wave-effect">
                    <div class="wave"></div>
                    <div class="wave"></div>
                    <div class="wave"></div>
                </div>
                <h3><i class="fas fa-calendar-check"></i> Obrigações Futuras</h3>
                <div class="stats-numbers"><?php echo count($obrigacoes_futuras); ?> próximas</div>
                <p>Próximos vencimentos</p>
                <div class="progress-container">
                    <div class="progress-bar" style="width: <?php echo count($obrigacoes_futuras) > 0 ? '100%' : '0%'; ?>"></div>
                </div>
            </div>
            <div class="stats-box animate__animated animate__fadeInLeft" style="animation-delay: 0.3s">
                <div class="wave-effect">
                    <div class="wave"></div>
                    <div class="wave"></div>
                    <div class="wave"></div>
                </div>
                <h3><i class="fas fa-calendar-minus"></i> Empresas Saindo</h3>
                <div class="stats-numbers"><?php echo count($empresas_saindo); ?> programadas</div>
                <p>Próximas saídas</p>
                <div class="progress-container">
                    <div class="progress-bar" style="width: <?php echo count($empresas_saindo) > 0 ? '100%' : '0%'; ?>"></div>
                </div>
            </div>
            <div class="stats-box animate__animated animate__fadeInLeft" style="animation-delay: 0.4s">
                <div class="wave-effect">
                    <div class="wave"></div>
                    <div class="wave"></div>
                    <div class="wave"></div>
                </div>
                <h3><i class="fas fa-calendar-alt"></i> Status Mensal</h3>
                <div class="accordion accordion-flush" id="sma"><?php $idx = 0;
                                                                foreach ($porcentagens_mensais as $mc => $dm): if (empty($dm)) continue;
                                                                    $idx++; ?><div class="accordion-item">
                            <h2 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#c<?= $idx ?>"><?= ucfirst($mc) ?></button></h2>
                            <div id="c<?= $idx ?>" class="accordion-collapse collapse">
                                <div class="accordion-body"><?php foreach ($contadores_mensais[$mc]['status'] as $s => $c): if ($c > 0): $p = round(($c / $contadores_mensais[$mc]['total_relevante']) * 100);
                                                                            echo "<div>$s: $p% ($c)</div>";
                                                                        endif;
                                                                    endforeach; ?></div>
                            </div>
                        </div><?php endforeach; ?></div>
            </div>
        </div>

        <div class="filter-panel">
            <form method="GET" action="contabil.php">
                <?php if ($id_funcionario_get): ?><input type="hidden" name="ver_como" value="<?= $id_funcionario_get ?>"><?php endif; ?>
                <div class="filter-grid">
                    <div class="filter-group">
                        <label>Ano</label>
                        <select name="ano" id="select-ano" class="form-select form-select-sm" onchange="this.form.submit()">
                            <?php foreach ($anos_disponiveis as $a): ?>
                                <option value="<?= $a['ano'] ?>" <?= $a['ano'] == $ano_selecionado ? 'selected' : '' ?>><?= $a['ano'] ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Buscar</label>
                        <input type="text" name="busca" class="form-control form-control-sm" placeholder="Nome, CNPJ..." value="<?= htmlspecialchars($filtros['busca'] ?? '') ?>">
                    </div>
                    <div class="filter-group">
                        <label>Status</label>
                        <select name="status" class="form-select form-select-sm">
                            <option value="ativas" <?= $filtros['status'] == 'ativas' ? 'selected' : '' ?>>Ativas</option>
                            <option value="inativas" <?= $filtros['status'] == 'inativas' ? 'selected' : '' ?>>Inativas</option>
                            <option value="todas" <?= $filtros['status'] == 'todas' ? 'selected' : '' ?>>Todas</option>
                        </select>
                    </div>
<div class="filter-buttons-action">
    <button type="submit" class="btn btn-primary btn-sm">
        <i class="fas fa-filter"></i> Filtrar
    </button>

    <a
        href="contabil.php<?= $params_adicionais_url ? '?' . ltrim($params_adicionais_url, '&') : '' ?>"
        class="btn btn-secondary btn-sm"
    >
        Limpar
    </a>

    <button
        type="button"
        class="btn btn-sm"
        onclick="toggleEditaveis()"
    >
        <?= $mostrar_editaveis ? 'Ver Tudo' : 'Ver Editáveis'; ?>
    </button>

    <?php if ($mes_exportacao_id): ?>
        <a
            href="exportar_contabil.php?ano=<?= $ano_selecionado ?>&mes_id=<?= $mes_exportacao_id ?>"
            class="btn btn-success btn-sm"
        >
            <i class="fas fa-file-excel"></i> Exportar
        </a>
    <?php endif; ?>
</div></div>
                </div>
            </form>
        </div>

        <div class="search-box"><input type="text" placeholder="Pesquisa rápida na tabela..." id="search-input"></div>

        <div class="table-container">
            <table class="data-table <?php echo $mostrar_editaveis ? '' : 'show-all'; ?>">
                <thead>
                    <tr>
                        <th class="sortable" data-column="codigo"><?= generateSortLink(['sort' => $filtros['sort'], 'dir' => $filtros['dir'], 'ano' => $ano_selecionado, 'busca' => $filtros['busca'] ?? '', 'status' => $filtros['status'] ?? 'ativas'], 'Codigo', $params_adicionais_url) ?></th>
                        <th class="sortable" data-column="empresa"><?= generateSortLink(['sort' => $filtros['sort'], 'dir' => $filtros['dir'], 'ano' => $ano_selecionado, 'busca' => $filtros['busca'] ?? '', 'status' => $filtros['status'] ?? 'ativas'], 'Empresa', $params_adicionais_url) ?></th>

                        <th>CNPJ</th>
<th>Situação</th>
                        <th class="filterable non-editable" data-column="grupo">Grupo <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                        <th class="filterable non-editable" data-column="tributacao">Tributação <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                        <th class="filterable non-editable" data-column="observacoes_contabil">Observações <span class="filter-icon"><i class="fas fa-filter"></i></span></th>

                        <th class="filterable" style="min-width: 120px;">Meses <span class="filter-icon"><i class="fas fa-filter"></i></span></th>

                        <th class="filterable editavel" data-column="balancete">Balancete <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                        <th class="filterable editavel" data-column="distribuicao_dirf">Dist. DIRF <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                        <th class="filterable editavel" data-column="defs">DEFS <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                        <th class="filterable editavel" data-column="dasn">DASN <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                        <th class="filterable editavel" data-column="ecd">ECD <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                        <th class="filterable editavel" data-column="ecf">ECF <span class="filter-icon"><i class="fas fa-filter"></i></span></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($empresas as $empresa): ?>
                        <tr data-id="<?= $empresa['id'] ?>"
                            data-entrada="<?= htmlspecialchars($empresa['data_contrato_formatada'] ?? '') ?>"
                            data-saida="<?= htmlspecialchars($empresa['data_saida_formatada'] ?? '') ?>">
                            <td><?= htmlspecialchars($empresa['codigo']) ?></td>
                            <td title="<?= htmlspecialchars($empresa['empresa']) ?>"><?= htmlspecialchars($empresa['empresa']) ?></td>
                            <td><?= htmlspecialchars($empresa['cnpj']) ?></td>
<td>
    <?php
    if (!empty($empresa['data_saida']) && $empresa['data_saida'] != '0000-00-00') {
        echo '<span class="badge bg-danger">Saiu em ' . date('Y', strtotime($empresa['data_saida'])) . '</span>';
    } else {
        echo '<span class="badge bg-success">Ativa</span>';
    }
    ?>
</td>
                            <td class="non-editable"><?= htmlspecialchars($empresa['grupo'] ?? '') ?></td>
                            <td class="non-editable"><?= htmlspecialchars($empresa['tributacao'] ?? '') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="observacoes_contabil"><?= htmlspecialchars($empresa['observacoes_contabil'] ?? '') ?></td>
                            <td class="meses-trigger text-center" style="cursor: pointer;">
                                <?php
                                $total_cliente = 0;
                                $total_preenchido = 0; // Agora conta apenas os OK - FINALIZADO

                                $ts_in = strtotime(str_replace('/', '-', $empresa['data_contrato_formatada'] ?? '0000-00-00'));
                                $ts_out = (!empty($empresa['data_saida_formatada']) && $empresa['data_saida_formatada'] !== '0000-00-00') ? strtotime(str_replace('/', '-', $empresa['data_saida_formatada'])) : null;

                                foreach ($meses_colunas as $idx => $mc) {
                                    $mn = $idx + 1;
                                    $im = mktime(0, 0, 0, $mn, 1, $ano_selecionado);
                                    $fm = mktime(23, 59, 59, $mn + 1, 0, $ano_selecionado);

                                    $is_cli = true;
                                    if ($ts_in > $fm) $is_cli = false; // Entrou depois
                                    if ($ts_out && $ts_out < $im) $is_cli = false; // Saiu antes

                                    $val = trim($empresa[$mc] ?? '');

                                    if ($is_cli) {
                                        $total_cliente++;
                                        // --- ALTERAÇÃO AQUI ---
                                        // Antes verificava se não estava vazio (!empty)
                                        // Agora verifica se é estritamente igual ao texto desejado
                                        if ($val === 'OK - FINALIZADO') {
                                            $total_preenchido++;
                                        }
                                    }
                                }

                                if ($total_cliente == 0) echo '<span class="badge bg-secondary">N/A</span>';
                                elseif ($total_preenchido == $total_cliente) echo '<span class="badge bg-success">Completo</span>';
                                else echo '<span class="badge bg-warning text-dark">Pendente (' . $total_preenchido . '/' . $total_cliente . ')</span>';
                                ?>
                            </td>

                            <td class="editavel" contenteditable="true" data-coluna="balancete"><?= htmlspecialchars($empresa['balancete'] ?? '') ?></td>
                            <td class="editavel" contenteditable="true" data-coluna="distribuicao_dirf"><?= htmlspecialchars($empresa['distribuicao_dirf'] ?? '') ?></td>

                            <?php $trib = mb_strtolower(trim($empresa['tributacao'] ?? ''), 'UTF-8');
                            $eh_simp = ($trib === 'simples_nacional' || strpos($trib, 'simples') !== false);
                            $v_defs = $empresa['defs'] ?? ''; ?>
                            <td data-coluna="defs" class="<?= $eh_simp ? 'editavel' : '' ?>">
                                <?php if ($eh_simp): ?>
                                    <select class="form-select form-select-sm select-editavel-mes">
                                        <option value="" <?= $v_defs == '' ? 'selected' : '' ?>>Pendente</option>
                                        <option value="PENDENTE" <?= $v_defs === 'PENDENTE' ? 'selected' : '' ?> style="color:#dc3545;font-weight:bold;">PENDENTE</option>
                                        <option value="ENVIADO" <?= $v_defs === 'ENVIADO' ? 'selected' : '' ?> style="color:#198754;font-weight:bold;">ENVIADO</option>
                                    </select>
                                <?php else: echo '<small style="opacity:0.6">N/A</small>';
                                endif; ?>
                            </td>

                            <td class="editavel" contenteditable="true" data-coluna="dasn"><?= htmlspecialchars($empresa['dasn'] ?? '') ?></td>

                            <?php $tribs_ee = ['associacoes', 'condominios', 'imune_irpj', 'lucro_presumido', 'lucro_real/anual', 'lucro_real/estimativa', 'lucro_real/trimestral'];
                            $show_ee = in_array($trib, $tribs_ee);
                            $v_ecd = $empresa['ecd'] ?? '';
                            $v_ecf = $empresa['ecf'] ?? ''; ?>
                            <td data-coluna="ecd" class="<?= $show_ee ? 'editavel' : '' ?>">
                                <?php if ($show_ee): ?>
                                    <select class="form-select form-select-sm select-editavel-mes">
                                        <option value="" <?= $v_ecd == '' ? 'selected' : '' ?>>Pendente</option>
                                        <option value="PENDENTE" <?= $v_ecd === 'PENDENTE' ? 'selected' : '' ?> style="color:#dc3545;font-weight:bold;">PENDENTE</option>
                                        <option value="ENVIADO" <?= $v_ecd === 'ENVIADO' ? 'selected' : '' ?> style="color:#198754;font-weight:bold;">ENVIADO</option>
                                    </select>
                                <?php else: echo '<small style="opacity:0.6">N/A</small>';
                                endif; ?>
                            </td>
                            <td data-coluna="ecf" class="<?= $show_ee ? 'editavel' : '' ?>">
                                <?php if ($show_ee): ?>
                                    <select class="form-select form-select-sm select-editavel-mes">
                                        <option value="" <?= $v_ecf == '' ? 'selected' : '' ?>>Pendente</option>
                                        <option value="PENDENTE" <?= $v_ecf === 'PENDENTE' ? 'selected' : '' ?> style="color:#dc3545;font-weight:bold;">PENDENTE</option>
                                        <option value="ENVIADO" <?= $v_ecf === 'ENVIADO' ? 'selected' : '' ?> style="color:#198754;font-weight:bold;">ENVIADO</option>
                                    </select>
                                <?php else: echo '<small style="opacity:0.6">N/A</small>';
                                endif; ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        window.activeColumnFilters = {};
        $(document).ready(function() {
            window.toggleEditaveis = function() {
                $('.data-table').toggleClass('show-all');
            };
            window.changeYear = function() {
                const u = new URLSearchParams(window.location.search);
                let url = `contabil.php?ano=${$('#select-ano').val()}`;
                if (u.get('ver_como')) url += `&ver_como=${u.get('ver_como')}`;
                window.location.href = url;
            };

            function applyAllFilters() {
                const term = $('#search-input').val().toLowerCase().trim();
                $('.data-table tbody tr').each(function() {
                    let row = $(this);
                    let show = true;
                    if (term && !row.text().toLowerCase().includes(term)) show = false;
                    if (show) {
                        for (const col in window.activeColumnFilters) {
                            const opts = window.activeColumnFilters[col];
                            if (opts && opts.length > 0) {
                                const th = $(`.data-table th[data-column="${col}"]`);
                                const idx = th.index();
                                const cell = row.find('td').eq(idx);
                                let val = "";
                                if (cell.find('select').length) val = cell.find('select option:selected').text().trim();
                                else val = cell.text().trim();
                                if (val === '' || val === null) val = 'Pendente';
                                if (!opts.includes(val)) {
                                    show = false;
                                    break;
                                }
                            }
                        }
                    }
                    row.toggle(show);
                });
            }
            $('#search-input').on('keyup input', applyAllFilters);

            $('.data-table').on('click', 'th.filterable .filter-icon', function(e) {
                e.stopPropagation();
                $('.filter-menu').remove();
                const th = $(this).closest('th');
                const col = th.data('column');
                const idx = th.index();
                const opts = new Set();
                $('.data-table tbody tr').each(function() {
                    const cell = $(this).find('td').eq(idx);
                    let val;
                    if (cell.find('select').length) val = cell.find('select option:selected').text().trim();
                    else val = cell.text().trim();
                    opts.add(val || 'Pendente');
                });
                const arr = Array.from(opts).sort();
                const active = window.activeColumnFilters[col] || arr;
                let html = '';
                arr.forEach(o => {
                    const chk = active.includes(o) ? 'checked' : '';
                    html += `<label style="display:block;margin-bottom:5px;"><input type="checkbox" class="filter-checkbox" value="${o}" ${chk}> ${o}</label>`;
                });
                const btnTxt = (active.length === arr.length) ? "Deselecionar Todos" : "Selecionar Todos";
                th.append(`<div class="filter-menu"><div class="filter-menu-header">Filtrar: ${th.text().trim()}</div><div class="filter-menu-options" style="max-height:200px;overflow:auto;">${html}</div><div class="filter-menu-footer" style="display:flex;justify-content:space-between;"><button class="btn btn-outline-secondary btn-sm btn-toggle-all">${btnTxt}</button><button class="btn btn-primary btn-sm btn-apply-filter">Aplicar</button></div></div>`);
                th.find('.filter-menu').fadeIn(100);
            });

            $(document).on('click', '.btn-toggle-all', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const m = $(this).closest('.filter-menu');
                const cbs = m.find('.filter-checkbox');
                const all = cbs.length === cbs.filter(':checked').length;
                cbs.prop('checked', !all);
                $(this).text(all ? "Selecionar Todos" : "Deselecionar Todos");
            });

            $(document).on('click', '.btn-apply-filter', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const m = $(this).closest('.filter-menu');
                const th = m.closest('th');
                const col = th.data('column');
                const sel = [];
                m.find('.filter-checkbox:checked').each(function() {
                    sel.push($(this).val());
                });
                if (sel.length === m.find('.filter-checkbox').length) {
                    delete window.activeColumnFilters[col];
                    th.removeClass('filter-active');
                } else {
                    window.activeColumnFilters[col] = sel;
                    th.addClass('filter-active');
                }
                applyAllFilters();
                m.remove();
            });
            $(document).on('click', function(e) {
                if (!$(e.target).closest('.filter-menu').length) $('.filter-menu').remove();
            });

            function saveChanges(el) {
                const isSel = el.is('select');
                const cell = isSel ? el.closest('td') : el;
                if (cell.hasClass('nao-cliente')) return;
                const row = cell.closest('tr');
                const id = row.data('id');
                const col = cell.data('coluna');
                const val = isSel ? el.val() : el.text().trim();
                cell.css('opacity', 0.5);
                $.post('salvar_alteracao_contabil.php', {
                    id: id,
                    coluna: col,
                    valor: val
                }, function(r) {
                    if (r.success) {
                        cell.css('border-color', 'green');
                        if (col === 'tributacao') location.reload();
                    } else alert('Erro: ' + r.message);
                }, 'json').always(() => {
                    cell.css('opacity', 1);
                    setTimeout(() => cell.css('border-color', ''), 2000);
                });
            }
            $('.select-editavel-mes').on('change', function() {
                saveChanges($(this));
            });
            $('.editavel[contenteditable="true"]').on('blur', function() {
                saveChanges($(this));
            }).on('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    $(this).blur();
                }
            });

            // --- LÓGICA DO MODAL: Bloqueio Visual Correto ---
            $(document).on('click', '.meses-trigger', function() {
                const r = $(this).closest('tr');
                const id = r.data('id');
                $('#modalDetalhesMeses').addClass('active');
                $('#meses_id_controle').val(id);

                // 1. Identifica o Ano Selecionado com Segurança
                // Tenta pegar do select, se falhar, pega da URL, se falhar, pega o ano atual
                let anoSelecionado = parseInt($('#select-ano').val());
                if (!anoSelecionado || isNaN(anoSelecionado)) {
                    const urlParams = new URLSearchParams(window.location.search);
                    anoSelecionado = parseInt(urlParams.get('ano'));
                }
                if (!anoSelecionado) anoSelecionado = new Date().getFullYear();

                // 2. Reseta o formulário
                const selectores = $('#formMesesDetalhes select');
                selectores.each(function() {
                    const sel = $(this);
                    sel.prop('disabled', false).css('background-color', '').val('');
                    sel.find('option[value="NAO_CLIENTE"]').remove();
                    sel.removeClass('bloqueado-pelo-sistema');
                });

                // 3. Tratamento de Datas
                const dataEntradaStr = r.data('entrada');
                const dataSaidaStr = r.data('saida');

                const parseDataBR = (str) => {
                    if (!str || str === '0000-00-00' || str.trim() === '') return null;
                    const parts = str.split('/');
                    if (parts.length !== 3) return null;
                    // Define hora 12:00 para evitar problemas de fuso horário
                    return new Date(parts[2], parts[1] - 1, parts[0], 12, 0, 0);
                };

                const dataEntrada = parseDataBR(dataEntradaStr);
                const dataSaida = parseDataBR(dataSaidaStr);

                const meses = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

                // 4. Loop de Bloqueio
                meses.forEach((mesNome, index) => {
                    const select = $('#mes_' + mesNome);

                    // Intervalo do Mês Analisado (Ex: 01/Jan a 31/Jan do Ano Selecionado)
                    // Importante: Usamos o anoSelecionado (2025), não o ano atual
                    const inicioDoMes = new Date(anoSelecionado, index, 1, 0, 0, 0);
                    const fimDoMes = new Date(anoSelecionado, index + 1, 0, 23, 59, 59);

                    let deveBloquear = false;

                    // REGRA 1: Antes do Contrato?
                    // Se existe data de entrada E ela é maior que o fim deste mês
                    // Ex: Entrou em Junho. Mês analisado: Maio. (Jun > Maio? Sim -> Bloqueia)
                    if (dataEntrada && dataEntrada > fimDoMes) {
                        deveBloquear = true;
                    }

                    // REGRA 2: Depois da Saída?
                    // Se existe data de saída E ela é menor que o início deste mês
                    // Ex: Saiu em Outubro. Mês analisado: Novembro. (Out < Nov? Sim -> Bloqueia)
                    if (dataSaida && dataSaida < inicioDoMes) {
                        deveBloquear = true;
                    }

                    if (deveBloquear) {
                        select.append('<option value="NAO_CLIENTE">NÃO É CLIENTE</option>');
                        select.val('NAO_CLIENTE');
                        select.prop('disabled', true);
                        select.css('background-color', '#e9ecef');
                        select.addClass('bloqueado-pelo-sistema');
                    }
                });

                // 5. Carrega dados do Banco
                $.getJSON('assets/backend/obter_detalhes_meses.php', {
                    id: id
                }, function(res) {
                    if (res.success) {
                        $.each(res.dados, (key, value) => {
                            const select = $('#mes_' + key);

                            // AQUI ESTÁ O SEGREDO:
                            // Só preenchemos com o valor do banco se o sistema NÃO tiver bloqueado pela data.
                            // Se o sistema bloqueou (ex: Jan/2025 para cliente novo), ignora o que está no banco e mantém "NÃO É CLIENTE".
                            if (!select.hasClass('bloqueado-pelo-sistema')) {
                                select.val(value);
                            }
                        });
                    }
                });
            });
            $('#formMesesDetalhes').on('submit', function(e) {
                e.preventDefault();

                // Habilita campos disabled para enviar o valor "NAO_CLIENTE"
                const camposDesabilitados = $(this).find('select:disabled');
                camposDesabilitados.prop('disabled', false);

                // Cálculo para atualizar a UI imediatamente (X/Y)
                let totalContrato = 0;
                let totalPreenchido = 0;

                $(this).find('select').each(function() {
                    let valor = $(this).val();
                    // Se for NAO_CLIENTE, não conta no denominador
                    if (valor !== 'NAO_CLIENTE') {
                        totalContrato++;
                        if (valor === 'OK - FINALIZADO') {
                            totalPreenchido++;
                        }
                    }
                });

                const dados = $(this).serialize();
                const id = $('#meses_id_controle').val();

                // Desabilita de volta
                camposDesabilitados.prop('disabled', true);

                $.post('assets/backend/salvar_detalhes_meses.php', dados, function(r) {
                    if (r.success) {
                        $('#modalDetalhesMeses').removeClass('active');
                        const celula = $(`.data-table tr[data-id="${id}"] .meses-trigger`);

                        // Atualização visual correta
                        if (totalContrato === 0) {
                            celula.html('<span class="badge bg-secondary">N/A</span>');
                        } else if (totalPreenchido === totalContrato) {
                            celula.html('<span class="badge bg-success">Completo</span>');
                        } else {
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

            // --- Scripts do Menu e Senha (Mantidos) ---
            $('#logoutBtn').click(function() {
                $(this).css({
                    'transform': 'scale(1.2)',
                    'background': 'var(--danger-color)',
                    'color': 'white'
                });
                setTimeout(() => {
                    window.location.href = 'logout.php';
                }, 300);
            });
            // ... (Restante dos scripts de senha, notificação, etc, já devem estar no scripts_globais ou mantidos se necessário)

            // Configuração do Modal de Senha
            const modalOverlay = document.getElementById('passwordModalOverlay');
            const openBtn = document.getElementById('changePasswordBtn');
            const closeBtn = document.getElementById('closePasswordModalBtn');
            const form = document.getElementById('changePasswordForm');
            const messageDiv = document.getElementById('modal-message');
            if (openBtn) {
                openBtn.onclick = function() {
                    form.reset();
                    messageDiv.style.display = 'none';
                    messageDiv.className = 'modal-message';
                    modalOverlay.classList.add('active');
                }
                closeBtn.onclick = function() {
                    modalOverlay.classList.remove('active');
                }
                modalOverlay.addEventListener('click', function(event) {
                    if (event.target === modalOverlay) modalOverlay.classList.remove('active');
                });
                form.addEventListener('submit', function(event) {
                    event.preventDefault();
                    messageDiv.style.display = 'none';
                    messageDiv.textContent = '';
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
                    }).then(response => response.json()).then(data => {
                        messageDiv.textContent = data.message;
                        if (data.success) {
                            messageDiv.className = 'modal-message success';
                            form.reset();
                            setTimeout(() => {
                                modalOverlay.classList.remove('active');
                            }, 2500);
                        } else {
                            messageDiv.className = 'modal-message error';
                        }
                    }).catch(error => {
                        console.error('Erro:', error);
                        messageDiv.textContent = 'Ocorreu um erro de comunicação com o servidor.';
                        messageDiv.className = 'modal-message error';
                    });
                });
            }
        });
    </script>
    <script src="scripts_globais.js"></script>
</body>

</html>