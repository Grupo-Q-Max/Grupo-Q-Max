<?php
require 'assets/backend/config.php';

session_start();

$tipo_conta_logado = $_SESSION['tipo_conta'] ?? '';
if (strpos($tipo_conta_logado, 'lider_') !== 0 && $tipo_conta_logado !== 'admin') {
    header('Location: dashboard.php');
    exit();
}

$funcionario_id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
$area_tarefa_raw = $_GET['area'] ?? '';

$areas_permitidas = ['fiscal', 'dp', 'contabil'];
if (!$funcionario_id || !in_array($area_tarefa_raw, $areas_permitidas)) {
    die("Erro: Parâmetros inválidos para carregar os detalhes.");
}
$area_tarefa = $area_tarefa_raw;

if ($tipo_conta_logado !== 'admin' && str_replace('lider_', '', $tipo_conta_logado) !== $area_tarefa) {
    die("Acesso não autorizado a esta área.");
}

$stmt_func = $conexao->prepare("SELECT nome FROM usuarios WHERE id = ?");
$stmt_func->bind_param('i', $funcionario_id);
$stmt_func->execute();
$nome_funcionario = $stmt_func->get_result()->fetch_assoc()['nome'] ?? 'Desconhecido';
$stmt_func->close();

$mes_atual_id = null;
if (function_exists('obterMesAtualAberto')) {
    $mes_atual_id = obterMesAtualAberto($conexao);
} else {
    $sql_ultimo_mes = "SELECT id FROM controle_meses ORDER BY ano DESC, mes DESC LIMIT 1";
    $result_ultimo = $conexao->query($sql_ultimo_mes);
    if ($result_ultimo && $result_ultimo->num_rows > 0) {
        $mes_atual_id = $result_ultimo->fetch_assoc()['id'];
    }
}

$lista_empresas = [];
$opcoes_tributacao = [];
$kpis = [
    'total' => 0,
    'concluidas' => 0,
    'pendentes' => 0,
    'total_funcionarios' => 0,
    'total_empresas' => 0,
    'total_parcelamentos' => 0
];
$progresso = 0;
$total_campos_da_carteira = 0;
$campos_preenchidos = 0;

