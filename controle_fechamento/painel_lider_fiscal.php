<?php
require 'assets/backend/config.php';
session_start();

$nome_arquivo_atual = basename($_SERVER['PHP_SELF']);
$usuario_id = $_SESSION['usuario_id'] ?? 0;
$tipo_conta = $_SESSION['tipo_conta'] ?? '';
$area_lider = '';

if (strpos($tipo_conta, 'lider_') === 0) {
    $area_lider = str_replace('lider_', '', $tipo_conta);
} else if ($tipo_conta !== 'admin') {
    header('Location: dashboard.php');
    exit();
}
if ($tipo_conta === 'admin' && empty($area_lider)) {
    $area_lider = 'fiscal'; // Área padrão para admin
}

// --- 2. LÓGICA PARA PROCESSAR A DELEGAÇÃO VIA AJAX (CORRIGIDO) ---
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delegar_em_massa'])) {
    header('Content-Type: application/json');
    $empresas_selecionadas = $_POST['empresas_selecionadas'] ?? [];
    $usuarios_selecionados = $_POST['usuarios_selecionados'] ?? [];
    $tipo_tarefa_massa = $_POST['tipo_tarefa'] ?? '';

    if (empty($empresas_selecionadas) || empty($usuarios_selecionados) || empty($tipo_tarefa_massa)) {
        echo json_encode(['success' => false, 'message' => 'Selecione empresas, responsáveis e o tipo de tarefa.']);
        exit();
    }

    $novas_delegacoes = 0;

    // Preparar as queries fora do loop para mais performance
    $sql_mes = "SELECT id_mes FROM controle_fechamento WHERE id = ? LIMIT 1";
    $stmt_mes = $conexao->prepare($sql_mes);

    $sql_insert = "INSERT IGNORE INTO responsaveis_empresa (id_empresa, id_usuario, id_mes, tipo_tarefa) VALUES (?, ?, ?, ?)";
    $stmt_insert = $conexao->prepare($sql_insert);

    foreach ($empresas_selecionadas as $id_empresa) {
        $stmt_mes->bind_param('i', $id_empresa);
        $stmt_mes->execute();
        $id_mes = $stmt_mes->get_result()->fetch_assoc()['id_mes'] ?? null;

        if ($id_mes) {
            foreach ($usuarios_selecionados as $id_usuario) {
                $stmt_insert->bind_param('iiis', $id_empresa, $id_usuario, $id_mes, $tipo_tarefa_massa);
                if ($stmt_insert->execute() && $stmt_insert->affected_rows > 0) {
                    $novas_delegacoes++;
                }
            }
        }
    }
    $stmt_mes->close();
    $stmt_insert->close();

    if ($novas_delegacoes > 0) {
        echo json_encode(['success' => true, 'message' => "$novas_delegacoes novas delegações foram salvas com sucesso!"]);
    } else {
        echo json_encode(['success' => true, 'message' => 'Nenhuma nova delegação foi adicionada (provavelmente já existiam).']);
    }
    exit();
}


// --- 3. BUSCA DE DADOS PARA A PÁGINA ---

// Lógica robusta para pegar o ID do mês ativo
$mes_atual_id = null;
$mes_atual_num = date('n');
$ano_atual = date('Y');
$sql_mes_atual = "SELECT id FROM controle_meses WHERE mes = ? AND ano = ? LIMIT 1";
$stmt_mes_atual = $conexao->prepare($sql_mes_atual);
$stmt_mes_atual->bind_param('ii', $mes_atual_num, $ano_atual);
$stmt_mes_atual->execute();
$result_mes = $stmt_mes_atual->get_result();
if ($result_mes->num_rows > 0) {
    $mes_atual_id = $result_mes->fetch_assoc()['id'];
} else {
    if (function_exists('obterMesAtualAberto')) {
        $mes_atual_id = obterMesAtualAberto($conexao);
    } else {
        $sql_ultimo_mes = "SELECT id FROM controle_meses ORDER BY ano DESC, mes DESC LIMIT 1";
        $result_ultimo = $conexao->query($sql_ultimo_mes);
        if ($result_ultimo && $result_ultimo->num_rows > 0) {
            $mes_atual_id = $result_ultimo->fetch_assoc()['id'];
        }
    }
}
$stmt_mes_atual->close();

