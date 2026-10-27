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

$cargos_permitidos = ['admin', 'lider_dp', 'lider_fiscal', 'lider_contabil'];

if (!in_array($_SESSION['tipo_conta'], $cargos_permitidos)) {
    header('Location: index.php');
    exit();
}
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['mudar_edicao_status'])) {
    $mes_id = $_POST['mes_id'];
    $novo_status_edicao = $_POST['novo_status_edicao'];

    if (!empty($mes_id) && in_array($novo_status_edicao, ['liberada', 'bloqueada'])) {
        $sql_update_mes = "UPDATE controle_meses SET edicao_status = ? WHERE id = ?";
        $stmt_update = $conexao->prepare($sql_update_mes);
        $stmt_update->bind_param('si', $novo_status_edicao, $mes_id);
        if ($stmt_update->execute()) {
            $sucesso = "Status de edição do mês alterado com sucesso!";
        } else {
            $erro = "Erro ao alterar o status de edição do mês.";
        }
    }
}
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['adicionar_funcionario'])) {
    $nome_completo = trim($_POST['nome_completo']);
    $usuario = trim($_POST['usuario']);
    $senha = $_POST['senha'];
    $tipo_conta = $_POST['tipo_conta'];

    if (empty($nome_completo) || empty($usuario) || empty($senha) || empty($tipo_conta)) {
        $erro = "Todos os campos são obrigatórios!";
    } else {
        $sql_verificar = "SELECT id FROM usuarios WHERE usuario = ?";
        $stmt = $conexao->prepare($sql_verificar);
        $stmt->bind_param('s', $usuario);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows > 0) {
            $erro = "Este nome de usuário já está em uso!";
        } else {
            $senha_hash = password_hash($senha, PASSWORD_DEFAULT);

            $sql_inserir = "INSERT INTO usuarios (nome, usuario, senha, tipo_conta) VALUES (?, ?, ?, ?)";
            $stmt = $conexao->prepare($sql_inserir);
            $stmt->bind_param('ssss', $nome_completo, $usuario, $senha_hash, $tipo_conta);

            if ($stmt->execute()) {
                $sucesso = "Funcionário adicionado com sucesso!";
            } else {
                $erro = "Erro ao adicionar funcionário: " . $conexao->error;
            }
        }
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['editar_funcionario'])) {
    $id = $_POST['id'];
    $nome_completo = trim($_POST['nome_completo']);
    $usuario = trim($_POST['usuario']);
    $tipo_conta = $_POST['tipo_conta'];
    $senha = $_POST['senha'];

    if (empty($nome_completo) || empty($usuario) || empty($tipo_conta)) {
        $erro_edicao = "Todos os campos são obrigatórios!";
    } else {
        $sql_verificar = "SELECT id FROM usuarios WHERE usuario = ? AND id != ?";
        $stmt = $conexao->prepare($sql_verificar);
        $stmt->bind_param('si', $usuario, $id);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows > 0) {
            $erro_edicao = "Este nome de usuário já está em uso por outro funcionário!";
        } else {
            if (!empty($senha)) {
                $senha_hash = password_hash($senha, PASSWORD_DEFAULT);
                $sql_editar = "UPDATE usuarios SET nome = ?, usuario = ?, tipo_conta = ?, senha = ? WHERE id = ?";
                $stmt = $conexao->prepare($sql_editar);
                $stmt->bind_param('ssssi', $nome_completo, $usuario, $tipo_conta, $senha_hash, $id);
            } else {
                $sql_editar = "UPDATE usuarios SET nome = ?, usuario = ?, tipo_conta = ? WHERE id = ?";
                $stmt = $conexao->prepare($sql_editar);
                $stmt->bind_param('sssi', $nome_completo, $usuario, $tipo_conta, $id);
            }

            if ($stmt->execute()) {
                $sucesso_edicao = "Funcionário atualizado com sucesso!";
            } else {
                $erro_edicao = "Erro ao atualizar funcionário: " . $conexao->error;
            }
        }
    }
}

$funcionarios = [];
$sql_funcionarios = "SELECT id, nome, usuario, tipo_conta FROM usuarios ORDER BY nome";
$result_funcionarios = $conexao->query($sql_funcionarios);
if ($result_funcionarios) {
    $funcionarios = $result_funcionarios->fetch_all(MYSQLI_ASSOC);
}
$total_funcionarios_ativos = count($funcionarios);


$mes_atual_num = date('n');
$ano_atual = date('Y');

$sql_mes_atual = "SELECT id, mes, ano FROM controle_meses WHERE mes = ? AND ano = ?";
$stmt = $conexao->prepare($sql_mes_atual);
$stmt->bind_param('ii', $mes_atual_num, $ano_atual);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    $mes_atual = $result->fetch_assoc();
    $id_mes_atual = $mes_atual['id'];
} else {
    $id_mes_atual = obterMesAtualAberto($conexao);
    if ($id_mes_atual) {
        $sql_mes = "SELECT id, mes, ano FROM controle_meses WHERE id = ?";
        $stmt = $conexao->prepare($sql_mes);
        $stmt->bind_param('i', $id_mes_atual);
        $stmt->execute();
        $result = $stmt->get_result();
        $mes_atual = $result->fetch_assoc();
    } else {
        $mes_atual = false;
    }
}

$contagem = [
    'sn' => 0,
    'lp' => 0,
    'lr' => 0,
    'imune' => 0,
    'mei' => 0,
    'total' => 0,
    'total_funcionarios' => 0
];

$novos_contratos = [];
$contratos_sairam = [];
$obrigacoes_futuras = [];
$empresas_saindo = [];
$total_obrigacoes_futuras = 0;
$total_empresas_saindo = 0;

// ✅ CORRIJA ESTE ARRAY NO SEU DASHBOARD
$lista_tributacoes = [
    'mei'                     => ['label' => 'MEI', 'icone' => 'fa-store', 'cor' => 'mei'],
    'simples_nacional'        => ['label' => 'Simples Nacional', 'icone' => 'fa-chart-pie', 'cor' => 'sn'],
    'lucro_presumido'         => ['label' => 'Lucro Presumido', 'icone' => 'fa-chart-bar', 'cor' => 'lp'],
    'lucro_real/trimestral'   => ['label' => 'Lucro Real/Trimestral', 'icone' => 'fa-chart-line', 'cor' => 'lr'],
    'lucro_real/estimativa'   => ['label' => 'Lucro Real/Estimativa', 'icone' => 'fa-chart-area', 'cor' => 'lr'],
    'lucro_real/anual'        => ['label' => 'Lucro Real/Anual', 'icone' => 'fa-calendar-alt', 'cor' => 'lr'],
    'imune_irpj'              => ['label' => 'Imune IRPJ', 'icone' => 'fa-shield-alt', 'cor' => 'imune'],
    'condominios'             => ['label' => 'Condomínios', 'icone' => 'fa-building', 'cor' => 'condominio'],
    'domestica'               => ['label' => 'Doméstica', 'icone' => 'fa-home', 'cor' => 'domestica'],
    'associacoes'             => ['label' => 'Associações', 'icone' => 'fa-users', 'cor' => 'associacao'],
    'pessoa_fisica'           => ['label' => 'Pessoa Física', 'icone' => 'fa-user', 'cor' => 'pfisica']
];



