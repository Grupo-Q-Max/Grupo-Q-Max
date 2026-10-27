<?php
require 'assets/backend/config.php';
session_start();

$tipo_conta = $_SESSION['tipo_conta'] ?? '';
$area_lider = '';

if (strpos($tipo_conta, 'lider_') === 0) {
    $area_lider = str_replace('lider_', '', $tipo_conta); // Extrai 'fiscal', 'dp', ou 'contabil'
} else {
    header('Location: dashboard.php');
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delegar_em_massa'])) {
    $empresas_selecionadas = $_POST['empresas_selecionadas'] ?? [];
    $usuarios_selecionados = $_POST['usuarios_selecionados'] ?? [];
    $tipo_tarefa_massa = $_POST['tipo_tarefa'] ?? '';

    if (empty($empresas_selecionadas) || empty($usuarios_selecionados) || empty($tipo_tarefa_massa)) {
        $erro = "Para delegar, você precisa selecionar ao menos uma empresa e um responsável.";
    } else {
        $novas_delegacoes = 0;
        $total_falha = 0;

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
            } else {
                $total_falha += count($usuarios_selecionados);
            }
        }
        $stmt_mes->close();
        $stmt_insert->close();

        if ($novas_delegacoes > 0) {
            $_SESSION['flash_message'] = ['tipo' => 'sucesso', 'texto' => "$novas_delegacoes novas delegações foram salvas!"];
        } else {
            $_SESSION['flash_message'] = ['tipo' => 'erro', 'texto' => 'Nenhuma nova delegação foi salva (provavelmente já existiam).'];
        }
        if ($total_falha > 0) {
            $_SESSION['flash_message']['texto'] .= " $total_falha delegações falharam.";
        }
        header("Location: " . $_SERVER['REQUEST_URI']); 
        exit();
    }
}

if (isset($_SESSION['flash_message'])) {
    if ($_SESSION['flash_message']['tipo'] === 'sucesso') {
        $sucesso = $_SESSION['flash_message']['texto'];
    } else {
        $erro = $_SESSION['flash_message']['texto'];
    }
    unset($_SESSION['flash_message']);
}

$mes_atual_id = null;
$mes_atual_num = date('n');
$ano_atual = date('Y');
$sql_mes_atual = "SELECT id FROM controle_meses WHERE mes = ? AND ano = ? LIMIT 1";
$stmt = $conexao->prepare($sql_mes_atual);
$stmt->bind_param('ii', $mes_atual_num, $ano_atual);
$stmt->execute();
$result_mes = $stmt->get_result();
if ($result_mes->num_rows > 0) {
    $mes_atual_id = $result_mes->fetch_assoc()['id'];
} else {
    $sql_ultimo_mes = "SELECT id FROM controle_meses ORDER BY ano DESC, mes DESC LIMIT 1";
    $result_ultimo = $conexao->query($sql_ultimo_mes);
    if ($result_ultimo && $result_ultimo->num_rows > 0) {
        $mes_atual_id = $result_ultimo->fetch_assoc()['id'];
    }
}

$empresas = [];
if ($mes_atual_id) {
    $sql_empresas = "SELECT id, empresa FROM controle_fechamento WHERE id_mes = ? AND (data_saida IS NULL OR data_saida > CURDATE()) ORDER BY empresa ASC";
    $stmt_empresas = $conexao->prepare($sql_empresas);
    $stmt_empresas->bind_param('i', $mes_atual_id);
    $stmt_empresas->execute();
    $result_empresas = $stmt_empresas->get_result();
    $empresas = $result_empresas->fetch_all(MYSQLI_ASSOC);
}

$equipe = [];
$sql_equipe = "SELECT id, nome FROM usuarios WHERE tipo_conta = ?";
$stmt_equipe = $conexao->prepare($sql_equipe);
$stmt_equipe->bind_param('s', $area_lider);
$stmt_equipe->execute();
$equipe = $stmt_equipe->get_result()->fetch_all(MYSQLI_ASSOC);
?>