// Incluir o líder na lista da equipe
$equipe = [];
if ($area_lider) {
    $sql_equipe = "SELECT id, nome FROM usuarios WHERE tipo_conta = ? OR id = ?";
    $stmt_equipe = $conexao->prepare($sql_equipe);
    $stmt_equipe->bind_param('si', $area_lider, $usuario_id);
    $stmt_equipe->execute();
    $equipe = $stmt_equipe->get_result()->fetch_all(MYSQLI_ASSOC);
}

// Busca empresas ativas para delegação
$empresas = [];
if ($mes_atual_id) {
    $sql_empresas = "SELECT id, empresa FROM controle_fechamento WHERE id_mes = ? AND (data_saida IS NULL OR data_saida > CURDATE()) ORDER BY empresa ASC";
    $stmt_empresas = $conexao->prepare($sql_empresas);
    $stmt_empresas->bind_param('i', $mes_atual_id);
    $stmt_empresas->execute();
    $empresas = $stmt_empresas->get_result()->fetch_all(MYSQLI_ASSOC);
}

// Busca empresas já delegadas para marcação visual
$empresas_ja_delegadas_ids = [];
if ($mes_atual_id) {
    $sql_delegadas = "SELECT DISTINCT id_empresa FROM responsaveis_empresa WHERE id_mes = ? AND tipo_tarefa = ?";
    $stmt_delegadas = $conexao->prepare($sql_delegadas);
    $stmt_delegadas->bind_param('is', $mes_atual_id, $area_lider);
    $stmt_delegadas->execute();
    $result_delegadas = $stmt_delegadas->get_result()->fetch_all(MYSQLI_ASSOC);
    $empresas_ja_delegadas_ids = array_column($result_delegadas, 'id_empresa');
}

// Calcula progresso da equipe (com total de funcionários)
$progresso_equipe = [];
$equipe_ids = array_column($equipe, 'id');
if (!empty($equipe_ids) && $mes_atual_id) {
    $ids_placeholder = implode(',', array_fill(0, count($equipe_ids), '?'));
    $coluna_status = "status_" . $area_lider;
    $sql_progresso = "
        SELECT u.id, u.nome, COUNT(re.id) AS total_atribuido,
               SUM(CASE WHEN cf.$coluna_status = 'Concluído' THEN 1 ELSE 0 END) AS concluidas,
               COALESCE(SUM(cf.qtde_funcionarios), 0) AS total_funcionarios_equipe
        FROM usuarios u
        LEFT JOIN responsaveis_empresa re ON u.id = re.id_usuario AND re.id_mes = ? AND re.tipo_tarefa = ?
        LEFT JOIN controle_fechamento cf ON re.id_empresa = cf.id
        WHERE u.id IN ($ids_placeholder)
        GROUP BY u.id, u.nome ORDER BY u.nome ASC
    ";
    $params = array_merge([$mes_atual_id, $area_lider], $equipe_ids);
    $types = 'is' . str_repeat('i', count($equipe_ids));
    $stmt_progresso = $conexao->prepare($sql_progresso);
    $stmt_progresso->bind_param($types, ...$params);
    $stmt_progresso->execute();
    $progresso_equipe = $stmt_progresso->get_result()->fetch_all(MYSQLI_ASSOC);
}
?>
<!DOCTYPE html>
<html lang="pt-br" data-theme="light">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Painel do Líder - <?= ucfirst($area_lider) ?></title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link rel="stylesheet" href="assets/css/painel_lider_fiscal.css">
</head>