if ($id_mes_atual) {
    // ✅ PASSO 2: CONSULTA SQL DINÂMICA
    $sql_cases = "";
    foreach ($lista_tributacoes as $nome_db => $dados) {
        $chave_segura = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $dados['label']));
        $sql_cases .= "SUM(CASE WHEN tributacao = '{$nome_db}' THEN 1 ELSE 0 END) as {$chave_segura}, ";
    }

    $sql = "SELECT 
        {$sql_cases}
        COUNT(*) as total,
        COALESCE(SUM(qtde_funcionarios), 0) as total_funcionarios
    FROM controle_fechamento
    WHERE id_mes = ? AND (data_saida IS NULL OR data_saida > CURDATE())";

    $stmt = $conexao->prepare($sql);
    $stmt->bind_param('i', $id_mes_atual);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result) {
        $contagem = $result->fetch_assoc();
    }

    $sql_novos_contratos = "SELECT 
    MAX(codigo) as codigo,
    empresa, 
    tributacao,
    DATE_FORMAT(MIN(data_contrato), '%d/%m/%Y') as data_contrato_formatada,
    DATE_FORMAT(MIN(data_obrigacao), '%d/%m/%Y') as data_obrigacao_formatada,
    IF(MIN(data_saida) IS NULL, 'N/A', DATE_FORMAT(MIN(data_saida), '%d/%m/%Y')) as data_saida_formatada
    FROM controle_fechamento
    WHERE id_mes = ? 
    AND MONTH(data_contrato) = ? 
    AND YEAR(data_contrato) = ?
    GROUP BY codigo";


    $stmt = $conexao->prepare($sql_novos_contratos);
    $stmt->bind_param('iii', $id_mes_atual, $mes_atual['mes'], $mes_atual['ano']);
    $stmt->execute();
    $result = $stmt->get_result();
    $novos_contratos = $result->fetch_all(MYSQLI_ASSOC);

    $sql_contratos_sairam = "SELECT 
    MAX(codigo) as codigo,
    empresa, 
    tributacao,
    DATE_FORMAT(MIN(data_contrato), '%d/%m/%Y') as data_contrato_formatada,
    IF(MIN(data_saida) IS NULL, 'N/A', DATE_FORMAT(MIN(data_saida), '%d/%m/%Y')) as data_saida_formatada
    FROM controle_fechamento
    WHERE data_saida IS NOT NULL
    AND MONTH(data_saida) = ? 
    AND YEAR(data_saida) = ?
    GROUP BY codigo";


    $stmt = $conexao->prepare($sql_contratos_sairam);
    $stmt->bind_param('ii', $mes_atual['mes'], $mes_atual['ano']);
    $stmt->execute();
    $result = $stmt->get_result();
    $contratos_sairam = $result->fetch_all(MYSQLI_ASSOC);
}

$sql_meses = "SELECT id, mes, ano, status, edicao_status FROM controle_meses ORDER BY ano DESC, mes DESC";
$result_meses = $conexao->query($sql_meses);
$meses_disponiveis = $result_meses->fetch_all(MYSQLI_ASSOC);

// Define os campos obrigatórios para cada área
$campos_obrigatorios_dp = ['adto', 'folha_pagamento', 'data_pagamento', 'qtde_funcionarios', 'guias_sindicato', 'dissidio', 'fgts_digital', 'e_social', 'dctf_web_mes', 'sd_login', 'sd_senha'];
$campos_obrigatorios_fiscal = ['reinf', 'impostos', 'iss', 'mit', 'dec_estadual', 'sped_fiscal', 'sped_contribuicao', 'destda', 'gia', 'dctf'];
$campos_obrigatorios_contabil = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro', 'balancete', 'distribuicao_dirf', 'defs', 'dasn', 'ecd', 'ecf'];
$campos_obrigatorios_cushman = ['iss_cushman', 'devec_cushman', 'sped_fiscal_cushman', 'reinf_cushman', 'esocial_cushman'];

function calcularProgressoGeral($conexao, $id_mes, $campos_obrigatórios, $nome_setor)
{
    // Inicia a consulta SQL base
    $sql_base = "
        SELECT *
        FROM controle_fechamento
        WHERE id_mes = ? 
        AND (data_saida IS NULL OR data_saida > CURDATE())
    ";

    // Adiciona o filtro de permissão de forma CONDICIONAL
    if ($nome_setor === 'cushman') {
        // REGRA RÍGIDA PARA CUSHMAN: Deve conter 'cushman' explicitamente
        $sql_permissao = " AND FIND_IN_SET(?, setores_permitidos) > 0";
    } else {
        // REGRA FLEXÍVEL PARA OUTROS SETORES: Vazio/nulo significa permissão para todos
        $sql_permissao = " AND (setores_permitidos IS NULL OR setores_permitidos = '' OR FIND_IN_SET(?, setores_permitidos) > 0)";
    }

    // Combina a query base com o filtro de permissão
    $sql_empresas = $sql_base . $sql_permissao;

    $stmt_empresas = $conexao->prepare($sql_empresas);
    $stmt_empresas->bind_param('is', $id_mes, $nome_setor);
    $stmt_empresas->execute();
    $empresas = $stmt_empresas->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt_empresas->close();

    // O restante da lógica de cálculo permanece exatamente o mesmo
    $total_empresas = count($empresas);
    $empresas_completas = 0;
    $total_campos_possiveis = 0;
    $campos_preenchidos = 0;

    foreach ($empresas as $empresa) {
        $empresa_completa = true;
        foreach ($campos_obrigatórios as $campo) {
            $total_campos_possiveis++;
            if (!empty(trim($empresa[$campo] ?? ''))) {
                $campos_preenchidos++;
            } else {
                $empresa_completa = false;
            }
        }
        if ($empresa_completa) {
            $empresas_completas++;
        }
    }

    $progresso_por_campo = ($total_campos_possiveis > 0) ? round(($campos_preenchidos / $total_campos_possiveis) * 100) : 0;
    $progresso_por_empresa = ($total_empresas > 0) ? round(($empresas_completas / $total_empresas) * 100) : 0;

    return [
        'progresso_por_campo' => $progresso_por_campo,
        'campos_preenchidos' => $campos_preenchidos,
        'total_campos' => $total_campos_possiveis,
        'progresso_por_empresa' => $progresso_por_empresa,
        'empresas_completas' => $empresas_completas,
        'total_empresas' => $total_empresas,
    ];
}
// Chama a nova função para cada setor, passando o nome do setor para a verificação de permissão
$progresso_dp = calcularProgressoGeral($conexao, $id_mes_atual, $campos_obrigatorios_dp, 'dp');
$progresso_fiscal = calcularProgressoGeral($conexao, $id_mes_atual, $campos_obrigatorios_fiscal, 'fiscal');
$progresso_contabil = calcularProgressoGeral($conexao, $id_mes_atual, $campos_obrigatorios_contabil, 'contabil');
$progresso_cushman = calcularProgressoGeral($conexao, $id_mes_atual, $campos_obrigatorios_cushman, 'cushman');


function formatarPorcentagem($valor)
{
    return number_format((float)$valor, 2, ',', '');
}

$sql_obrigacoes_futuras = "
                SELECT 
                    empresa,
                    tributacao,
                    DATE_FORMAT(proxima_obrigacao, '%d/%m/%Y') as data_obrigacao_formatada,
                    DATEDIFF(proxima_obrigacao, CURDATE()) as dias_restantes
                FROM (
                    SELECT 
                        codigo,
                        MIN(data_obrigacao) as proxima_obrigacao,
                        MIN(empresa) as empresa,
                        MIN(tributacao) as tributacao
                    FROM controle_fechamento
                    WHERE data_obrigacao > CURDATE()
                    GROUP BY codigo
                ) as futuras
                ORDER BY proxima_obrigacao ASC
                LIMIT 10
            ";


$result_obrigacoes = $conexao->query($sql_obrigacoes_futuras);
$obrigacoes_futuras = $result_obrigacoes ? $result_obrigacoes->fetch_all(MYSQLI_ASSOC) : [];
$total_obrigacoes_futuras = count($obrigacoes_futuras);