if ($mes_atual_id) {
    $sql_parcelamentos = "SELECT COUNT(id) as total FROM parcelamentos WHERE id_usuario = ? AND id_mes = ? AND status = 'ativo'";
    $stmt_parcelamentos = $conexao->prepare($sql_parcelamentos);
    if ($stmt_parcelamentos) {
        $stmt_parcelamentos->bind_param('ii', $funcionario_id, $mes_atual_id);
        $stmt_parcelamentos->execute();
        $kpis['total_parcelamentos'] = $stmt_parcelamentos->get_result()->fetch_assoc()['total'] ?? 0;
        $stmt_parcelamentos->close();
    }
    // Busca o ano do mês atual para usar na query do contábil
    $stmt_ano = $conexao->prepare("SELECT ano FROM controle_meses WHERE id = ?");
    $stmt_ano->bind_param('i', $mes_atual_id);
    $stmt_ano->execute();
    $ano_atual_db = $stmt_ano->get_result()->fetch_assoc()['ano'];
    $stmt_ano->close();
    $stmt_mes = $conexao->prepare("SELECT mes FROM controle_meses WHERE id = ?");
    $stmt_mes->bind_param('i', $mes_atual_id);
    $stmt_mes->execute();
    $mes_atual_num = $stmt_mes->get_result()->fetch_assoc()['mes'];
    $stmt_mes->close();

    // Array para converter número do mês em nome da coluna (ex: 10 -> 'outubro')
    $mapa_meses_colunas = [
        1 => 'janeiro',
        2 => 'fevereiro',
        3 => 'marco',
        4 => 'abril',
        5 => 'maio',
        6 => 'junho',
        7 => 'julho',
        8 => 'agosto',
        9 => 'setembro',
        10 => 'outubro',
        11 => 'novembro',
        12 => 'dezembro'
    ];
    $nome_coluna_mes_atual = $mapa_meses_colunas[$mes_atual_num];

    // [INÍCIO DA 1ª CORREÇÃO]
    if ($area_tarefa === 'contabil') {
        // --- LÓGICA CORRIGIDA PARA CONTÁBIL ---
        // Agora busca as empresas APENAS do mês atual, mantendo o JOIN original que funciona.
        $sql_detalhes = "
        SELECT 
            cf.*, 
            cf.status_contabil AS status_tarefa
        FROM controle_fechamento cf
        JOIN responsaveis_empresa re ON cf.id = re.id_empresa
        WHERE 
            re.id_usuario = ?
            AND re.id_mes = ? -- Adicionamos o filtro do mês atual aqui
            AND re.tipo_tarefa = 'contabil'
            AND re.responsavel_atual = 1
        ORDER BY cf.empresa ASC
    ";

        $stmt_detalhes = $conexao->prepare($sql_detalhes);
        // Os parâmetros agora são (id_func, id_mes)
        $stmt_detalhes->bind_param('ii', $funcionario_id, $mes_atual_id);
    } else {
        // [FIM DA 1ª CORREÇÃO] - O restante do código (o bloco 'else') continua igual.
        // --- LÓGICA PADRÃO PARA FISCAL E DP ---
        // Pega as empresas do mês atual, como já fazia antes.

        $coluna_status = "status_" . $area_tarefa;
        $sql_detalhes = "
    SELECT 
        cf.*,
        cf.{$coluna_status} AS status_tarefa
    FROM responsaveis_empresa re
    -- A junção com `cf.id_mes` garante que pegamos o registro da empresa referente ao mês correto.
    JOIN controle_fechamento cf ON re.id_empresa = cf.id AND re.id_mes = cf.id_mes
    WHERE 
        re.id_usuario = ? 
        AND re.id_mes = ? -- Esta linha é a chave para filtrar pelo mês atual.
        AND re.tipo_tarefa = ?
        AND (cf.setores_permitidos IS NULL OR cf.setores_permitidos = '' OR FIND_IN_SET(?, cf.setores_permitidos))
    ORDER BY cf.empresa ASC
";

        $stmt_detalhes = $conexao->prepare($sql_detalhes);
        $stmt_detalhes->bind_param('iiss', $funcionario_id, $mes_atual_id, $area_tarefa, $area_tarefa);
    }

    // Execução da query e busca dos resultados (comum para todos os casos)
    $stmt_detalhes->execute();
    $lista_empresas = $stmt_detalhes->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt_detalhes->close();


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

    $camposObrigatorios = [];
    switch ($area_tarefa) {
        case 'dp':
            $camposObrigatorios = $camposObrigatoriosDP;
            break;
        case 'fiscal':
            $camposObrigatorios = $camposObrigatoriosFiscal;
            break;
        case 'contabil':
            $camposObrigatorios = [
                $nome_coluna_mes_atual, // Ex: 'outubro'
                'balancete',
                'distribuicao_dirf',
                'defs',
                'dasn',
                'ecd',
                'ecf'
            ];
            break;
    }

    $total_campos_da_carteira = 0;
    $campos_preenchidos = 0;
    $kpis['total'] = 0;
    $kpis['total_funcionarios'] = 0;
    $kpis['concluidas'] = 0;
    $tributacoes_encontradas = [];

    if (!empty($lista_empresas)) {
        $kpis['total'] = count($lista_empresas);

        foreach ($lista_empresas as $empresa) {
            $kpis['total_funcionarios'] += (int)($empresa['qtde_funcionarios'] ?? 0);

            $tributacao_formatada = htmlspecialchars($empresa['tributacao'] ?? '');
            if (!in_array($tributacao_formatada, $tributacoes_encontradas)) {
                $tributacoes_encontradas[] = $tributacao_formatada;
            }

            $empresa_completa = true;
            foreach ($camposObrigatorios as $campo) {
                $total_campos_da_carteira++;
                if (!empty(trim($empresa[$campo] ?? ''))) {
                    $campos_preenchidos++;
                } else {
                    $empresa_completa = false;
                }
            }
            if ($empresa_completa) {
                $kpis['concluidas']++;
            }
        }
    }

    $kpis['pendentes'] = $kpis['total'] - $kpis['concluidas'];
    $progresso = ($total_campos_da_carteira > 0) ? ($campos_preenchidos / $total_campos_da_carteira) * 100 : 0;

    sort($tributacoes_encontradas);
    $opcoes_tributacao = $tributacoes_encontradas;
}