<body>
    <div class="background-waves"></div>
    <header class="header"><?php
                            require 'assets/backend/config.php';
                            session_start();

                            // --- 1. LÓGICA DE PERMISSÃO E CONTEXTO DO LÍDER ---
                            $usuario_id = $_SESSION['usuario_id'] ?? 0;
                            $tipo_conta = $_SESSION['tipo_conta'] ?? '';
                            $area_lider = '';

                            if (strpos($tipo_conta, 'lider_') === 0) {
                                $area_lider = str_replace('lider_', '', $tipo_conta);
                            } else {
                                // Apenas líderes podem acessar esta página
                                header('Location: dashboard.php');
                                exit();
                            }

                            // --- 2. LÓGICA PARA PROCESSAR A DELEGAÇÃO ---
                            if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delegar_em_massa'])) {
                                $empresas_selecionadas = $_POST['empresas_selecionadas'] ?? [];
                                $usuarios_selecionados = $_POST['usuarios_selecionados'] ?? [];

                                // A tarefa é sempre a do líder, vinda do campo oculto
                                $tipo_tarefa_massa = $_POST['tipo_tarefa'] ?? '';

                                if (empty($empresas_selecionadas) || empty($usuarios_selecionados) || $tipo_tarefa_massa !== $area_lider) {
                                    $erro = "Ocorreu um erro. Selecione empresas e responsáveis.";
                                } else {
                                    $novas_delegacoes = 0;
                                    // ... (Sua lógica de INSERT IGNORE que já funciona) ...
                                    $_SESSION['flash_message'] = ['tipo' => 'sucesso', 'texto' => "$novas_delegacoes novas delegações foram salvas!"];
                                    header("Location: " . $_SERVER['REQUEST_URI']);
                                    exit();
                                }
                            }

                            // --- 3. BUSCA DE DADOS PARA A PÁGINA ---
                            // (Lógica para buscar $mes_atual_id, $empresas e a equipe do líder)
                            // ...

                            ?>
        <!DOCTYPE html>
        <h1><i class="fas fa-user-shield"></i> Painel do Líder: <span><?= ucfirst($area_lider) ?></span></h1>
        <a href="dashboard.php" class="btn btn-outline"><i class="fas fa-arrow-left"></i> Voltar</a>
    </header>

    <main class="main-content">
        <div class="card">
            <h2><i class="fas fa-chart-line"></i> Progresso da Equipe</h2>
            <div class="team-progress-container">
                <?php foreach ($progresso_equipe as $membro):
                    $total = (int)($membro['total_atribuido'] ?? 0);
                    $concluidas = (int)($membro['concluidas'] ?? 0);
                    $progresso = ($total > 0) ? ($concluidas / $total) * 100 : 0;
                ?>
                    <div class="member-card">
                        <div class="member-info">
                            <span class="member-name">
                                <?= htmlspecialchars($membro['nome']) ?>
                                <?php if ($membro['id'] == $usuario_id): ?>
                                    <span class="voce-tag-header">(Você)</span>
                                <?php endif; ?>
                            </span>
                            <div class="member-stats">
                                <span title="Empresas na carteira"><i class="fas fa-building"></i> <?= $total ?></span>
                                <span title="Total de funcionários"><i class="fas fa-users"></i> <?= (int)($membro['total_funcionarios_equipe'] ?? 0) ?></span>
                            </div>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: <?= number_format($progresso, 2) ?>%;" title="<?= $concluidas ?> de <?= $total ?> concluídas (<?= number_format($progresso, 2) ?>%)"></div>
                        </div>
                        <a href="detalhes_funcionario.php?id=<?= $membro['id'] ?>&area=<?= $area_lider ?>" class="btn btn-small">Ver Detalhes</a>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>

        <div class="card">
            <h2><i class="fas fa-tasks"></i> Delegar Tarefas</h2>
            <form id="form-delegacao" method="POST">
                <div class="delegation-grid">
                    <div class="delegation-column">
                        <h3><i class="fas fa-building"></i> 1. Selecione as Empresas</h3>
                        <div class="search-container"><input type="text" id="filtro-empresas" class="form-control" placeholder="Filtrar empresas..."></div>
                        <div class="scrollable-list" id="lista-empresas">
                            <?php foreach ($empresas as $empresa): ?>
                                <label>
                                    <input type="checkbox" name="empresas_selecionadas[]" value="<?= $empresa['id'] ?>">
                                    <?= htmlspecialchars($empresa['empresa']) ?>
                                    <?php if (in_array($empresa['id'], $empresas_ja_delegadas_ids)): ?>
                                        <i class="fas fa-check-circle delegated-icon" title="Esta empresa já possui responsável nesta área"></i>
                                    <?php endif; ?>
                                </label>
                            <?php endforeach; ?>
                        </div>
                        <button type="button" class="btn btn-outline btn-small" id="selecionar-todas-empresas">Selecionar Visíveis</button>
                    </div>
                    <div class="delegation-column">
                        <h3><i class="fas fa-users"></i> 2. Selecione os Responsáveis</h3>
                        <div class="search-container"><input type="text" id="filtro-equipe" class="form-control" placeholder="Filtrar funcionários..."></div>
                        <div class="scrollable-list" id="lista-equipe">
                            <?php foreach ($equipe as $membro): ?>
                                <label>
                                    <input type="checkbox" name="usuarios_selecionados[]" value="<?= $membro['id'] ?>">
                                    <?= htmlspecialchars($membro['nome']) ?>
                                    <?php if ($membro['id'] == $usuario_id): ?>
                                        <span class="voce-tag">(Você)</span>
                                    <?php endif; ?>
                                </label>
                            <?php endforeach; ?>
                        </div>
                        <button type="button" class="btn btn-outline btn-small" id="selecionar-todos-equipe">Selecionar Visíveis</button>
                    </div>
                </div>
                <div class="action-footer">
                    <input type="hidden" name="tipo_tarefa" value="<?= $area_lider ?>">
                    <button type="submit" name="delegar_em_massa" class="btn btn-success btn-large">
                        <i class="fas fa-check-double"></i> Confirmar e Delegar Tarefas
                    </button>
                </div>
            </form>
        </div>
    </main>

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script>
        $(document).ready(function() {
            // --- FUNÇÃO DE NOTIFICAÇÃO (POPUP) ---
            function mostrarNotificacao(mensagem, tipo = 'success') {
                const icone = tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
                const classeAlerta = tipo === 'success' ? 'alert-success' : 'alert-error';
                const notificacao = $(`<div class="alert ${classeAlerta} fixed-top"><i class="fas ${icone}"></i> ${mensagem}</div>`);
                $('body').append(notificacao);
                notificacao.fadeIn('slow', () => setTimeout(() => notificacao.fadeOut('slow', () => notificacao.remove()), 4000));
            }

            // --- LÓGICA DA PÁGINA DE DELEGAÇÃO ---
            // Filtros instantâneos para as listas
            $('#filtro-empresas').on('keyup', function() {
                const value = $(this).val().toLowerCase();
                $("#lista-empresas label").filter(function() {
                    $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1);
                });
            });
            $('#filtro-equipe').on('keyup', function() {
                const value = $(this).val().toLowerCase();
                $("#lista-equipe label").filter(function() {
                    $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1);
                });
            });

            // Funções para "Selecionar Todos" (apenas visíveis)
            $('#selecionar-todas-empresas').on('click', function() {
                const checkboxes = $('#lista-empresas label:visible input[type="checkbox"]');
                const shouldCheck = checkboxes.filter(':checked').length < checkboxes.length;
                checkboxes.prop('checked', shouldCheck);
            });
            $('#selecionar-todos-equipe').on('click', function() {
                const checkboxes = $('#lista-equipe label:visible input[type="checkbox"]');
                const shouldCheck = checkboxes.filter(':checked').length < checkboxes.length;
                checkboxes.prop('checked', shouldCheck);
            });

            // --- SUBMISSÃO DO FORMULÁRIO COM AJAX E FEEDBACK ---
            $('#form-delegacao').on('submit', function(e) {
                e.preventDefault();
                const form = $(this);
                const btn = form.find('button[name="delegar_em_massa"]');
                const originalHtml = btn.html();

                btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Delegando...');

                $.ajax({
                    url: '<?= $nome_arquivo_atual ?>',
                    method: 'POST',
                    data: form.serialize(),
                    dataType: 'json',
                    success: function(response) {
                        if (response.success) {
                            mostrarNotificacao(response.message, 'success');
                            setTimeout(() => location.reload(), 2000);
                        } else {
                            mostrarNotificacao(response.message || 'Ocorreu um erro.', 'error');
                        }
                    },
                    error: function() {
                        mostrarNotificacao('Ocorreu um erro de comunicação com o servidor.', 'error');
                    },
                    complete: function() {
                        btn.prop('disabled', false).html(originalHtml);
                    }
                });
            });
        });
    </script>
    <script src="scripts_globais.js"></script>

</body>

</html>