$sql_empresas_saindo = "
                                    SELECT 
                                        empresa,
                                        tributacao,
                                        DATE_FORMAT(data_saida, '%d/%m/%Y') as data_saida_formatada,
                                        DATEDIFF(data_saida, CURDATE()) as dias_restantes
                                    FROM (
                                        SELECT 
                                            codigo,
                                            MIN(data_saida) as data_saida,
                                            MIN(empresa) as empresa,
                                            MIN(tributacao) as tributacao
                                        FROM controle_fechamento
                                        WHERE data_saida > CURDATE()
                                        GROUP BY codigo
                                    ) as saindo
                                    ORDER BY data_saida ASC
                                    LIMIT 10
                                ";

$result_saindo = $conexao->query($sql_empresas_saindo);
$empresas_saindo = $result_saindo ? $result_saindo->fetch_all(MYSQLI_ASSOC) : [];
$total_empresas_saindo = count($empresas_saindo);

$sql_novas_obrigacoes_mes = "
    SELECT 
        empresa,
        tributacao,
        DATE_FORMAT(proxima_obrigacao, '%d/%m/%Y') as data_obrigacao_formatada
    FROM (
        SELECT 
            codigo,
            MIN(data_obrigacao) as proxima_obrigacao,
            MIN(empresa) as empresa,
            MIN(tributacao) as tributacao
        FROM controle_fechamento
        WHERE MONTH(data_obrigacao) = ? AND YEAR(data_obrigacao) = ?
        GROUP BY codigo
    ) as obr_mes
    ORDER BY proxima_obrigacao ASC
";


$stmt = $conexao->prepare($sql_novas_obrigacoes_mes);
$stmt->bind_param('ii', $mes_atual_num, $ano_atual);
$stmt->execute();
$result = $stmt->get_result();
$novas_obrigacoes_mes = $result ? $result->fetch_all(MYSQLI_ASSOC) : [];
$total_novas_obrigacoes_mes = count($novas_obrigacoes_mes);

?>

<!DOCTYPE html>
<html lang="pt-br" data-theme="light">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Painel de Gestão Geral de Fechamento</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link rel="stylesheet" href="assets/css/dashboard.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">
</head>