?>
<!DOCTYPE html>
<html lang="pt-br" data-theme="light">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Detalhes de <?= htmlspecialchars($nome_funcionario ?? '') ?></title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link rel="stylesheet" href="assets/css/detalhes_funcionario.css">
</head>

<body>
    <div class="background-waves"></div>
    <header class="header">
        <h1><i class="fas fa-user-check"></i> Detalhes de: <span><?= htmlspecialchars($nome_funcionario ?? '') ?></span></h1>
        <a href="painel_lider.php" class="btn btn-outline"><i class="fas fa-arrow-left"></i> Voltar ao Painel</a>
    </header>

    <main class="main-content">
        <div class="card kpi-card">
            <h2>Resumo do Mês (<?= ucfirst($area_tarefa) ?>)</h2>
            <div class="kpi-grid">
                <div class="kpi-item">
                    <i class="fas fa-building"></i>
                    <div class="kpi-text"><span>Total de Empresas</span><strong><?= $kpis['total'] ?></strong></div>
                </div>
                <div class="kpi-item">
                    <i class="fas fa-check-circle" style="color: var(--success-color);"></i>
                    <div class="kpi-text"><span>Concluídas</span><strong><?= $kpis['concluidas'] ?></strong></div>
                </div>
                <div class="kpi-item">
                    <i class="fas fa-clock" style="color: var(--warning-color);"></i>
                    <div class="kpi-text"><span>Pendentes</span><strong><?= $kpis['pendentes'] ?></strong></div>
                </div>
                <div class="kpi-item">
                    <i class="fas fa-users"></i>
                    <div class="kpi-text"><span>Total de Funcionários</span><strong><?= $kpis['total_funcionarios'] ?></strong></div>
                </div>

                <div class="kpi-item" id="kpi-parcelamentos">
                    <i class="fas fa-handshake" style="color: var(--info-color);"></i>
                    <div class="kpi-text"><span>Parcelamentos Ativos</span><strong><?= $kpis['total_parcelamentos'] ?></strong></div>
                </div>

            </div>
            <div class="progress-container">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: <?= number_format($progresso, 2) ?>%;"></div>
                </div>
                <div class="progress-text">
                    <span class="progress-value">
                        <?= number_format($progresso, 1) ?>%
                    </span>
                    <span class="progress-detail">
                        <?= $campos_preenchidos ?> de <?= $total_campos_da_carteira ?> campos preenchidos
                    </span>
                </div>
                <small class="progress-text">
                    <?= $campos_preenchidos ?> de <?= $total_campos_da_carteira ?> campos preenchidos
                </small>
            </div>
        </div>

        <div class="card">
            <div class="table-header">
                <h2><i class="fas fa-clipboard-list"></i> Carteira de Empresas</h2>

                <div class="filters-container">
                    <div class="filter-group">
                        <label for="filtro-tributacao"><i class="fas fa-landmark"></i> Tributação:</label>
                        <select id="filtro-tributacao" class="form-control">
                            <option value="">Todas</option>
                            <?php foreach ($opcoes_tributacao as $tributacao): ?>
                                <?php
                                $valor_tributacao = htmlspecialchars($tributacao ?? '');
                                $nome_tributacao = ucfirst(str_replace('_', ' ', $valor_tributacao));
                                if (empty($valor_tributacao)) {
                                    $valor_tributacao = 'nenhuma';
                                    $nome_tributacao = 'Nenhuma';
                                }
                                ?>
                                <option value="<?= $valor_tributacao ?>"><?= $nome_tributacao ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div class="filter-group">
                        <label for="filtro-status"><i class="fas fa-tasks"></i> Status:</label>
                        <select id="filtro-status" class="form-control">
                            <option value="">Todos</option>
                            <option value="concluido">Concluída</option>
                            <option value="pendente">Pendente</option>
                        </select>
                    </div>

                    <div class="search-container">
                        <i class="fas fa-search"></i>
                        <input type="text" id="search-input" class="form-control" placeholder="Buscar empresa...">
                    </div>
                </div>
            </div>
            <div class="table-responsive">
                <table class="details-table">
                    <thead>
                        <tr>
                            <th>Empresa</th>
                            <th>Tributação</th>
                            <th>Qtde. Funcionários</th>
                            <th>Status da Tarefa</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($lista_empresas)): ?>
                            <tr>
                                <td colspan="4">Nenhuma empresa atribuída a este funcionário neste mês.</td>
                            </tr>
                        <?php else: ?>
                            <?php foreach ($lista_empresas as $empresa): ?>
                                <tr>
                                    <td><?= htmlspecialchars($empresa['empresa']) ?></td>
                                    <td><span class="badge"><?= ucfirst(str_replace('_', ' ', htmlspecialchars($empresa['tributacao'] ?? 'Nenhuma'))) ?></span></td>
                                    <td><?= (int)($empresa['qtde_funcionarios'] ?? 0) ?></td>
                                    <td>
                                        <?php
                                        if ($empresa['status_tarefa'] === 'completo') {
                                            $status_texto = 'Concluída';
                                            $status_class = 'status-concluido';
                                        } else {
                                            $status_texto = 'Pendente';
                                            $status_class = 'status-pendente';
                                        }
                                        ?>
                                        <span class="status-badge <?= $status_class ?>"><?= htmlspecialchars($status_texto) ?></span>
                                    </td>
                                    <td>
                                        <a href="<?= $area_tarefa ?>.php?mes_id=<?= $mes_atual_id ?>&ver_como=<?= $funcionario_id ?>&area=<?= $area_tarefa ?>" class="btn btn-small" target="_blank">
                                            <i class="fas fa-eye"></i> Ver Fechamento
                                        </a>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </main>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script>
        $(document).ready(function() {
            function aplicarFiltros() {
                const textoBusca = $('#search-input').val().toLowerCase();
                const tributacaoSelecionada = $('#filtro-tributacao').val();
                const statusSelecionado = $('#filtro-status').val();

                // Percorre cada linha <tr> da tabela
                $(".details-table tbody tr").each(function() {
                    const linha = $(this);
                    const textoLinha = linha.text().toLowerCase();

                    // Pega os valores da linha para verificação
                    const tributacaoLinha = linha.find('td:nth-child(2)').text().trim().toLowerCase().replace(/ /g, '_');
                    const statusLinha = linha.find('.status-badge').hasClass('status-concluido') ? 'concluido' : 'pendente';

                    // Verifica se a linha corresponde a todos os filtros
                    const correspondeBusca = textoLinha.includes(textoBusca);
                    const correspondeTributacao = tributacaoSelecionada === "" || tributacaoLinha === tributacaoSelecionada;
                    const correspondeStatus = statusSelecionado === "" || statusLinha === statusSelecionado;

                    // Mostra a linha apenas se corresponder a TUDO
                    if (correspondeBusca && correspondeTributacao && correspondeStatus) {
                        linha.show();
                    } else {
                        linha.hide();
                    }
                });
            }

            // Adiciona os "ouvintes" de eventos para os filtros e a busca
            $('#search-input, #filtro-tributacao, #filtro-status').on('keyup change', function() {
                aplicarFiltros();
            });
            $('#kpi-parcelamentos').on('click', function() {
                // Pega o ID do funcionário da URL
                const urlParams = new URLSearchParams(window.location.search);
                const funcionarioId = urlParams.get('id');

                if (funcionarioId) {
                    // Redireciona para a tela de tabela de parcelamentos, passando o ID do funcionário como filtro
                    window.location.href = `tabela_parcelamento.php?responsavel_id=${funcionarioId}`;
                }
            });

            // Adiciona uma classe para indicar que o card é clicável
            if (<?= $kpis['total_parcelamentos'] ?> > 0) {
                $('#kpi-parcelamentos').addClass('clickable');
            }

        });
    </script>
    <script src="scripts_globais.js"></script>

</body>

</html>