    <?php
    require 'assets/backend/config.php';
    session_start();

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

    if ($_SESSION['tipo_conta'] !== 'admin') {
        header('Location: index.php');
        exit();
    }

    // Obter todos os meses disponíveis
    $sql_meses = "SELECT id, mes, ano FROM controle_meses ORDER BY ano, mes";
    $result_meses = $conexao->query($sql_meses);
    $meses_disponiveis = $result_meses->fetch_all(MYSQLI_ASSOC);

    // Processar o formulário quando submetido
    $mes_inicio = isset($_POST['mes_inicio']) ? (int)$_POST['mes_inicio'] : null;
    $mes_fim = isset($_POST['mes_fim']) ? (int)$_POST['mes_fim'] : null;
    $tipo_comparacao = isset($_POST['tipo_comparacao']) ? $_POST['tipo_comparacao'] : 'funcionarios';
    $resultados = [];

    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $mes_inicio && $mes_fim) {
        // Verificar se os meses são válidos
        if ($mes_inicio > $mes_fim) {
            $erro = "O mês inicial deve ser anterior ou igual ao mês final!";
        } else {
            // Obter os meses selecionados
            $meses_selecionados = array_slice($meses_disponiveis, $mes_inicio - 1, $mes_fim - $mes_inicio + 1);

            if (empty($meses_selecionados)) {
                $erro = "Nenhum dado disponível para o período selecionado!";
            } else {
                $resultados = [];

                foreach ($meses_selecionados as $mes) {
                    $id_mes = $mes['id'];
                    $nome_mes = $meses_pt[$mes['mes']] . ' ' . $mes['ano'];
                    $mes_num = $mes['mes'];
                    $ano = $mes['ano'];
                    $ultimo_dia = date("Y-m-t", strtotime("{$ano}-{$mes_num}-01"));

                    if ($tipo_comparacao === 'funcionarios') {
                        // Consulta para funcionários
                        $sql = "SELECT COUNT(*) as total FROM usuarios";
                        $result = $conexao->query($sql);
                        $total_funcionarios = $result->fetch_assoc()['total'];

                        $resultados[] = [
                            'mes' => $nome_mes,
                            'total' => $total_funcionarios,
                            'novos' => 0,
                            'saidas' => 0
                        ];
                    } else {
                        // Para empresas/clientes

                        // Total de empresas ativas no mês (com contrato até fim do mês e sem saída até lá)
                        $sql_total = "
                            SELECT COUNT(DISTINCT codigo) as total
                            FROM controle_fechamento
                            WHERE data_contrato <= ?
                            AND (data_saida IS NULL OR data_saida > ?)";
                        $stmt_total = $conexao->prepare($sql_total);
                        $stmt_total->bind_param('ss', $ultimo_dia, $ultimo_dia);
                        $stmt_total->execute();
                        $total_result = $stmt_total->get_result();
                        $total_empresas = $total_result->fetch_assoc()['total'];

                        // Novas empresas no mês — só contando as que têm a menor data_contrato da empresa naquele mês
                        $sql_novos = "
                            SELECT COUNT(*) as novos FROM (
                                SELECT codigo, MIN(data_contrato) as primeiro_contrato
                                FROM controle_fechamento
                                GROUP BY codigo
                            ) AS primeira_entrada
                            WHERE MONTH(primeira_entrada.primeiro_contrato) = ?
                            AND YEAR(primeira_entrada.primeiro_contrato) = ?";
                        $stmt_novos = $conexao->prepare($sql_novos);
                        $stmt_novos->bind_param('ii', $mes_num, $ano);
                        $stmt_novos->execute();
                        $novos_result = $stmt_novos->get_result();
                        $novos_empresas = $novos_result->fetch_assoc()['novos'];

                        // Saídas no mês
                        $sql_saidas = "
                            SELECT COUNT(DISTINCT codigo) as saidas
                            FROM controle_fechamento
                            WHERE MONTH(data_saida) = ?
                            AND YEAR(data_saida) = ?";
                        $stmt_saidas = $conexao->prepare($sql_saidas);
                        $stmt_saidas->bind_param('ii', $mes_num, $ano);
                        $stmt_saidas->execute();
                        $saidas_result = $stmt_saidas->get_result();
                        $saidas_empresas = $saidas_result->fetch_assoc()['saidas'];

                        $resultados[] = [
                            'mes' => $nome_mes,
                            'total' => $total_empresas ?? 0,
                            'novos' => $novos_empresas ?? 0,
                            'saidas' => $saidas_empresas ?? 0
                        ];
                    }
                }
            }
        }
    }

    function formatarNumero($valor)
    {
        return number_format((float)$valor, 0, ',', '.');
    }
    ?>