<!DOCTYPE html>
<html lang="pt-br" data-theme="light">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Delegar Tarefas - <?= ucfirst($area_lider) ?></title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        :root {
            --primary-color: #6a11cb;
            --primary-dark: #2575fc;
            --primary-gradient: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
            --bg-color: #f4f7f9;
            --card-bg: #ffffff;
            --text-color: #34495e;
            --text-muted: #7f8c8d;
            --border-color: #e0e5ec;
            --shadow-color: rgba(106, 17, 203, 0.1);
            --success-color: #27ae60;
            --error-color: #c0392b;
            --animation-speed: 0.3s;
        }

        :root[data-theme="dark"] {
            --bg-color: #1a1a2e;
            --card-bg: #16213e;
            --text-color: #e0e0e0;
            --text-muted: #a7a9be;
            --border-color: #2a3b5a;
            --input-bg: #0f192e;
            --shadow-color: rgba(0, 0, 0, 0.2);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', sans-serif;
        }

        body {
            background-color: var(--bg-color);
            color: var(--text-color);
            transition: background-color var(--animation-speed) ease;
        }

        .background-waves {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            background: radial-gradient(circle at 10% 20%, rgba(106, 17, 203, 0.05), transparent 40%), radial-gradient(circle at 80% 90%, rgba(37, 117, 252, 0.05), transparent 40%);
        }

        .header {
            background: var(--card-bg);
            padding: 1rem 1.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 1rem;
            box-shadow: 0 4px 15px var(--shadow-color);
            border-bottom: 2px solid var(--primary-color);
            position: sticky;
            top: 0;
            z-index: 100;
        }

        .header h1 {
            color: var(--text-color);
            font-size: 1.4rem;
            font-weight: 500;
            margin: 0;
        }

        .header h1 span {
            color: var(--primary-color);
            font-weight: 700;
        }

        .btn {
            background: var(--primary-gradient);
            color: white;
            border: none;
            padding: 0.6rem 1.2rem;
            border-radius: 8px;
            cursor: pointer;
            transition: all var(--animation-speed) ease;
            font-weight: 500;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            box-shadow: 0 4px 10px var(--shadow-color);
        }

        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 15px var(--shadow-color);
        }

        .btn-outline {
            background: transparent;
            border: 1px solid var(--border-color);
            color: var(--text-muted);
        }

        .btn-outline:hover {
            background: var(--primary-color);
            color: white;
            border-color: var(--primary-color);
        }

        .btn-success {
            background: var(--success-color);
        }

        .btn-small {
            padding: 0.4rem 0.8rem;
            font-size: 0.8rem;
        }

        .main-content {
            max-width: 1200px;
            margin: 2rem auto;
            padding: 0 1rem;
        }

        .card {
            background: var(--card-bg);
            border-radius: 12px;
            box-shadow: 0 8px 30px var(--shadow-color);
            padding: 2rem;
            border: 1px solid var(--border-color);
        }

        .card h3 {
            font-size: 1.2rem;
            color: var(--primary-color);
            margin-bottom: 1.5rem;
        }

        .alert {
            padding: 1rem;
            margin-bottom: 1.5rem;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 0.8rem;
        }

        .alert-success {
            background-color: rgba(39, 174, 96, 0.1);
            border-left: 5px solid var(--success-color);
            color: #218838;
        }

        .alert-error {
            background-color: rgba(192, 57, 43, 0.1);
            border-left: 5px solid var(--error-color);
            color: var(--error-color);
        }

        .delegation-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1.5rem;
            margin-bottom: 1.5rem;
        }

        .search-container {
            position: relative;
            margin-bottom: 1rem;
        }

        .form-control {
            width: 100%;
            padding: 0.8rem 1rem 0.8rem 2.5rem;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            font-size: 1rem;
            background: var(--bg-color);
            color: var(--text-color);
        }

        .search-container i {
            position: absolute;
            left: 1rem;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
        }

        .scrollable-list {
            max-height: 350px;
            overflow-y: auto;
            border: 1px solid var(--border-color);
            padding: 0.5rem;
            border-radius: 8px;
            margin-bottom: 1rem;
        }

        .scrollable-list label {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.75rem;
            border-radius: 6px;
            cursor: pointer;
            transition: background-color 0.2s ease;
        }

        .scrollable-list label:hover {
            background-color: var(--bg-color);
        }

        .scrollable-list input[type="checkbox"] {
            width: 18px;
            height: 18px;
        }

        .action-card {
            text-align: center;
        }

        .action-card p {
            margin-bottom: 1.5rem;
            color: var(--text-muted);
        }

        @media (max-width: 992px) {
            .delegation-grid {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 768px) {
            .header {
                flex-direction: column;
            }

            .main-content {
                margin-top: 1rem;
            }

            .card {
                padding: 1.5rem;
            }
        }
    </style>
</head>

<body>
    <div class="background-waves"></div>
    <header class="header">
        <h1><i class="fas fa-user-shield"></i> Painel do Líder: <span><?= ucfirst($area_lider) ?></span></h1>
        <div class="header-actions">
            <a href="painel_lider.php" class="btn btn-outline"><i class="fas fa-arrow-left"></i> Voltar</a>
        </div>
    </header>

    <main class="main-content">
        <?php if (!empty($sucesso)): ?>
            <div class="alert alert-success"><?= htmlspecialchars($sucesso) ?></div>
        <?php endif; ?>
        <?php if (!empty($erro)): ?>
            <div class="alert alert-error"><?= htmlspecialchars($erro) ?></div>
        <?php endif; ?>

        <form method="POST">
            <div class="delegation-grid">
                <div class="card">
                    <h3><i class="fas fa-building"></i> 1. Selecione as Empresas</h3>
                    <div class="search-container">
                        <i class="fas fa-search"></i>
                        <input type="text" id="filtro-empresas" class="form-control" placeholder="Filtrar empresas...">
                    </div>
                    <div class="scrollable-list" id="lista-empresas">
                        <?php if (empty($empresas)): ?>
                            <p style="text-align:center; padding: 1rem; color: var(--text-muted);">Nenhuma empresa encontrada para o mês ativo.</p>
                        <?php else: ?>
                            <?php foreach ($empresas as $empresa): ?>
                                <label><input type="checkbox" name="empresas_selecionadas[]" value="<?= $empresa['id'] ?>"> <?= htmlspecialchars($empresa['empresa']) ?></label>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </div>
                    <button type="button" class="btn btn-outline btn-small" id="selecionar-todas-empresas">Selecionar/Desselecionar Todas</button>
                </div>

                <div class="card">
                    <h3><i class="fas fa-users"></i> 2. Selecione os Responsáveis</h3>
                    <div class="search-container">
                        <i class="fas fa-search"></i>
                        <input type="text" id="filtro-equipe" class="form-control" placeholder="Filtrar funcionários...">
                    </div>
                    <div class="scrollable-list" id="lista-equipe">
                        <?php if (empty($equipe)): ?>
                            <p style="text-align:center; padding: 1rem; color: var(--text-muted);">Nenhum funcionário na equipe.</p>
                        <?php else: ?>
                            <?php foreach ($equipe as $membro): ?>
                                <label><input type="checkbox" name="usuarios_selecionados[]" value="<?= $membro['id'] ?>"> <?= htmlspecialchars($membro['nome']) ?></label>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </div>
                    <button type="button" class="btn btn-outline btn-small" id="selecionar-todos-equipe">Selecionar/Desselecionar Todos</button>
                </div>
            </div>

            <div class="card action-card">
                <h3><i class="fas fa-check-double"></i> 3. Confirmar Delegação</h3>
                <p>Você está prestes a delegar as empresas selecionadas para os membros da equipe selecionados na área de <strong><?= ucfirst($area_lider) ?></strong>.</p>
                <input type="hidden" name="tipo_tarefa" value="<?= $area_lider ?>">
                <button type="submit" name="delegar_em_massa" class="btn btn-success"><i class="fas fa-check"></i> Confirmar e Delegar</button>
            </div>
        </form>
    </main>

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script>
        $(document).ready(function() {
            $('#filtro-empresas').on('keyup', function() {
                const value = $(this).val().toLowerCase();
                $("#lista-empresas label").filter(function() {
                    $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1)
                });
            });

            $('#filtro-equipe').on('keyup', function() {
                const value = $(this).val().toLowerCase();
                $("#lista-equipe label").filter(function() {
                    $(this).toggle($(this).text().toLowerCase().indexOf(value) > -1)
                });
            });

            $('#selecionar-todas-empresas').on('click', function() {
                const checkboxes = $('#lista-empresas').find('tr:visible input[type="checkbox"]');
                const totalVisiveis = checkboxes.length;
                const totalMarcados = checkboxes.filter(':checked').length;
                const marcarTodos = totalMarcados < (totalVisiveis / 2);
                checkboxes.prop('checked', marcarTodos);
            });

            $('#selecionar-todos-equipe').on('click', function() {
                const checkboxes = $('#lista-equipe').find('tr:visible input[type="checkbox"]');
                const totalVisiveis = checkboxes.length;
                const totalMarcados = checkboxes.filter(':checked').length;
                const marcarTodos = totalMarcados < (totalVisiveis / 2);
                checkboxes.prop('checked', marcarTodos);
            });
        });
    </script>
    <script src="scripts_globais.js"></script>

</body>

</html>