<body>
    <header class="header animate__animated animate__fadeInDown">
        <h1><i class="fas fa-chart-line"></i> Painel de Gestão Geral</h1>
        <div class="header-actions">
            <?php
            $tipo_conta = $_SESSION['tipo_conta'] ?? '';
            if (in_array($tipo_conta, ['lider_dp', 'lider_fiscal', 'lider_contabil'])):
            ?>
                <a href="painel_lider.php" class="btn btn-secondary" title="Voltar ao Painel de Líder">
                    <i class="fas fa-arrow-left"></i> Painel Líder
                </a>
            <?php endif; ?>
            <a href="#" id="logout-btn" class="header-btn" style="text-decoration: none;"><i class="fas fa-sign-out-alt"></i> Sair</a>
        </div>
        </nav>
    </header>

    <main class="main-content">
        <div class="left-column">
            <div class="stats-container animate__animated animate__fadeInLeft">
                <div class="card-header">
                    <h2><i class="fas fa-building"></i> Empresas Ativas</h2>
                    <div class="month-selector">
                        <div class="current-month">
                            <h3>Mês: <span id="current-month" class="highlight">
                                    <?php
                                    if ($mes_atual && is_array($mes_atual)) {
                                        echo $meses_pt[$mes_atual['mes']] . ' ' . $mes_atual['ano'];
                                    } else {
                                        echo 'Nenhum mês aberto';
                                    }
                                    ?>
                                </span></h3>
                        </div>
                        <div class="month-dropdown">
                            <button class="btn-linkv" id="show-months"><i class="fas fa-calendar-alt"></i> Alterar Mês</button>
                            <div class="months-list">
                                <?php foreach ($meses_disponiveis as $mes): ?>
                                    <div class="month-option" data-mes-id="<?= $mes['id'] ?>">
                                        <i class="fas fa-calendar-check"></i> <?= $meses_pt[$mes['mes']] . ' ' . $mes['ano'] ?>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="categories-grid">
                    <?php foreach ($lista_tributacoes as $nome_db => $dados):
                        $chave_segura = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $dados['label']));
                        $contagem_valor = $contagem[$chave_segura] ?? 0;
                    ?>
                        <div class="category-item <?= $dados['cor'] ?>" data-tributacao-db="<?= htmlspecialchars($nome_db) ?>">
                            <i class="fas <?= $dados['icone'] ?>"></i>
                            <div class="category-content">
                                <span class="category-title"><?= $dados['label'] ?></span>
                                <span class="category-value"><?= $contagem_valor ?></span>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>

                <div class="stats-footer animate__animated animate__fadeIn">
                    <div class="stat-total">
                        <i class="fas fa-building"></i>
                        <div>
                            <span>Total Empresas</span>
                            <strong id="count-total"><?= $contagem['total'] ?? 0 ?></strong>
                        </div>
                    </div>
                    <div class="stat-total">
                        <i class="fas fa-users"></i>
                        <div>
                            <span>Funcionários</span>
                            <strong id="count-funcionarios"><?= isset($contagem['total_funcionarios']) ? number_format($contagem['total_funcionarios'], 0, ',', '.') : 0 ?></strong>
                        </div>
                    </div>
                </div>

                <div class="card-actions">
                    <a class="btn2 animate__animated animate__fadeInUp" style="text-decoration: none; animation-delay: 0.3s" href="cadastrar.php">
                        <i class="fas fa-plus-circle"></i> Cadastrar Empresa
                    </a>
                    <br><br>
                    <a class="btn2 animate__animated animate__fadeInUp" style="text-decoration: none; animation-delay: 0.4s" href="fechamento_completo.php">
                        <i class="fas fa-search"></i> Fechamentos
                    </a>
                    <a class="btn2 animate__animated animate__fadeInUp" style="text-decoration: none; animation-delay: 0.4s" href="visao_geral.php">
                        <i class="fas fa-search"></i> Visão Geral
                    </a>
                </div>
            </div>

            <div class="progress-container animate__animated animate__fadeInLeft">
                <div class="card-header">
                    <h2><i class="fas fa-tasks"></i> Progresso de Fechamento</h2>
                    <button class="btn btn-primary" id="toggle-progresso">
                        <i class="fas fa-toggle-on"></i> Alternar Tipo de Progresso
                    </button>
                    <div class="current-month">
                        <span id="current-month-progress" class="highlight">
                            <?php
                            if ($mes_atual && is_array($mes_atual)) {
                                echo $meses_pt[$mes_atual['mes']] . ' ' . $mes_atual['ano'];
                            } else {
                                echo 'Nenhum mês aberto';
                            }
                            ?>
                        </span>
                    </div>
                </div>

                <div class="progress-item animate__animated animate__fadeInUp" style="animation-delay: 0.1s">
                    <div class="progress-header">
                        <div class="progress-label">
                            <span><i class="fas fa-user-tie"></i> Departamento Pessoal</span>
                            <span id="progresso-dp-percent"
                                data-progresso-campo="<?= number_format($progresso_dp['progresso_por_campo'], 2) ?>%"
                                data-progresso-empresa="<?= number_format($progresso_dp['progresso_por_empresa'], 2) ?>%">
                                <?= number_format($progresso_dp['progresso_por_campo'], 2) ?>%
                            </span>
                        </div>
                        <small class="progress-info" id="progresso-dp-info"
                            data-info-campo="<?= $progresso_dp['campos_preenchidos'] ?> de <?= $progresso_dp['total_campos'] ?> campos"
                            data-info-empresa="<?= $progresso_dp['empresas_completas'] ?> de <?= $progresso_dp['total_empresas'] ?> empresas">
                            <?= $progresso_dp['campos_preenchidos'] ?> de <?= $progresso_dp['total_campos'] ?> campos
                        </small>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill dp-fill" id="progresso-dp-bar"
                            style="width: <?= number_format($progresso_dp['progresso_por_campo'], 2, '.', '') ?>%"></div>
                    </div>
                </div>

                <div class="progress-item animate__animated animate__fadeInUp" style="animation-delay: 0.2s">
                    <div class="progress-header">
                        <div class="progress-label">
                            <span><i class="fas fa-file-invoice-dollar"></i> Fiscal</span>
                            <span id="progresso-fiscal-percent"
                                data-progresso-campo="<?= number_format($progresso_fiscal['progresso_por_campo'], 2) ?>%"
                                data-progresso-empresa="<?= number_format($progresso_fiscal['progresso_por_empresa'], 2) ?>%">
                                <?= number_format($progresso_fiscal['progresso_por_campo'], 2) ?>%
                            </span>
                        </div>
                        <small class="progress-info" id="progresso-fiscal-info"
                            data-info-campo="<?= $progresso_fiscal['campos_preenchidos'] ?> de <?= $progresso_fiscal['total_campos'] ?> campos"
                            data-info-empresa="<?= $progresso_fiscal['empresas_completas'] ?> de <?= $progresso_fiscal['total_empresas'] ?> empresas">
                            <?= $progresso_fiscal['campos_preenchidos'] ?> de <?= $progresso_fiscal['total_campos'] ?> campos
                        </small>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill fiscal-fill" id="progresso-fiscal-bar"
                            style="width: <?= number_format($progresso_fiscal['progresso_por_campo'], 2, '.', '') ?>%"></div>
                    </div>
                </div>

                <div class="progress-item animate__animated animate__fadeInUp" style="animation-delay: 0.3s">
                    <div class="progress-header">
                        <div class="progress-label">
                            <span><i class="fas fa-calculator"></i> Contábil</span>
                            <span id="progresso-contabil-percent"
                                data-progresso-campo="<?= number_format($progresso_contabil['progresso_por_campo'], 2) ?>%"
                                data-progresso-empresa="<?= number_format($progresso_contabil['progresso_por_empresa'], 2) ?>%">
                                <?= number_format($progresso_contabil['progresso_por_campo'], 2) ?>%
                            </span>
                        </div>
                        <small class="progress-info" id="progresso-contabil-info"
                            data-info-campo="<?= $progresso_contabil['campos_preenchidos'] ?> de <?= $progresso_contabil['total_campos'] ?> campos"
                            data-info-empresa="<?= $progresso_contabil['empresas_completas'] ?> de <?= $progresso_contabil['total_empresas'] ?> empresas">
                            <?= $progresso_contabil['campos_preenchidos'] ?> de <?= $progresso_contabil['total_campos'] ?> campos
                        </small>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill contabil-fill" id="progresso-contabil-bar"
                            style="width: <?= number_format($progresso_contabil['progresso_por_campo'], 2, '.', '') ?>%"></div>
                    </div>
                </div>
                <div class="progress-item animate__animated animate__fadeInUp" style="animation-delay: 0.4s">
                    <div class="progress-header">
                        <div class="progress-label">
                            <span><i class="fas fa-shield-alt"></i> Cushman</span>
                            <span id="progresso-cushman-percent"
                                data-progresso-campo="<?= number_format($progresso_cushman['progresso_por_campo'], 2) ?>%"
                                data-progresso-empresa="<?= number_format($progresso_cushman['progresso_por_empresa'], 2) ?>%">
                                <?= number_format($progresso_cushman['progresso_por_campo'], 2) ?>%
                            </span>
                        </div>
                        <small class="progress-info" id="progresso-cushman-info"
                            data-info-campo="<?= $progresso_cushman['campos_preenchidos'] ?> de <?= $progresso_cushman['total_campos'] ?> campos"
                            data-info-empresa="<?= $progresso_cushman['empresas_completas'] ?> de <?= $progresso_cushman['total_empresas'] ?> empresas">
                            <?= $progresso_cushman['campos_preenchidos'] ?> de <?= $progresso_cushman['total_campos'] ?> campos
                        </small>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill cushman-fill" id="progresso-cushman-bar"
                            style="width: <?= number_format($progresso_cushman['progresso_por_campo'], 2, '.', '') ?>%"></div>
                    </div>
                </div>

            </div>

            <a class="btn2 animate__animated animate__fadeInUp" style="text-decoration: none; animation-delay: 0.3s" href="progresso_geral.php">
                <i class="fas fa-plus-circle"></i> Progresso Geral
            </a>
        </div>
        </div>

        <div class="right-column">
            <div class="expandable-section animate__animated animate__fadeInRight">
                <div class="section-header">
                    <div class="section-title">
                        <i class="fas fa-tasks"></i>
                        <div>
                            <h3>Novas Obrigações no Mês <span class="badge-count"><?= $total_novas_obrigacoes_mes ?></span></h3>
                            <p>Obrigações com início marcado para este mês</p>
                        </div>
                    </div>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="section-content">
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th><i class="fas fa-building"></i> Empresa</th>
                                    <th><i class="fas fa-tag"></i> Tributação</th>
                                    <th><i class="fas fa-calendar-day"></i> Data Obrigação</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php if (empty($novas_obrigacoes_mes)): ?>
                                    <tr>
                                        <td colspan="3" class="empty-table">
                                            <i class="fas fa-inbox"></i>
                                            <span>Nenhuma obrigação nova neste mês</span>
                                        </td>
                                    </tr>
                                <?php else: ?>
                                    <?php foreach ($novas_obrigacoes_mes as $obrigacao): ?>
                                        <tr>
                                            <td><?= htmlspecialchars($obrigacao['empresa']) ?></td>
                                            <td>
                                                <span class="badge <?= strtolower($obrigacao['tributacao']) ?>">
                                                    <?= strtoupper(substr($obrigacao['tributacao'], 0, 2)) ?>
                                                </span>
                                            </td>
                                            <td><?= htmlspecialchars($obrigacao['data_obrigacao_formatada']) ?></td>
                                        </tr>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div class="expandable-section animate__animated animate__fadeInRight">
                <div class="section-header">
                    <div class="section-title">
                        <i class="fas fa-folder-plus"></i>
                        <div>
                            <h3>Novos Contratos no Mês <span class="badge-count"><?= count($novos_contratos) ?></span></h3>
                            <p>Empresas que iniciaram contrato neste mês</p>

                        </div>
                    </div>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="section-content">
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th><i class="fas fa-building"></i> Empresa</th>
                                    <th><i class="fas fa-tag"></i> Tributação</th>
                                    <th><i class="fas fa-calendar-plus"></i> Data Contrato</th>
                                    <th><i class="fas fa-calendar-day"></i> Data Obrigação</th>
                                    <th><i class="fas fa-door-open"></i> Data Saída</th>
                                </tr>
                            </thead>
                            <tbody>

                                <?php if (empty($novos_contratos)): ?>
                                    <tr>
                                        <td colspan="5" class="empty-table">
                                            <i class="fas fa-inbox"></i>
                                            <span>Nenhum contrato iniciado neste mês</span>
                                        </td>
                                    </tr>
                                <?php else: ?>
                                    <?php foreach ($novos_contratos as $contrato): ?>
                                        <tr>
                                            <td><?= htmlspecialchars($contrato['empresa']) ?></td>
                                            <td><span class="badge <?= strtolower($contrato['tributacao']) ?>"><?= strtoupper(substr($contrato['tributacao'], 0, 2)) ?></span></td>
                                            <td><?= htmlspecialchars($contrato['data_contrato_formatada']) ?></td>
                                            <td><?= htmlspecialchars($contrato['data_obrigacao_formatada']) ?></td>
                                            <td><?= htmlspecialchars($contrato['data_saida_formatada']) ?></td>
                                        </tr>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div class="expandable-section animate__animated animate__fadeInRight">
                <div class="section-header">
                    <div class="section-title">
                        <i class="fas fa-door-closed"></i>
                        <div>
                            <h3>Contratos Encerrados no Mês <span class="badge-count"><?= count($contratos_sairam) ?></span></h3>
                            <p>Empresas que saíram no mês selecionado</p>
                        </div>
                    </div>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="section-content">
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th><i class="fas fa-building"></i> Empresa</th>
                                    <th><i class="fas fa-tag"></i> Tributação</th>
                                    <th><i class="fas fa-calendar-plus"></i> Data Contrato</th>
                                    <th><i class="fas fa-door-closed"></i> Data Saída</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php if (empty($contratos_sairam)): ?>
                                    <tr>
                                        <td colspan="5" class="empty-table">
                                            <i class="fas fa-inbox"></i>
                                            <span>Nenhuma saída de contrato neste mês</span>
                                        </td>
                                    </tr>
                                <?php else: ?>
                                    <?php foreach ($contratos_sairam as $contrato): ?>
                                        <tr>
                                            <td><?= htmlspecialchars($contrato['empresa']) ?></td>
                                            <td><span class="badge <?= strtolower($contrato['tributacao']) ?>"><?= strtoupper(substr($contrato['tributacao'], 0, 2)) ?></span></td>
                                            <td><?= htmlspecialchars($contrato['data_contrato_formatada']) ?></td>
                                            <td><?= htmlspecialchars($contrato['data_saida_formatada']) ?></td>
                                        </tr>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="expandable-section animate__animated animate__fadeInRight">
                <div class="section-header">
                    <div class="section-title">
                        <i class="fas fa-calendar-plus"></i>
                        <div>
                            <h3>Novas Obrigações Futuras <span class="badge-count"><?= $total_obrigacoes_futuras ?></span></h3>
                            <p>Empresas que terão obrigações nos próximos meses</p>
                        </div>
                    </div>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="section-content">
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th><i class="fas fa-building"></i> Empresa</th>
                                    <th><i class="fas fa-tag"></i> Tributação</th>
                                    <th><i class="fas fa-calendar-day"></i> Data Obrigação</th>
                                    <th><i class="fas fa-clock"></i> Dias Restantes</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php
                                $sql_obrigacoes_futuras = "
                                    SELECT 
                                        empresa,
                                        tributacao,
                                        DATE_FORMAT(proxima_obrigacao, '%d/%m/%Y') as data_obrigacao_formatada,
                                        DATEDIFF(proxima_obrigacao, CURDATE()) as dias_restantes
                                    FROM (
                                        SELECT 
                                            codigo,
                                            MIN(data_obrigacao) as proxima_obrigacao,
                                            MIN(empresa) as empresa,
                                            MIN(tributacao) as tributacao
                                        FROM controle_fechamento
                                        WHERE data_obrigacao > CURDATE()
                                        GROUP BY codigo
                                    ) as futuras
                                    ORDER BY proxima_obrigacao ASC
                                    LIMIT 10
                                ";


                                $result_obrigacoes = $conexao->query($sql_obrigacoes_futuras);
                                $obrigacoes_futuras = $result_obrigacoes ? $result_obrigacoes->fetch_all(MYSQLI_ASSOC) : [];
                                $total_obrigacoes_futuras = count($obrigacoes_futuras);
                                if (empty($obrigacoes_futuras)): ?>
                                    <tr>
                                        <td colspan="4" class="empty-table">
                                            <i class="fas fa-inbox"></i>
                                            <span>Nenhuma obrigação futura encontrada</span>
                                        </td>
                                    </tr>
                                <?php else: ?>
                                    <?php foreach ($obrigacoes_futuras as $obrigacao):
                                        $dias_restantes = (int)$obrigacao['dias_restantes'];
                                        $status_class = $dias_restantes <= 7 ? 'danger' : ($dias_restantes <= 30 ? 'warning' : 'success');
                                    ?>
                                        <tr>
                                            <td><?= htmlspecialchars($obrigacao['empresa']) ?></td>
                                            <td><span class="badge <?= strtolower($obrigacao['tributacao']) ?>"><?= strtoupper(substr($obrigacao['tributacao'], 0, 2)) ?></span></td>
                                            <td><?= htmlspecialchars($obrigacao['data_obrigacao_formatada']) ?></td>
                                            <td><span class="badge <?= $status_class ?>"><?= $dias_restantes ?> dias</span></td>
                                        </tr>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                    <div class="section-footer">
                        <a class="btn2" href="obrigacoes_futuras.php">
                            <i class="fas fa-list"></i> Ver Todas
                        </a>
                    </div>
                </div>
            </div>

            <div class="expandable-section animate__animated animate__fadeInRight" style="animation-delay: 0.1s">
                <div class="section-header">
                    <div class="section-title">
                        <i class="fas fa-calendar-minus"></i>
                        <div>
                            <h3>Empresas que Sairão <span class="badge-count"><?= $total_empresas_saindo ?></span></h3>
                            <p>Empresas com data de saída programada</p>
                        </div>
                    </div>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
                <div class="section-content">
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th><i class="fas fa-building"></i> Empresa</th>
                                    <th><i class="fas fa-tag"></i> Tributação</th>
                                    <th><i class="fas fa-calendar-day"></i> Data Saída</th>
                                    <th><i class="fas fa-clock"></i> Dias Restantes</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php
                                $sql_empresas_saindo = "
                                    SELECT 
                                        empresa,
                                        tributacao,
                                        DATE_FORMAT(data_saida, '%d/%m/%Y') as data_saida_formatada,
                                        DATEDIFF(data_saida, CURDATE()) as dias_restantes
                                    FROM (
                                        SELECT 
                                            codigo,
                                            MIN(data_saida) as data_saida,
                                            MIN(empresa) as empresa,
                                            MIN(tributacao) as tributacao
                                        FROM controle_fechamento
                                        WHERE data_saida > CURDATE()
                                        GROUP BY codigo
                                    ) as saindo
                                    ORDER BY data_saida ASC
                                    LIMIT 10
                                ";

                                $result_saindo = $conexao->query($sql_empresas_saindo);
                                $empresas_saindo = $result_saindo ? $result_saindo->fetch_all(MYSQLI_ASSOC) : [];
                                $total_empresas_saindo = count($empresas_saindo);


                                if (empty($empresas_saindo)): ?>
                                    <tr>
                                        <td colspan="4" class="empty-table">
                                            <i class="fas fa-inbox"></i>
                                            <span>Nenhuma empresa com saída programada</span>
                                        </td>
                                    </tr>
                                <?php else: ?>
                                    <?php foreach ($empresas_saindo as $empresa):
                                        $dias_restantes = (int)$empresa['dias_restantes'];
                                        $status_class = $dias_restantes <= 7 ? 'danger' : ($dias_restantes <= 30 ? 'warning' : 'success');
                                    ?>
                                        <tr>
                                            <td><?= htmlspecialchars($empresa['empresa']) ?></td>
                                            <td><span class="badge <?= strtolower($empresa['tributacao']) ?>"><?= strtoupper(substr($empresa['tributacao'], 0, 2)) ?></span></td>
                                            <td><?= htmlspecialchars($empresa['data_saida_formatada']) ?></td>
                                            <td><span class="badge <?= $status_class ?>"><?= $dias_restantes ?> dias</span></td>
                                        </tr>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                    <div class="section-footer">
                        <a class="btn2" href="empresas_saindo.php">
                            <i class="fas fa-list"></i> Ver Todas
                        </a>
                    </div>
                </div>
            </div>
            <div class="right-column">
                <div class="expandable-section animate__animated animate__fadeInRight" style="animation-delay: 0.3s">
                    <div class="section-header">
                        <div class="section-title">
                            <i class="fas fa-calendar-alt"></i>
                            <div>
                                <h3>Gerenciamento de Meses</h3>
                                <p>Crie, bloqueie ou libere períodos para edição</p>
                            </div>
                        </div>
                        <i class="fas fa-chevron-down toggle-icon"></i>
                    </div>
                    <div class="section-content">

                        <div style="padding-bottom: 1.5rem; border-bottom: 1px solid var(--border-color); margin-bottom: 1.5rem;">
                            <a href="gerenciar_meses.php" class="btn" style="width: 100%; text-align: center;">
                                <i class="fas fa-cogs"></i> Replicação Manual de Mês
                            </a>
                            <p style="text-align: center; font-size: 0.85rem; color: var(--text-muted); margin-top: 0.75rem;">
                                Crie um novo mês copiando empresas selecionadas de um período anterior.
                            </p>
                        </div>

                        <div class="table-responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Mês/Ano</th>
                                        <th>Status da Edição</th>
                                        <th>Ação</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php foreach ($meses_disponiveis as $mes): ?>
                                        <tr>
                                            <td><?= htmlspecialchars($meses_pt[$mes['mes']]) . '/' . $mes['ano'] ?></td>
                                            <td>
                                                <span class="status-badge <?= $mes['edicao_status'] == 'liberada' ? 'success' : 'danger' ?>">
                                                    <?= ucfirst($mes['edicao_status']) ?>
                                                </span>
                                            </td>
                                            <td>
                                                <form method="POST" style="margin: 0;">
                                                    <input type="hidden" name="mes_id" value="<?= $mes['id'] ?>">
                                                    <?php if ($mes['edicao_status'] == 'liberada'): ?>
                                                        <input type="hidden" name="novo_status_edicao" value="bloqueada">
                                                        <button type="submit" name="mudar_edicao_status" class="btn small-btn" style="background: var(--error-color);">
                                                            <i class="fas fa-lock"></i> Bloquear
                                                        </button>
                                                    <?php else: ?>
                                                        <input type="hidden" name="novo_status_edicao" value="liberada">
                                                        <button type="submit" name="mudar_edicao_status" class="btn small-btn" style="background: var(--success-color);">
                                                            <i class="fas fa-lock-open"></i> Liberar
                                                        </button>
                                                    <?php endif; ?>
                                                </form>
                                            </td>
                                        </tr>
                                    <?php endforeach; ?>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            <div class="expandable-section animate__animated animate__fadeInRight" style="animation-delay: 0.2s">
                <div class="section-header">
                    <div class="section-title">
                        <i class="fas fa-users-cog"></i>
                        <div>
                            <h3>Gerenciar Funcionários</h3>
                            <p>Adicionar, editar e remover usuários do sistema</p>
                        </div>
                    </div>
                </div>
                <div class="section-content active" style="padding-top: 20px;">
                    <a href="gerenciar_funcionarios.php" class="btn" style="width: 100%; text-align: center;">
                        <i class="fas fa-arrow-right"></i> Acessar Gestão de Funcionários
                    </a>
                </div>
            </div>
            <a href="delegar_tarefas.php" class="btn2 animate__animated animate__fadeInUp" style="text-decoration: none; animation-delay: 0.3s">
                <i class="fas fa-tasks"></i> Delegar Tarefas
            </a>
        </div>
    </main>

    <div class="edit-modal" id="editFuncionarioModal">
        <div class="edit-modal-content animate__animated animate__zoomIn">
            <div class="edit-modal-header">
                <h3 class="edit-modal-title"><i class="fas fa-user-edit"></i> Editar Funcionário</h3>
                <button class="edit-modal-close">&times;</button>
            </div>
            <form id="editFuncionarioForm" method="POST">
                <input type="hidden" name="id" id="edit-funcionario-id">

                <div class="edit-form-group">
                    <label for="edit-nome-completo"><i class="fas fa-user"></i> Nome Completo</label>
                    <input type="text" id="edit-nome-completo" name="nome_completo" required>
                </div>

                <div class="edit-form-group">
                    <label for="edit-usuario"><i class="fas fa-user-tag"></i> Usuário</label>
                    <input type="text" id="edit-usuario" name="usuario" required>
                </div>

                <div class="edit-form-group">
                    <label for="edit-tipo-conta"><i class="fas fa-user-shield"></i> Tipo de Conta</label>
                    <select id="edit-tipo-conta" name="tipo_conta" required>
                        <option value="">Selecione o tipo de conta</option>
                        <option value="fiscal">Fiscal</option>
                        <option value="dp">Departamento Pessoal</option>
                        <option value="cadastro">Cadastro</option>
                        <option value="contabil">Contábil</option>
                    </select>
                </div>

                <div class="edit-form-group">
                    <label for="edit-senha"><i class="fas fa-lock"></i> Nova Senha (opcional)</label>
                    <input type="password" id="edit-senha" name="senha">
                    <p class="edit-form-note">Deixe em branco para manter a senha atual</p>
                </div>

                <div class="edit-form-actions">
                    <button type="button" class="btn cancel-btn edit-modal-close">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button type="submit" name="editar_funcionario" class="btn">
                        <i class="fas fa-save"></i> Salvar Alterações
                    </button>
                </div>
            </form>

            <?php if (isset($erro_edicao)): ?>
                <div class="alert alert-error animate__animated animate__shakeX">
                    <i class="fas fa-exclamation-circle"></i> <?= $erro_edicao ?>
                </div>
            <?php endif; ?>

            <?php if (isset($sucesso_edicao)): ?>
                <div class="alert alert-success animate__animated animate__fadeIn">
                    <i class="fas fa-check-circle"></i> <?= $sucesso_edicao ?>
                </div>
            <?php endif; ?>
        </div>
    </div>

    <div class="modal" id="empresasModal">
        <div class="modal-content animate__animated animate__zoomIn">
            <div class="modal-header">
                <h3 id="modalTitulo"><i class="fas fa-building"></i> Empresas</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body" id="modalEmpresasBody">
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <p>Carregando informações...</p>
                </div>
            </div>
        </div>
    </div>

    <div id="editarModal" class="modal">
        <div class="modal-content">
            <span class="close-modal">&times;</span>
            <h2><i class="fas fa-edit"></i> Editar Funcionário</h2>

            <?php if (isset($erro_edicao)): ?>
                <div class="alert alert-error animate__animated animate__shakeX">
                    <i class="fas fa-exclamation-circle"></i> <?= $erro_edicao ?>
                </div>
            <?php endif; ?>

            <?php if (isset($sucesso_edicao)): ?>
                <div class="alert alert-success animate__animated animate__fadeIn">
                    <i class="fas fa-check-circle"></i> <?= $sucesso_edicao ?>
                </div>
            <?php endif; ?>

            <form method="POST">
                <input type="hidden" name="id" id="edit-id">
                <div class="form-group">
                    <label><i class="fas fa-user"></i> Nome Completo</label>
                    <input type="text" name="nome_completo" id="edit-nome" required>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-user-tag"></i> Usuário</label>
                    <input type="text" name="usuario" id="edit-usuario" required>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-lock"></i> Nova Senha (opcional)</label>
                    <input type="password" name="senha" placeholder="Deixe em branco para manter a atual">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-user-shield"></i> Tipo de Conta</label>
                    <select name="tipo_conta" id="edit-tipo" required>
                        <option value="fiscal">Fiscal</option>
                        <option value="dp">Departamento Pessoal</option>
                        <option value="cadastro">Cadastro</option>
                        <option value="contabil">Contábil</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <button type="submit" name="editar_funcionario" class="btn">
                    <i class="fas fa-save"></i> Atualizar Funcionário
                </button>
            </form>
        </div>
    </div>
    <div class="confirmation-modal">
        <div class="modal-content animate__animated animate__zoomIn">
            <div class="modal-header">
                <h3><i class="fas fa-sign-out-alt"></i> Confirmar Saída</h3>
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
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script>
        $('.category-item').click(function(e) {
            e.preventDefault();
            e.stopPropagation();

            const categoria = $(this).data('tributacao-db');

            const mesId = <?= $id_mes_atual ?: 'null' ?>;

            if (!mesId) {
                alert('Nenhum mês selecionado ou aberto!');
                return;
            }

            const modalTitle = $(this).find('.category-title').text();
            $('#modalTitulo').text(`Empresas - ${modalTitle} (${$('#current-month').text()})`);

            $('#empresasModal').fadeIn();
            $('#modalEmpresasBody').html(`
        <div style="display: flex; justify-content: center; align-items: center; height: 200px;">
            <div style="text-align: center;">
                <div class="loading-spinner"></div>
                <p>Carregando empresas...</p>
            </div>
        </div>
    `);

            $('.months-list').removeClass('show');

            $.ajax({
                url: 'obter_empresas_tributacao.php',
                method: 'GET',
                data: {
                    mes_id: mesId,
                    tributacao: categoria // AGORA ENVIA O VALOR CORRETO!
                },
                dataType: 'json',
                success: function(data) {
                    const modalBody = $('#modalEmpresasBody');
                    if (data.success && data.empresas && data.empresas.length > 0) {
                        let html = `
                <div class="table-responsive">
                    <table class="table-hover">
                        <thead>
                            <tr>
                                <th>Empresa</th>
                                <th>Data Contrato</th>
                                <th>Data Obrigação</th>
                            </tr>
                        </thead>
                        <tbody>`;

                        data.empresas.forEach(empresa => {
                            html += `
                    <tr>
                        <td>${empresa.empresa || 'N/A'}</td>
                        <td>${empresa.data_contrato || 'N/A'}</td>
                        <td>${empresa.data_obrigacao || 'N/A'}</td>
                    </tr>`;
                        });

                        html += `</tbody></table></div>`;
                        modalBody.html(html);
                    } else {
                        modalBody.html(`
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-info-circle" style="font-size: 2rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                    <p>Nenhuma empresa encontrada para esta categoria.</p>
                </div>
                `);
                    }
                },
                error: function(xhr, status, error) {
                    $('#modalEmpresasBody').html(`
            <div style="text-align: center; padding: 40px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; color: var(--error-color); margin-bottom: 1rem;"></i>
                <p>Erro ao carregar dados. Por favor, tente novamente.</p>
                <button class="btn small-btn" onclick="location.reload()">Recarregar</button>
            </div>
            `);
                }
            });
        });

        $(document).on('click', function(e) {
            if ($(e.target).closest('#empresasModal .modal-content').length === 0 &&
                $(e.target).closest('.category-item').length === 0) {
                $('#empresasModal').fadeOut();
            }
        });

        $('#empresasModal .modal-close').click(function() {
            $('#empresasModal').fadeOut();
        });
    </script>
    <script>
        let modoProgresso = 'campo';

        $('#toggle-progresso').on('click', function() {
            modoProgresso = modoProgresso === 'campo' ? 'empresa' : 'campo';

            $('.progress-item').each(function() {
                const percentSpan = $(this).find('.progress-label span:last-child');
                const fillBar = $(this).find('.progress-fill');
                const infoSmall = $(this).find('.progress-info');
                const totalEmpresas = infoSmall.data('info-empresa');
                const totalCampos = infoSmall.data('info-campo');

                if (modoProgresso === 'campo') {
                    percentSpan.text(percentSpan.data('progresso-campo'));
                    fillBar.css('width', percentSpan.data('progresso-campo'));
                    infoSmall.text(infoSmall.data('info-campo') + ' preenchidos'); // Atualiza a contagem
                } else {
                    percentSpan.text(percentSpan.data('progresso-empresa'));
                    fillBar.css('width', percentSpan.data('progresso-empresa'));
                    infoSmall.text(infoSmall.data('info-empresa') + ' completas'); // Atualiza a contagem
                }
            });

            $(this).find('i').toggleClass('fa-toggle-on fa-toggle-off');
        });
    </script>
    <script>
        // ✅ SUBSTITUA O SCRIPT ANTIGO POR ESTE
        $('.category-item').click(function(e) {
            e.preventDefault();
            e.stopPropagation();

            const categoria = $(this).data('tributacao-db');

            // Pega o ID do mês que está sendo exibido no painel
            const mesId = <?= $id_mes_atual ?: 'null' ?>;

            if (!mesId) {
                alert('Nenhum mês selecionado ou aberto!');
                return;
            }

            const modalTitle = $(this).find('.category-title').text();
            $('#modalTitulo').text(`Empresas - ${modalTitle} (${$('#current-month').text().trim()})`);
            $('#empresasModal').fadeIn();
            $('#modalEmpresasBody').html('<div class="loading-content"><div class="loading-spinner"></div><p>Carregando empresas...</p></div>');

            $.ajax({
                url: 'obter_empresas_tributacao.php',
                method: 'GET',
                data: {
                    mes_id: mesId,
                    tributacao: categoria
                },
                dataType: 'json',
                success: function(data) {
                    const modalBody = $('#modalEmpresasBody');
                    if (data.success && data.empresas && data.empresas.length > 0) {
                        let html = `
                <div class="table-responsive">
                    <table class="table-hover">
                        <thead>
                            <tr><th>Empresa</th><th>Data Contrato</th><th>Data Obrigação</th></tr>
                        </thead>
                        <tbody>`;
                        data.empresas.forEach(empresa => {
                            html += `<tr>
                                <td>${empresa.empresa || 'N/A'}</td>
                                <td>${empresa.data_contrato || 'N/A'}</td>
                                <td>${empresa.data_obrigacao || 'N/A'}</td>
                             </tr>`;
                        });
                        html += `</tbody></table></div>`;
                        modalBody.html(html);
                    } else {
                        modalBody.html('<div class="empty-message"><i class="fas fa-info-circle"></i><p>Nenhuma empresa encontrada para esta categoria.</p></div>');
                    }
                },
                error: function() {
                    modalBody.html('<div class="empty-message error"><i class="fas fa-exclamation-triangle"></i><p>Erro ao carregar dados.</p></div>');
                }
            });
        });
        $('.modal-close').click(function() {
            $('#empresasModal').fadeOut();
        });

        $(document).mouseup(function(e) {
            const modal = $('#empresasModal');
            if (!modal.is(e.target) && modal.has(e.target).length === 0) {
                modal.fadeOut();
            }
        });

        $('.notifications-btn').click(function() {
            $('.notifications-nav').toggleClass('active');
        });

        $('#show-months').click(function(e) {
            e.stopPropagation();
            $('.months-list').toggleClass('show');
        });

        $(document).click(function() {
            $('.months-list').removeClass('show');
        });

        $('.month-option').click(function(e) {
            e.preventDefault();

            const mesId = $(this).data('mes-id');
            const mesTexto = $(this).text().trim();

            // 1. ATUALIZA O NOME DO MÊS NA TELA
            $('span#current-month, span#current-month-progress').text(mesTexto);

            $('.category-value, #count-total, #count-funcionarios').text('...');
            $('.progress-fill').css('width', '0%');
            $('.progress-label span:last-child').text('0.00%');
            $('.progress-info').text('Carregando...');
            // Tabelas
            $('.expandable-section tbody').html('<tr><td colspan="5" class="empty-table"><span>Carregando...</span></td></tr>');

            $.ajax({
                url: 'obter_dados_mes.php', // Usaremos um novo arquivo PHP que retorna TUDO
                method: 'GET',
                data: {
                    mes_id: mesId
                },
                dataType: 'json',
                success: function(data) {
                    if (data.success) {

                        const contadores = {
                            simplesnacional: data.contadores.simplesnacional,
                            lucropresumido: data.contadores.lucropresumido,
                            lucrorealtrimestral: data.contadores.lucrorealtrimestral,
                            lucrorealestimativa: data.contadores.lucrorealestimativa,
                            lucrorealanual: data.contadores.lucrorealanual,
                            imuneirpj: data.contadores.imuneirpj,
                            condomínios: data.contadores.condominios,
                            doméstica: data.contadores.domestica,
                            associações: data.contadores.associacoes,
                            mei: data.contadores.mei,
                            pessoafsica: data.contadores.pessoafsica,
                        };

                        $('.category-item').each(function() {
                            let tributacao = $(this).find('.category-title').text().replace(/ /g, '').toLowerCase();
                            // Ajuste para nomes compostos
                            if (tributacao === 'lucroreal/trimestral') tributacao = 'lucrorealtrimestral';
                            if (tributacao === 'lucroreal/estimativa') tributacao = 'lucrorealestimativa';
                            if (tributacao === 'lucroreal/anual') tributacao = 'lucrorealanual';
                            if (tributacao === 'imuneirpj') tributacao = 'imuneirpj';
                            if (tributacao === 'simplesnacional') tributacao = 'simplesnacional';
                            if (tributacao === 'pessoafísica') tributacao = 'pessoafsica';

                            const valor = contadores[tributacao] || 0;
                            $(this).find('.category-value').text(valor);
                        });

                        $('#count-total').text(data.contadores.total || 0);
                        $('#count-funcionarios').text(new Intl.NumberFormat('pt-BR').format(data.contadores.total_funcionarios || 0));

                        const atualizarBarra = (setor, dados) => {
                            const percentSpan = $(`#progresso-${setor}-percent`);
                            const infoSmall = $(`#progresso-${setor}-info`);
                            const fillBar = $(`#progresso-${setor}-bar`);

                            percentSpan.data('progresso-campo', dados.progresso_por_campo.toFixed(2) + '%');
                            percentSpan.data('progresso-empresa', dados.progresso_por_empresa.toFixed(2) + '%');
                            infoSmall.data('info-campo', `${dados.campos_preenchidos} de ${dados.total_campos} campos`);
                            infoSmall.data('info-empresa', `${dados.empresas_completas} de ${dados.total_empresas} empresas`);

                            if (modoProgresso === 'campo') {
                                percentSpan.text(dados.progresso_por_campo.toFixed(2) + '%');
                                fillBar.css('width', dados.progresso_por_campo + '%');
                                infoSmall.text(`${dados.campos_preenchidos} de ${dados.total_campos} campos`);
                            } else {
                                percentSpan.text(dados.progresso_por_empresa.toFixed(2) + '%');
                                fillBar.css('width', dados.progresso_por_empresa + '%');
                                infoSmall.text(`${dados.empresas_completas} de ${dados.total_empresas} empresas`);
                            }
                        };

                        atualizarBarra('dp', data.progresso_dp);
                        atualizarBarra('fiscal', data.progresso_fiscal);
                        atualizarBarra('contabil', data.progresso_contabil);
                        atualizarBarra('cushman', data.progresso_cushman);

                        const atualizarTabela = (seletor, lista, tipo) => {
                            const tbody = $(seletor);
                            tbody.empty();
                            if (lista && lista.length > 0) {
                                lista.forEach(item => {
                                    let linha = `<tr>
                                <td>${item.empresa}</td>
                                <td><span class="badge ${item.tributacao.toLowerCase()}">${item.tributacao.substring(0, 2).toUpperCase()}</span></td>
                                <td>${item.data_contrato_formatada}</td>`;
                                    if (tipo === 'novos') {
                                        linha += `<td>${item.data_obrigacao_formatada}</td>`;
                                    }
                                    linha += `<td>${item.data_saida_formatada}</td></tr>`;
                                    tbody.append(linha);
                                });
                            } else {
                                const colspan = (tipo === 'novos') ? 5 : 4;
                                tbody.append(`<tr><td colspan="${colspan}" class="empty-table"><i class="fas fa-inbox"></i><span>Nenhum registro encontrado</span></td></tr>`);
                            }
                        };

                        atualizarTabela('.expandable-section:contains("Novos Contratos") tbody', data.novos_contratos, 'novos');
                        atualizarTabela('.expandable-section:contains("Contratos Encerrados") tbody', data.contratos_sairam, 'encerrados');

                    } else {
                        alert('Erro ao carregar dados: ' + data.message);
                    }
                },
                error: function(xhr, status, error) {
                    console.error("Erro AJAX: ", status, error);
                    alert('Erro de comunicação. Verifique o console para mais detalhes.');
                },
                complete: function() {
                    $('.months-list').removeClass('show');
                }
            });
        });

        $('.section-header').click(function() {
            $(this).siblings('.section-content').toggleClass('active');
            $(this).find('i').toggleClass('fa-chevron-down fa-chevron-up');
        });

        $('#logout-btn').click(function(e) {
            e.preventDefault();
            $('.confirmation-modal').fadeIn();
        });

        $('.cancel-btn').click(function() {
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

        $('.edit-funcionario-btn').click(function() {
            const id = $(this).data('id');
            const nome = $(this).data('nome');
            const usuario = $(this).data('usuario');
            const tipo = $(this).data('tipo');

            $('#edit-funcionario-id').val(id);
            $('#edit-nome-completo').val(nome);
            $('#edit-usuario').val(usuario);
            $('#edit-tipo-conta').val(tipo);
            $('#edit-senha').val('');

            $('#editFuncionarioModal').fadeIn();
        });

        $('.edit-modal-close').click(function() {
            $('#editFuncionarioModal').fadeOut();
        });

        $(document).mouseup(function(e) {
            const modal = $('#editFuncionarioModal');
            if (!modal.is(e.target) && modal.has(e.target).length === 0) {
                modal.fadeOut();
            }
        });

        <?php if (isset($sucesso_edicao)): ?>
            setTimeout(function() {
                $('#editFuncionarioModal').fadeOut();
            }, 2000);
        <?php endif; ?>



        $(document).ready(function() {
            const mesAtualTexto = '<?= $meses_pt[date('n')] ?> ' + '<?= date('Y') ?>';
            const mesOption = $('.month-option').filter(function() {
                return $(this).text() === mesAtualTexto;
            });

            if (mesOption.length > 0) {
                mesOption.click();
            } else {
                console.log('Mês atual não encontrado na lista de meses disponíveis');
            }
        });
    </script>
    <script>
        document.addEventListener("DOMContentLoaded", function() {
            const editButtons = document.querySelectorAll(".edit-btn");
            const modal = document.getElementById("editarModal");
            const closeModal = modal.querySelector(".close-modal");

            editButtons.forEach(btn => {
                btn.addEventListener("click", function() {
                    const id = this.dataset.id;
                    const nome = this.dataset.nome;
                    const usuario = this.dataset.usuario;
                    const tipo = this.dataset.tipo;

                    document.getElementById("edit-id").value = id;
                    document.getElementById("edit-nome").value = nome;
                    document.getElementById("edit-usuario").value = usuario;
                    document.getElementById("edit-tipo").value = tipo;

                    modal.style.display = "block";
                });
            });

            closeModal.addEventListener("click", function() {
                modal.style.display = "none";
            });

            window.addEventListener("click", function(e) {
                if (e.target == modal) {
                    modal.style.display = "none";
                }
            });
        });
    </script>
    <script src="scripts_globais.js"></script>

</body>

</html>