<!DOCTYPE html>
<html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Progresso Entre Meses</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/chart.js">
    <link rel="stylesheet" href="assets/css/progresso_geral.css">
</head>

<body>
    <header class="header animate__animated animate__fadeInDown">
        <h1><i class="fas fa-chart-line"></i> Comparativo de Dados</h1>
        <div class="header-actions">
            <a href="dashboard.php" class="header-btn" style="text-decoration: none;"><i class="fas fa-arrow-left"></i> Voltar</a>
            <a href="#" id="logout-btn" class="header-btn" style="text-decoration: none;"><i class="fas fa-sign-out-alt"></i> Sair</a>
        </div>
    </header>

    <main class="main-content">
        <div class="container">
            <div class="form-container animate__animated animate__fadeIn">
                <h2><i class="fas fa-filter"></i> Filtros de Comparação</h2>

                <?php if (isset($erro)): ?>
                    <div class="alert alert-error animate__animated animate__shakeX">
                        <i class="fas fa-exclamation-circle"></i> <?= $erro ?>
                    </div>
                <?php endif; ?>

                <form method="POST">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="tipo_comparacao"><i class="fas fa-chart-pie"></i> Tipo de Comparação</label>
                            <select id="tipo_comparacao" name="tipo_comparacao" required>
                                <option value="funcionarios" <?= $tipo_comparacao === 'funcionarios' ? 'selected' : '' ?>>Funcionários</option>
                                <option value="empresas" <?= $tipo_comparacao === 'empresas' ? 'selected' : '' ?>>Empresas/Clientes</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="mes_inicio"><i class="fas fa-calendar-day"></i> Mês Inicial</label>
                            <select id="mes_inicio" name="mes_inicio" required>
                                <option value="">Selecione o mês inicial</option>
                                <?php foreach ($meses_disponiveis as $index => $mes): ?>
                                    <option value="<?= $index + 1 ?>" <?= ($mes_inicio === $index + 1) ? 'selected' : '' ?>>
                                        <?= $meses_pt[$mes['mes']] ?> <?= $mes['ano'] ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="mes_fim"><i class="fas fa-calendar-day"></i> Mês Final</label>
                            <select id="mes_fim" name="mes_fim" required>
                                <option value="">Selecione o mês final</option>
                                <?php foreach ($meses_disponiveis as $index => $mes): ?>
                                    <option value="<?= $index + 1 ?>" <?= ($mes_fim === $index + 1) ? 'selected' : '' ?>>
                                        <?= $meses_pt[$mes['mes']] ?> <?= $mes['ano'] ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>

                    <div class="form-actions">
                        <button type="submit" class="btn">
                            <i class="fas fa-search"></i> Gerar Comparativo
                        </button>
                    </div>
                </form>
            </div>

            <?php if (!empty($resultados)): ?>
                <div class="progress-comparison animate__animated animate__fadeIn">
                    <h2><i class="fas fa-chart-bar"></i> Comparativo de <?= $tipo_comparacao === 'funcionarios' ? 'Funcionários' : 'Empresas' ?></h2>
                    <p>Período: <?= $resultados[0]['mes'] ?> a <?= end($resultados)['mes'] ?></p>

                    <div class="comparison-grid">
                        <?php foreach ($resultados as $resultado): ?>
                            <div class="comparison-card">
                                <div class="comparison-header">
                                    <div class="comparison-title"><?= $resultado['mes'] ?></div>
                                    <div class="comparison-stats">
                                        <div class="stat-item">
                                            <div class="stat-value"><?= formatarNumero($resultado['total']) ?></div>
                                            <div class="stat-label">Total</div>
                                        </div>
                                        <?php if ($tipo_comparacao === 'empresas'): ?>
                                            <div class="stat-item">
                                                <div class="stat-value positive">+<?= formatarNumero($resultado['novos']) ?></div>
                                                <div class="stat-label">Novos</div>
                                            </div>
                                            <div class="stat-item">
                                                <div class="stat-value negative">-<?= formatarNumero($resultado['saidas']) ?></div>
                                                <div class="stat-label">Saídas</div>
                                            </div>
                                        <?php endif; ?>
                                    </div>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>

                    <div class="chart-summary-container">
                        <div class="chart-container">
                            <h3><i class="fas fa-chart-line"></i> Evolução</h3>
                            <canvas id="progressChart" height="250"></canvas>
                        </div>

                        <div class="summary-card">
                            <h3 class="summary-title"><i class="fas fa-chart-pie"></i> Resumo</h3>
                            <div class="summary-stats">
                                <?php
                                $primeiro_mes = $resultados[0];
                                $ultimo_mes = end($resultados);
                                $diferenca_total = $ultimo_mes['total'] - $primeiro_mes['total'];
                                $classe_total = $diferenca_total > 0 ? 'positive' : ($diferenca_total < 0 ? 'negative' : '');
                                $icone_total = $diferenca_total > 0 ? 'fa-arrow-up' : ($diferenca_total < 0 ? 'fa-arrow-down' : 'fa-equals');
                                ?>
                                <div class="stat-item">
                                    <div class="stat-label">Total <?= $tipo_comparacao === 'funcionarios' ? 'de Funcionários' : 'de Empresas' ?></div>
                                    <div class="stat-value <?= $classe_total ?>">
                                        <i class="fas <?= $icone_total ?>"></i> <?= formatarNumero(abs($diferenca_total)) ?>
                                    </div>
                                    <div class="stat-label">
                                        <?= formatarNumero($primeiro_mes['total']) ?> → <?= formatarNumero($ultimo_mes['total']) ?>
                                    </div>
                                </div>

                                <?php if ($tipo_comparacao === 'empresas'): ?>
                                    <?php
                                    $total_novos = array_sum(array_column($resultados, 'novos'));
                                    $total_saidas = array_sum(array_column($resultados, 'saidas'));
                                    ?>
                                    <div class="stat-item">
                                        <div class="stat-label">Total de Novas Empresas</div>
                                        <div class="stat-value positive">
                                            <i class="fas fa-plus"></i> <?= formatarNumero($total_novos) ?>
                                        </div>
                                    </div>
                                    <div class="stat-item">
                                        <div class="stat-label">Total de Empresas que Saíram</div>
                                        <div class="stat-value negative">
                                            <i class="fas fa-minus"></i> <?= formatarNumero($total_saidas) ?>
                                        </div>
                                    </div>
                                    <div class="stat-item">
                                        <div class="stat-label">Taxa de Crescimento</div>
                                        <div class="stat-value <?= $diferenca_total > 0 ? 'positive' : 'negative' ?>">
                                            <?php
                                            $taxa = $primeiro_mes['total'] > 0 ?
                                                (($ultimo_mes['total'] - $primeiro_mes['total']) / $primeiro_mes['total'] * 100) : 0;
                                            echo number_format($taxa, 2, ',', '') . '%';
                                            ?>
                                        </div>
                                    </div>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>

                    <div class="data-table-container">
                        <h3><i class="fas fa-table"></i> Dados Detalhados</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Mês</th>
                                    <th>Total</th>
                                    <?php if ($tipo_comparacao === 'empresas'): ?>
                                        <th>Novas Empresas</th>
                                        <th>Empresas que Saíram</th>
                                        <th>Variação</th>
                                    <?php endif; ?>
                                </tr>
                            </thead>
                            <tbody>
                                <?php
                                $mes_anterior = null;
                                foreach ($resultados as $resultado):
                                    $variacao = $mes_anterior ? $resultado['total'] - $mes_anterior['total'] : 0;
                                    $mes_anterior = $resultado;
                                ?>
                                    <tr>
                                        <td><?= $resultado['mes'] ?></td>
                                        <td><?= formatarNumero($resultado['total']) ?></td>
                                        <?php if ($tipo_comparacao === 'empresas'): ?>
                                            <td>
                                                <span class="badge badge-success">+<?= formatarNumero($resultado['novos']) ?></span>
                                            </td>
                                            <td>
                                                <span class="badge badge-danger">-<?= formatarNumero($resultado['saidas']) ?></span>
                                            </td>
                                            <td>
                                                <?php if ($variacao > 0): ?>
                                                    <span class="badge badge-success">+<?= formatarNumero($variacao) ?></span>
                                                <?php elseif ($variacao < 0): ?>
                                                    <span class="badge badge-danger"><?= formatarNumero($variacao) ?></span>
                                                <?php else: ?>
                                                    <span><?= formatarNumero($variacao) ?></span>
                                                <?php endif; ?>
                                            </td>
                                        <?php endif; ?>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            <?php elseif ($_SERVER['REQUEST_METHOD'] === 'POST'): ?>
                <div class="alert alert-info animate__animated animate__fadeIn">
                    <i class="fas fa-info-circle"></i> Nenhum dado encontrado para o período selecionado.
                </div>
            <?php endif; ?>
        </div>
    </main>

    <div class="confirmation-modal">
        <div class="modal-content animate__animated animate__zoomIn">
            <div class="modal-header">
                <h3><i class="fas fa-sign-out-alt"></i> Confirmar Saída</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p>Tem certeza que deseja sair do sistema?</p>
            </div>
            <div class="modal-buttons">
                <button class="modal-btn confirm-btn">
                    <i class="fas fa-check"></i> Sim
                </button>
                <button class="modal-btn cancel-btn">
                    <i class="fas fa-times"></i> Cancelar
                </button>
            </div>
        </div>
    </div>

    <div class="theme-toggle" id="themeToggle">
        <i class="fas fa-moon"></i>
    </div>

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
        $(document).ready(function() {
            $('#logout-btn').click(function(e) {
                e.preventDefault();
                $('.confirmation-modal').fadeIn();
            });

            $('.cancel-btn, .modal-close').click(function() {
                $('.confirmation-modal').fadeOut();
            });

            $('.confirm-btn').click(function() {
                window.location.href = 'logout.php';
            });

            $(document).mouseup(function(e) {
                const modal = $('.confirmation-modal');
                if (!modal.is(e.target) && modal.has(e.target).length === 0) {
                    modal.fadeOut();
                }
            });

            const themeToggle = document.getElementById('themeToggle');
            const currentTheme = localStorage.getItem('theme') || 'light';

            document.documentElement.setAttribute('data-theme', currentTheme);
            themeToggle.innerHTML = `<i class="fas fa-${currentTheme === 'dark' ? 'sun' : 'moon'}"></i>`;

            themeToggle.addEventListener('click', () => {
                const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
                themeToggle.innerHTML = `<i class="fas fa-${newTheme === 'dark' ? 'sun' : 'moon'}"></i>`;
            });

            $('form').submit(function() {
                const mesInicio = parseInt($('#mes_inicio').val());
                const mesFim = parseInt($('#mes_fim').val());

                if (mesInicio > mesFim) {
                    alert('O mês inicial deve ser anterior ou igual ao mês final!');
                    return false;
                }

                return true;
            });

            <?php if (!empty($resultados)): ?>
                const ctx = document.getElementById('progressChart').getContext('2d');
                const meses = <?= json_encode(array_column($resultados, 'mes')) ?>;
                const totais = <?= json_encode(array_column($resultados, 'total')) ?>;
                const novos = <?= $tipo_comparacao === 'empresas' ? json_encode(array_column($resultados, 'novos')) : '[]' ?>;
                const saidas = <?= $tipo_comparacao === 'empresas' ? json_encode(array_column($resultados, 'saidas')) : '[]' ?>;

                const datasets = [{
                    label: 'Total',
                    data: totais,
                    borderColor: '#6a11cb',
                    backgroundColor: 'rgba(106, 17, 203, 0.1)',
                    borderWidth: 3,
                    tension: 0.3,
                    fill: true
                }];

                if (<?= $tipo_comparacao === 'empresas' ? 'true' : 'false' ?>) {
                    datasets.push({
                        label: 'Novas Empresas',
                        data: novos,
                        borderColor: '#2ecc71',
                        backgroundColor: 'rgba(46, 204, 113, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: false
                    }, {
                        label: 'Empresas que Saíram',
                        data: saidas,
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: false
                    });
                }

                const progressChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: meses,
                        datasets: datasets
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'top',
                                labels: {
                                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-color')
                                }
                            },
                            tooltip: {
                                mode: 'index',
                                intersect: false,
                                callbacks: {
                                    label: function(context) {
                                        return context.dataset.label + ': ' + context.raw;
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted')
                                },
                                grid: {
                                    color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
                                }
                            },
                            x: {
                                ticks: {
                                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted')
                                },
                                grid: {
                                    color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
                                }
                            }
                        },
                        interaction: {
                            mode: 'nearest',
                            axis: 'x',
                            intersect: false
                        }
                    }
                });

                themeToggle.addEventListener('click', () => {
                    setTimeout(() => {
                        progressChart.options.scales.x.ticks.color = getComputedStyle(document.documentElement).getPropertyValue('--text-muted');
                        progressChart.options.scales.y.ticks.color = getComputedStyle(document.documentElement).getPropertyValue('--text-muted');
                        progressChart.options.scales.y.grid.color = getComputedStyle(document.documentElement).getPropertyValue('--border-color');
                        progressChart.options.scales.x.grid.color = getComputedStyle(document.documentElement).getPropertyValue('--border-color');
                        progressChart.options.plugins.legend.labels.color = getComputedStyle(document.documentElement).getPropertyValue('--text-color');
                        progressChart.update();
                    }, 300);
                });
            <?php endif; ?>
        });
    </script>
<script src="scripts_globais.js"></script>

</body>

</html>