<?php
date_default_timezone_set('America/Sao_Paulo');

ini_set('display_errors', 1);
error_reporting(E_ALL);
require 'assets/backend/config.php';
session_start();

$usuario_id = $_SESSION['usuario_id'] ?? 0;
$tipo_conta = $_SESSION['tipo_conta'] ?? '';
$area_lider = '';
$nome_arquivo_atual = basename($_SERVER['PHP_SELF']);

// 1. Lógica original para determinar a área padrão
if (strpos($tipo_conta, 'lider_') === 0) {
    $area_lider = str_replace('lider_', '', $tipo_conta);
} else if ($tipo_conta !== 'admin') {
    header('Location: dashboard.php');
    exit();
}

if ($tipo_conta === 'admin' && isset($_GET['area']) && !empty($_GET['area'])) {
    // Usamos FILTER_UNSAFE_RAW para remover o erro Deprecated.
    $setor_solicitado = filter_var($_GET['area'], FILTER_UNSAFE_RAW);

    $setores_validos = ['fiscal', 'dp', 'contabil', 'cushman'];

    if (in_array($setor_solicitado, $setores_validos)) {
        $area_lider = $setor_solicitado;
    }
}

// 3. Define um valor padrão para admins se não houver parâmetro ou área padrão (fallback)
if ($tipo_conta === 'admin' && empty($area_lider)) {
    $area_lider = 'fiscal';
}
// --- ADICIONE ESTE BLOCO ---
// LÓGICA PARA OBTER E SELECIONAR O MÊS
function obterMesesDisponiveis($conexao)
{
    $query = "SELECT id, mes, ano FROM controle_meses ORDER BY ano DESC, mes DESC";
    $resultado = $conexao->query($query);
    return $resultado ? $resultado->fetch_all(MYSQLI_ASSOC) : [];
}
$meses_disponiveis = obterMesesDisponiveis($conexao);
// Pega o 'mes_id' da URL, ou usa o primeiro da lista (o mais recente) como padrão
$mes_selecionado_id = isset($_GET['mes_id']) ? (int)$_GET['mes_id'] : ($meses_disponiveis[0]['id'] ?? null);
// [INÍCIO DA 1ª CORREÇÃO] - Buscar detalhes do mês selecionado
$info_mes_selecionado = null;
if ($mes_selecionado_id) {
    $stmt_mes_info = $conexao->prepare("SELECT mes, ano FROM controle_meses WHERE id = ?");
    $stmt_mes_info->bind_param('i', $mes_selecionado_id);
    $stmt_mes_info->execute();
    $info_mes_selecionado = $stmt_mes_info->get_result()->fetch_assoc();
    $stmt_mes_info->close();
}
// [FIM DA 1ª CORREÇÃO]
// --- FIM DO BLOCO ---
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delegar_em_massa'])) {
    header('Content-Type: application/json');
    $empresas_selecionadas = $_POST['empresas_selecionadas'] ?? [];
    $usuarios_selecionados = $_POST['usuarios_selecionados'] ?? [];
    $tipo_tarefa_massa = $_POST['tipo_tarefa'] ?? $area_lider;
    $id_mes_delegacao = $_POST['id_mes_selecionado'] ?? null;

    if (empty($empresas_selecionadas) || empty($usuarios_selecionados) || empty($tipo_tarefa_massa) || !$id_mes_delegacao) {
        echo json_encode(['success' => false, 'message' => 'Seleção inválida. Escolha empresas, responsáveis e um mês válido.']);
        exit();
    }

    $conexao->begin_transaction();
    try {
        // Prepara a query para DELETAR as delegações antigas
        $sql_delete = "DELETE FROM responsaveis_empresa WHERE id_empresa = ? AND id_mes = ? AND tipo_tarefa = ?";
        $stmt_delete = $conexao->prepare($sql_delete);

        // Prepara a query para INSERIR as novas delegações
        $sql_insert = "INSERT INTO responsaveis_empresa (id_empresa, id_usuario, id_mes, tipo_tarefa) VALUES (?, ?, ?, ?)";
        $stmt_insert = $conexao->prepare($sql_insert);

        $total_alteracoes = 0;

        foreach ($empresas_selecionadas as $id_empresa) {
            // 1. Limpa as delegações antigas para esta empresa, neste mês e para este tipo de tarefa
            $stmt_delete->bind_param('iis', $id_empresa, $id_mes_delegacao, $tipo_tarefa_massa);
            $stmt_delete->execute();

            // 2. Insere as novas delegações
            foreach ($usuarios_selecionados as $id_usuario) {
                $stmt_insert->bind_param('iiis', $id_empresa, $id_usuario, $id_mes_delegacao, $tipo_tarefa_massa);
                $stmt_insert->execute();
                if ($stmt_insert->affected_rows > 0) {
                    $total_alteracoes++;
                }
            }
        }

        $stmt_delete->close();
        $stmt_insert->close();
        $conexao->commit();

        $message = "Delegação em massa concluída com sucesso. " . count($empresas_selecionadas) . " empresa(s) atualizada(s).";
        echo json_encode(['success' => true, 'message' => $message]);
    } catch (Exception $e) {
        $conexao->rollback();
        echo json_encode(['success' => false, 'message' => 'Ocorreu um erro no banco de dados: ' . $e->getMessage()]);
    }
    exit();
}
// ADICIONADO: Nova estrutura de dados para o log de acesso organizado
$equipe_logs = [];

if ($area_lider) {
    // 1. Primeiro, pega todos os usuários do setor
    $lider_conta = 'lider_' . $area_lider;
    $sql_equipe_logs = "SELECT id, nome FROM usuarios WHERE tipo_conta = ? OR tipo_conta = ?";
    $stmt_equipe_logs = $conexao->prepare($sql_equipe_logs);
    $stmt_equipe_logs->bind_param('ss', $area_lider, $lider_conta);
    $stmt_equipe_logs->execute();
    $usuarios_equipe = $stmt_equipe_logs->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt_equipe_logs->close();

    // 2. Para cada usuário, busca suas estatísticas e logs individuais
    $sql_logs_usuario = "
        SELECT 
            data_login, data_logout, ultima_atividade, duracao_sessao_horas, ip_acesso,
            CASE 
                WHEN data_logout IS NULL AND ultima_atividade >= NOW() - INTERVAL 10 MINUTE THEN 'Online'
                ELSE 'Offline'
            END AS status
        FROM logs_acesso
        WHERE id_usuario = ?
        ORDER BY data_login DESC
        LIMIT 50 -- Limita para não sobrecarregar
    ";
    $stmt_logs_usuario = $conexao->prepare($sql_logs_usuario);

    foreach ($usuarios_equipe as $usuario) {
        $stmt_logs_usuario->bind_param('i', $usuario['id']);
        $stmt_logs_usuario->execute();
        $logs = $stmt_logs_usuario->get_result()->fetch_all(MYSQLI_ASSOC);

        // Calcula KPIs (Indicadores Chave de Desempenho)
        $total_horas = 0;
        $ultima_atividade = null;
        $status_atual = 'Offline';

        if (!empty($logs)) {
            $total_horas = array_sum(array_column($logs, 'duracao_sessao_horas'));
            $ultima_atividade = $logs[0]['ultima_atividade']; // O primeiro é o mais recente
            if ($logs[0]['status'] === 'Online') {
                $status_atual = 'Online';
            }
        }

        $equipe_logs[] = [
            'id' => $usuario['id'],
            'nome' => $usuario['nome'],
            'status' => $status_atual,
            'total_horas' => $total_horas,
            'ultima_atividade' => $ultima_atividade,
            'logs' => $logs
        ];
    }
    $stmt_logs_usuario->close();
}

$equipe_alteracoes = [];
if ($area_lider && $mes_selecionado_id) {

    /*
     * Usuários que devem aparecer nos Logs de Alterações:
     * 1. membros normais da área (fiscal, dp, contabil, cushman);
     * 2. líder da área;
     * 3. administradores que possuam pelo menos uma empresa atribuída
     *    no mês e na área que está sendo visualizada.
     *
     * Assim não exibimos todos os admins indiscriminadamente, somente
     * aqueles que realmente fazem parte da operação daquela carteira.
     */
    $lider_conta_logs = 'lider_' . $area_lider;

    $sql_usuarios_alteracoes = "
        SELECT DISTINCT
            u.id,
            u.nome,
            u.tipo_conta
        FROM usuarios u
        LEFT JOIN responsaveis_empresa re
            ON re.id_usuario = u.id
            AND re.id_mes = ?
            AND re.tipo_tarefa = ?
        WHERE
            u.tipo_conta = ?
            OR u.tipo_conta = ?
            OR (
                u.tipo_conta = 'admin'
                AND re.id IS NOT NULL
            )
        ORDER BY u.nome ASC
    ";

    $stmt_usuarios_alteracoes = $conexao->prepare($sql_usuarios_alteracoes);
    $stmt_usuarios_alteracoes->bind_param(
        'isss',
        $mes_selecionado_id,
        $area_lider,
        $area_lider,
        $lider_conta_logs
    );
    $stmt_usuarios_alteracoes->execute();
    $usuarios_alteracoes = $stmt_usuarios_alteracoes
        ->get_result()
        ->fetch_all(MYSQLI_ASSOC);
    $stmt_usuarios_alteracoes->close();

    $sql_alteracoes_usuario = "
        SELECT
            id,
            id_usuario,
            nome_usuario,
            tipo_conta,
            acao,
            nome_empresa,
            id_registro_afetado,
            coluna_afetada,
            valor_antigo,
            valor_novo,
            data_hora,
            ip_usuario
        FROM logs
        WHERE id_usuario = ?
        ORDER BY data_hora DESC
    ";

    $stmt_alteracoes_usuario = $conexao->prepare($sql_alteracoes_usuario);

    foreach ($usuarios_alteracoes as $usuario) {
        $stmt_alteracoes_usuario->bind_param('i', $usuario['id']);
        $stmt_alteracoes_usuario->execute();
        $alteracoes = $stmt_alteracoes_usuario
            ->get_result()
            ->fetch_all(MYSQLI_ASSOC);

        $total_alteracoes = count($alteracoes);
        $ultima_alteracao = $alteracoes[0]['data_hora'] ?? null;

        $equipe_alteracoes[] = [
            'id' => $usuario['id'],
            'nome' => $usuario['nome'],
            'tipo_conta' => $usuario['tipo_conta'],
            'total_alteracoes' => $total_alteracoes,
            'ultima_alteracao' => $ultima_alteracao,
            'alteracoes' => $alteracoes
        ];
    }

    $stmt_alteracoes_usuario->close();
}
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

// [INÍCIO DA CORREÇÃO FINAL] - Bloco que busca a equipe, o líder e o usuário logado
$equipe = [];
if ($area_lider) {
    // Variável para guardar o tipo de conta do líder (ex: 'lider_fiscal')
    $lider_conta = 'lider_' . $area_lider;

    $sql_equipe = "
        SELECT id, nome, tipo_conta 
        FROM usuarios 
        WHERE 
            tipo_conta = ? OR -- 1. Membros da própria equipe (ex: 'fiscal', 'dp', etc.)
            tipo_conta = ? OR -- 2. O líder correspondente à equipe (ex: 'lider_fiscal', 'lider_dp')
            id = ?            -- 3. O próprio usuário logado (para garantir que 'Você' sempre apareça)
        GROUP BY id, nome, tipo_conta -- Agrupa para evitar duplicidade de usuários
        ORDER BY nome ASC
    ";

    // Prepara a consulta
    $stmt_equipe = $conexao->prepare($sql_equipe);

    // A ALTERAÇÃO PRINCIPAL ESTÁ AQUI:
    // Agora passamos três parâmetros com os tipos corretos ('ssi'):
    // 1. A área da equipe ($area_lider) -> string
    // 2. O tipo de conta do líder ($lider_conta) -> string
    // 3. O ID do usuário logado ($usuario_id) -> integer
    $stmt_equipe->bind_param('ssi', $area_lider, $lider_conta, $usuario_id);

    // Executa e busca os resultados
    $stmt_equipe->execute();
    $equipe = $stmt_equipe->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt_equipe->close();
}
// [FIM DA CORREÇÃO FINAL]
$empresas = [];
if ($mes_selecionado_id) { // <-- MUDANÇA AQUI
    $sql_empresas = "
    SELECT cf.id, cf.empresa 
    FROM controle_fechamento cf
    WHERE cf.id_mes = ?  -- <-- MUDANÇA AQUI
      AND (cf.data_saida IS NULL OR cf.data_saida >= (SELECT CONCAT(ano, '-', LPAD(mes, 2, '0'), '-01') FROM controle_meses WHERE id = ?))
      AND (cf.setores_permitidos IS NULL OR FIND_IN_SET(?, cf.setores_permitidos) > 0)
      AND cf.tributacao != 'mei'
    ORDER BY cf.empresa ASC
    ";
    $stmt_empresas = $conexao->prepare($sql_empresas);
    // Adicionado um parâmetro extra para a subquery da data_saida
    $stmt_empresas->bind_param('iis', $mes_selecionado_id, $mes_selecionado_id, $area_lider); // <-- MUDANÇA AQUI
    $stmt_empresas->execute();
    $empresas = $stmt_empresas->get_result()->fetch_all(MYSQLI_ASSOC);
}

$empresas_ja_delegadas_ids = [];
if ($mes_selecionado_id && $area_lider) {
    $sql_delegadas = "SELECT DISTINCT id_empresa FROM responsaveis_empresa WHERE id_mes = ? AND tipo_tarefa = ?";
    $stmt_delegadas = $conexao->prepare($sql_delegadas);
    $stmt_delegadas->bind_param('is', $mes_selecionado_id, $area_lider);
    $stmt_delegadas->execute();
    $result_delegadas = $stmt_delegadas->get_result()->fetch_all(MYSQLI_ASSOC);
    $empresas_ja_delegadas_ids = array_column($result_delegadas, 'id_empresa');
}
$delegacoes_por_empresa = [];
if ($mes_selecionado_id && $area_lider) {
    $sql_delegadas = "
        SELECT re.id_empresa, u.nome 
        FROM responsaveis_empresa re
        JOIN usuarios u ON re.id_usuario = u.id
        WHERE re.id_mes = ? AND re.tipo_tarefa = ?
    ";
    $stmt_delegadas = $conexao->prepare($sql_delegadas);
    $stmt_delegadas->bind_param('is', $mes_selecionado_id, $area_lider);
    $stmt_delegadas->execute();
    $result_delegadas = $stmt_delegadas->get_result();

    while ($row = $result_delegadas->fetch_assoc()) {
        $delegacoes_por_empresa[$row['id_empresa']][] = $row['nome'];
    }
}
// [INÍCIO DA CORREÇÃO DEFINITIVA]
$progresso_equipe = [];
$equipe_ids = array_column($equipe, 'id');

if (!empty($equipe_ids) && $mes_selecionado_id && $info_mes_selecionado) {

    // Prepara os placeholders para a cláusula IN
    $ids_placeholder = implode(',', array_fill(0, count($equipe_ids), '?'));

    if ($area_lider === 'contabil') {
        // --- LÓGICA ANUAL CORRIGIDA E SIMPLIFICADA PARA CONTÁBIL ---
        $ano_selecionado = $info_mes_selecionado['ano'];
        $campos_a_verificar = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro', 'balancete', 'distribuicao_dirf', 'defs', 'dasn', 'ecd', 'ecf'];

        $campos_sql_preenchidos_string = implode(' + ', array_map(fn($c) => "CASE WHEN cf.`$c` IS NOT NULL AND cf.`$c` != '' THEN 1 ELSE 0 END", $campos_a_verificar));

        // Esta query garante a contagem anual e usa os dados da versão mais recente de cada empresa.
        $sql_progresso = "
            SELECT
                u.id,
                u.nome,
                u.tipo_conta,
                COUNT(re.id_empresa) AS total_atribuido,
                SUM({$campos_sql_preenchidos_string}) AS campos_preenchidos,
                COUNT(re.id_empresa) * " . count($campos_a_verificar) . " AS total_campos,
                COALESCE(SUM(cf.qtde_funcionarios), 0) AS total_funcionarios_equipe,
                (SELECT COUNT(p.id) FROM parcelamentos p JOIN controle_meses cm_p ON p.id_mes = cm_p.id WHERE p.id_usuario = u.id AND cm_p.ano = ? AND p.status = 'ativo') AS total_parcelamentos
            FROM
                usuarios u
            LEFT JOIN (
                -- 1. Encontra a ID da responsabilidade mais recente para cada empresa do usuário no ano
                SELECT re.id_usuario, re.id_empresa, MAX(re.id) as max_re_id
                FROM responsaveis_empresa re
                JOIN controle_meses cm ON re.id_mes = cm.id
                WHERE cm.ano = ? AND re.tipo_tarefa = 'contabil'
                GROUP BY re.id_usuario, re.id_empresa
            ) as distinct_companies ON u.id = distinct_companies.id_usuario
            LEFT JOIN responsaveis_empresa re ON distinct_companies.max_re_id = re.id
            LEFT JOIN controle_fechamento cf ON re.id_empresa = cf.id
            WHERE
                u.id IN ({$ids_placeholder})
            GROUP BY
                u.id, u.nome
            ORDER BY
                u.nome ASC
        ";

        $params = array_merge([$ano_selecionado, $ano_selecionado], $equipe_ids);
        $types = 'ii' . str_repeat('i', count($equipe_ids));
    } else {
        // --- LÓGICA MENSAL ORIGINAL (QUE JÁ FUNCIONA) PARA FISCAL E DP ---
        $campos_obrigatorios_dp = ['adto', 'folha_pagamento', 'data_pagamento', 'qtde_funcionarios', 'guias_sindicato', 'dissidio', 'fgts_digital', 'e_social', 'dctf_web_mes', 'sd_login', 'sd_senha'];
        $campos_obrigatorios_fiscal = ['reinf', 'impostos', 'iss', 'mit', 'sped_fiscal', 'sped_contribuicao', 'destda', 'gia'];

        $campos_a_verificar = ($area_lider === 'dp') ? $campos_obrigatorios_dp : $campos_obrigatorios_fiscal;

        $campos_sql_preenchidos_string = implode(' + ', array_map(fn($c) => "SUM(CASE WHEN cf.`$c` IS NOT NULL AND cf.`$c` != '' THEN 1 ELSE 0 END)", $campos_a_verificar));

        $sql_progresso = "
            SELECT 
                u.id, u.nome, u.tipo_conta, COUNT(DISTINCT re.id) AS total_atribuido,
                ({$campos_sql_preenchidos_string}) AS campos_preenchidos,
                COUNT(DISTINCT re.id) * " . count($campos_a_verificar) . " AS total_campos,
                COALESCE(SUM(cf.qtde_funcionarios), 0) AS total_funcionarios_equipe,
                (SELECT COUNT(p.id) FROM parcelamentos p WHERE p.id_usuario = u.id AND p.id_mes = ? AND p.status = 'ativo') AS total_parcelamentos
            FROM usuarios u
            LEFT JOIN responsaveis_empresa re ON u.id = re.id_usuario AND re.id_mes = ? AND re.tipo_tarefa = ?
            LEFT JOIN controle_fechamento cf ON re.id_empresa = cf.id AND re.id_mes = cf.id_mes
            WHERE u.id IN ({$ids_placeholder})
            GROUP BY u.id, u.nome, u.tipo_conta ORDER BY u.nome ASC
        ";

        $params = array_merge([$mes_selecionado_id, $mes_selecionado_id, $area_lider], $equipe_ids);
        $types = 'iis' . str_repeat('i', count($equipe_ids));
    }

    // Execução da query (comum para ambos os casos)
    $stmt_progresso = $conexao->prepare($sql_progresso);
    if ($stmt_progresso === false) {
        die("Erro ao preparar query de progresso: " . $conexao->error);
    }
    $stmt_progresso->bind_param($types, ...$params);
    $stmt_progresso->execute();
    $progresso_equipe = $stmt_progresso->get_result()->fetch_all(MYSQLI_ASSOC);
}
// [FIM DA CORREÇÃO DEFINITIVA]
function getInitials($name)
{
    if (empty(trim($name))) return '?';
    $words = explode(' ', trim($name));
    $initials = mb_substr($words[0], 0, 1);
    if (count($words) > 1 && !empty(end($words))) {
        $initials .= mb_substr(end($words), 0, 1);
    }
    return mb_strtoupper($initials);
}
function formatarDuracao($data_inicio, $data_fim = null)
{
    if ($data_fim === null) {
        if ($data_inicio === null) {
            return 'N/A';
        }
        $data_fim = date('Y-m-d H:i:s'); // Pega a data/hora atual
    }

    try {
        $inicio = new DateTime($data_inicio);
        $fim = new DateTime($data_fim);
        $intervalo = $inicio->diff($fim);

        $duracao_formatada = '';
        if ($intervalo->d > 0) {
            $duracao_formatada .= $intervalo->d . 'd ';
        }
        if ($intervalo->h > 0) {
            $duracao_formatada .= $intervalo->h . 'h ';
        }
        if ($intervalo->i > 0) {
            $duracao_formatada .= $intervalo->i . 'm ';
        }
        // Se a duração for muito curta (menos de 1 minuto), mostra os segundos
        if ($duracao_formatada === '') {
            $duracao_formatada = $intervalo->s . 's';
        }

        return trim($duracao_formatada);
    } catch (Exception $e) {
        // Retorna um valor padrão em caso de data inválida
        return 'Inválido';
    }
}
function calcularTempoTotalFormatado($logs)
{
    if (empty($logs)) {
        return 'Nenhum registro';
    }

    $total_segundos = 0;
    foreach ($logs as $log) {
        try {
            $inicio = new DateTime($log['data_login']);

            if ($log['data_logout']) {
                $fim = new DateTime($log['data_logout']);
                $diff = $fim->getTimestamp() - $inicio->getTimestamp();
                $total_segundos += $diff;
            } elseif ($log['status'] === 'Online') {
                $agora = new DateTime();
                $diff = $agora->getTimestamp() - $inicio->getTimestamp();
                $total_segundos += $diff;
            }
        } catch (Exception $e) {
            continue;
        }
    }

    if ($total_segundos <= 0) {
        return 'Menos de 1 min';
    }

    $horas = floor($total_segundos / 3600);
    $minutos = floor(($total_segundos % 3600) / 60);

    return "{$horas}h e {$minutos}min";
}

?>

<!DOCTYPE html>
<html lang="pt-br" data-theme="light">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Painel do Líder - <?= ucfirst($area_lider) ?></title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link rel="stylesheet" href="assets/css/painel_lider.css">
</head>

<body>

    <div class="background-waves"></div>
    <header class="header">
        <h1><i class="fas fa-user-shield"></i> Painel do Líder: <span><?= ucfirst($area_lider) ?></span></h1>

        <div class="header-actions">
            <?php if ($tipo_conta === 'admin'): ?>
                <a href="dashboard.php" class="btn btn-secondary" title="Voltar ao Painel Geral">
                    <i class="fas fa-tachometer-alt"></i> Painel Admin
                </a>
            <?php endif; ?>

            <?php if (in_array($tipo_conta, ['lider_dp', 'lider_fiscal', 'lider_contabil'])): ?>
                <a href="dashboard.php" class="btn btn-secondary" title="Ir para o Dashboard">
                    <i class="fas fa-tachometer-alt"></i> Dashboard
                </a>
            <?php endif; ?>
            <?php if ($tipo_conta === 'lider_contabil'): ?>
                <a href="fiscal_admin.php" class="btn btn-warning btn-large">
                    <i class="fas fa-file-invoice-dollar"></i> Fechamento Fiscal
                </a>
            <?php endif; ?>

            <button class="btn" id="btnLogsAcesso" title="Ver Logs de Acesso">
                <i class="fas fa-history"></i> Logs de Acesso
            </button>

            <button class="btn btn-secondary" id="btnLogsAlteracoes" title="Ver Logs de Alterações">
                <i class="fas fa-edit"></i> Logs de Alterações
            </button>

            <button class="btn-icon" id="changePasswordBtn" title="Alterar Senha">
                <i class="fas fa-key"></i>
            </button>

            <a href="logout.php" class="btn-icon btn-logout" title="Sair do Sistema">
                <i class="fas fa-sign-out-alt"></i>
            </a>
        </div>
    </header>

    <main class="main-content">
        <div class="page-controls">
            <div class="month-selector">
                <label for="select-mes">Visualizando Mês:</label>
                <select id="select-mes" onchange="changeMonth()">
                    <?php foreach ($meses_disponiveis as $mes): ?>
                        <option value="<?= $mes['id'] ?>" <?= ($mes['id'] == $mes_selecionado_id) ? 'selected' : '' ?>>
                            <?= str_pad($mes['mes'], 2, '0', STR_PAD_LEFT) . '/' . $mes['ano'] ?>
                        </option>
                    <?php endforeach; ?>
                </select>
            </div>
        </div>

        <div id="notification-area"></div>

        <div class="card">
            <h2><i class="fas fa-chart-line"></i> Progresso da Equipe</h2>
            <div class="team-progress-container">
                <?php foreach ($progresso_equipe as $membro):
                    $total_campos = (int)($membro['total_campos'] ?? 0);
                    $campos_preenchidos = (int)($membro['campos_preenchidos'] ?? 0);
                    $progresso = ($total_campos > 0) ? ($campos_preenchidos / $total_campos) * 100 : 0;

                    // Calcula o progresso para exibir no texto
                    $texto_progresso = number_format($progresso, 1) . '%';

                    // Determina a área do membro baseada no tipo_conta
                    $area_membro = str_replace('lider_', '', $membro['tipo_conta']);
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
                                <span title="Empresas na carteira"><i class="fas fa-building"></i> <?= (int)($membro['total_atribuido'] ?? 0) ?></span>
                                <span title="Total de funcionários"><i class="fas fa-users"></i> <?= (int)($membro['total_funcionarios_equipe'] ?? 0) ?></span>

                                <span title="Parcelamentos ativos no mês"><i class="fas fa-handshake"></i> <?= (int)($membro['total_parcelamentos'] ?? 0) ?></span>
                            </div>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: <?= number_format($progresso, 2) ?>%;" title="<?= $campos_preenchidos ?> de <?= $total_campos ?> campos preenchidos (<?= number_format($progresso, 2) ?>%)"></div>
                        </div>
                        <div class="progress-text">
                            <?= $campos_preenchidos ?> de <?= $total_campos ?> campos preenchidos
                            <span class="progress-percentage"><?= $texto_progresso ?></span>
                        </div>
                        <a href="<?= $area_membro ?>.php?ver_como=<?= $membro['id'] ?>&mes_id=<?= $mes_selecionado_id ?>&area=<?= $area_membro ?>" class="btn btn-small">
                            Ver Fechamento
                        </a>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>

        <div class="card">
            <h2><i class="fas fa-tasks"></i> Delegar Tarefas</h2>
            <form id="form-delegacao" method="POST">

                <div class="delegation-grid">
                    <div class="delegation-column">
                        <h3>1. Selecione as Empresas</h3>
                        <div class="search-container"><input type="text" id="filtro-empresas" class="form-control" placeholder="Filtrar empresas..."></div>
                        <div class="scrollable-list" id="lista-empresas">
                            <?php foreach ($empresas as $empresa): ?>
                                <label>
                                    <div class="empresa-info">
                                        <input type="checkbox" name="empresas_selecionadas[]" value="<?= $empresa['id'] ?>">
                                        <span><?= htmlspecialchars($empresa['empresa']) ?></span>
                                    </div>

                                    <?php if (isset($delegacoes_por_empresa[$empresa['id']])): ?>
                                        <div class="responsible-avatars">
                                            <?php foreach ($delegacoes_por_empresa[$empresa['id']] as $nome_responsavel): ?>
                                                <span class="avatar-initials" title="<?= htmlspecialchars($nome_responsavel) ?>">
                                                    <?= getInitials($nome_responsavel) ?>
                                                </span>
                                            <?php endforeach; ?>
                                        </div>
                                    <?php endif; ?>
                                </label>
                            <?php endforeach; ?>
                        </div>
                        <button type="button" class="btn btn-outline btn-small" id="selecionar-todas-empresas">Selecionar Visíveis</button>
                    </div>
                    <div class="delegation-column">
                        <h3>2. Selecione os Responsáveis</h3>
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
                    <input type="hidden" name="id_mes_selecionado" value="<?= $mes_selecionado_id ?>">
                    <?php if ($area_lider === 'contabil'): ?>
                        <a href="contabil_admin.php" class="btn btn-secondary btn-large">
                            <i class="fas fa-edit"></i> Gestão Contábil Detalhada
                        </a>
                        <a href="fiscal_admin.php" class="btn btn-warning btn-large">
                            <i class="fas fa-file-invoice-dollar"></i> Fechamento Fiscal
                        </a>
                    <?php elseif ($area_lider === 'dp'): ?>
                        <a href="dp_admin.php" class="btn btn-info btn-large">
                            <i class="fas fa-users-cog"></i> Gestão DP Detalhada
                        </a>
                    <?php elseif ($area_lider === 'fiscal'): ?>
                        <a href="fiscal_admin.php" class="btn btn-warning btn-large">
                            <i class="fas fa-file-invoice-dollar"></i> Gestão Fiscal Detalhada
                        </a>
                        <a href="tabela_parcelamento.php" class="btn btn-primary btn-large">
                            <i class="fas fa-handshake"></i> Ver Todos Parcelamentos
                        </a>
                    <?php endif; ?>

                    <input type="hidden" name="tipo_tarefa" value="<?= $area_lider ?>">
                    <button type="submit" name="delegar_em_massa" class="btn btn-success btn-large">
                        <i class="fas fa-check-double"></i> Confirmar e Delegar
                    </button>
                </div>
            </form>
        </div>
    </main>
    </main>
    <div class="modal" id="modalLogsAcesso">
        <div class="modal-content large">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-history"></i> Logs de Acesso da Equipe (<?= ucfirst($area_lider) ?>)</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body-tabs">
                <div class="user-list-column">
                    <?php foreach ($equipe_logs as $index => $membro): ?>
                        <div class="user-tab <?= $index === 0 ? 'active' : '' ?>" data-user-id="<?= $membro['id'] ?>">
                            <div class="user-avatar"><?= getInitials($membro['nome']) ?></div>
                            <div class="user-info">
                                <span class="user-name"><?= htmlspecialchars($membro['nome']) ?></span>
                                <span class="status-badge <?= $membro['status'] == 'Online' ? 'status-online' : 'status-offline' ?>">
                                    <?= $membro['status'] ?>
                                </span>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>

                <div class="user-content-column">
                    <?php foreach ($equipe_logs as $index => $membro): ?>
                        <div class="user-content <?= $index === 0 ? 'active' : '' ?>" id="content-user-<?= $membro['id'] ?>">

                            <div class="user-kpis">
                                <div class="kpi-item">
                                    <i class="fas fa-clock"></i>
                                    <div>
                                        <span>Tempo Total (últimos 50 acessos)</span>
                                        <strong><?= calcularTempoTotalFormatado($membro['logs']) ?></strong>
                                    </div>
                                </div>
                                <div class="kpi-item">
                                    <i class="fas fa-eye"></i>
                                    <div>
                                        <span>Última Atividade</span>
                                        <strong><?= $membro['ultima_atividade'] ? date('d/m/Y H:i', strtotime($membro['ultima_atividade'])) : 'Nenhuma' ?></strong>
                                    </div>
                                </div>
                            </div>

                            <h4>Histórico Recente de Sessões</h4>
                            <div class="table-responsive">
                                <table class="logs-table">
                                    <thead>
                                        <tr>
                                            <th>Entrada</th>
                                            <th>Saída</th>
                                            <th>Duração</th>
                                            <th>IP</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php if (empty($membro['logs'])): ?>
                                            <tr>
                                                <td colspan="4">Nenhum registro encontrado.</td>
                                            </tr>
                                        <?php else: ?>
                                            <?php foreach ($membro['logs'] as $log): ?>
                                                <tr>
                                                    <td><?= date('d/m/Y H:i', strtotime($log['data_login'])) ?></td>
                                                    <td><?= $log['data_logout'] ? date('d/m/Y H:i', strtotime($log['data_logout'])) : ' - ' ?></td>
                                                    <td>
                                                        <?php
                                                        if ($log['status'] == 'Online') {
                                                            echo formatarDuracao($log['data_login']) . ' (ativo)';
                                                        } elseif ($log['data_logout']) {
                                                            echo formatarDuracao($log['data_login'], $log['data_logout']);
                                                        } else {
                                                            echo 'Sessão expirou';
                                                        }
                                                        ?>
                                                    </td>
                                                    <td><?= htmlspecialchars($log['ip_acesso']) ?></td>
                                                </tr>
                                            <?php endforeach; ?>
                                        <?php endif; ?>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
    </div>
    <div class="modal" id="passwordModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-shield-alt"></i> Alterar Senha</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <form id="changePasswordForm" class="user-form" novalidate>
                    <div class="form-group">
                        <label for="senha_atual"><i class="fas fa-lock-open"></i> Senha Atual</label>
                        <input type="password" id="senha_atual" name="senha_atual" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label for="nova_senha"><i class="fas fa-lock"></i> Nova Senha</label>
                        <input type="password" id="nova_senha" name="nova_senha" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label for="confirmar_senha"><i class="fas fa-check-double"></i> Confirmar Nova Senha</label>
                        <input type="password" id="confirmar_senha" name="confirmar_senha" class="form-control" required>
                    </div>
                    <div class="modal-notifications">
                        <div id="modal-message" class="alert" style="display: none;"></div>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn"><i class="fas fa-save"></i> Salvar Alterações</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    <div class="modal" id="modalLogsAlteracoes">
        <div class="modal-content large">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-edit"></i> Logs de Alterações da Equipe (<?= ucfirst($area_lider) ?>)</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body-tabs">
                <div class="user-list-column">
                    <?php foreach ($equipe_alteracoes as $index => $membro): ?>
                        <div class="user-tab-alteracoes <?= $index === 0 ? 'active' : '' ?>" data-user-id="<?= $membro['id'] ?>">
                            <div class="user-avatar"><?= getInitials($membro['nome']) ?></div>
                            <div class="user-info">
                                <span class="user-name"><?= htmlspecialchars($membro['nome']) ?></span>
                                <span class="user-subtext"><?= $membro['total_alteracoes'] ?> alterações</span>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>

                <div class="user-content-column">
                    <?php foreach ($equipe_alteracoes as $index => $membro): ?>
                        <div class="user-content-alteracoes <?= $index === 0 ? 'active' : '' ?>" id="content-alteracoes-user-<?= $membro['id'] ?>">

                            <div class="user-kpis">
                                <div class="kpi-item">
                                    <i class="fas fa-pencil-alt"></i>
                                    <div>
                                        <span>Total de Alterações</span>
                                        <strong><?= $membro['total_alteracoes'] ?> registros</strong>
                                    </div>
                                </div>
                                <div class="kpi-item">
                                    <i class="fas fa-calendar-alt"></i>
                                    <div>
                                        <span>Última Alteração</span>
                                        <strong><?= $membro['ultima_alteracao'] ? date('d/m/Y H:i', strtotime($membro['ultima_alteracao'])) : 'Nenhuma' ?></strong>
                                    </div>
                                </div>
                            </div>

                            <h4>Histórico Recente de Alterações</h4>
                            <div class="table-responsive">
                                <table class="logs-table">
                                    <thead>
                                        <tr>
                                            <th>Data/Hora</th>
                                            <th>Empresa</th>
                                            <th>Campo Alterado</th>
                                            <th>Valor Antigo</th>
                                            <th>Valor Novo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php if (empty($membro['alteracoes'])): ?>
                                            <tr>
                                                <td colspan="5">Nenhum registro encontrado.</td>
                                            </tr>
                                        <?php else: ?>
                                            <?php foreach ($membro['alteracoes'] as $log): ?>
                                                <tr>
                                                    <td><?= date('d/m/Y H:i', strtotime($log['data_hora'])) ?></td>
                                                    <td><?= htmlspecialchars($log['nome_empresa']) ?></td>
                                                    <td><?= htmlspecialchars($log['coluna_afetada']) ?></td>
                                                    <td><span class="valor-antigo"><?= htmlspecialchars($log['valor_antigo'] ?? 'vazio') ?></span></td>
                                                    <td><span class="valor-novo"><?= htmlspecialchars($log['valor_novo'] ?? 'vazio') ?></span></td>
                                                </tr>
                                            <?php endforeach; ?>
                                        <?php endif; ?>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
    </div>
    <div class="theme-toggle" id="themeToggle" title="Alterar Tema"><i class="fas fa-moon"></i></div>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script>
        // --- ADICIONE ESTA FUNÇÃO ---
        function changeMonth() {
            const mesId = document.getElementById('select-mes').value;
            // Mantém o parâmetro 'area' na URL se ele existir
            const urlParams = new URLSearchParams(window.location.search);
            const area = urlParams.get('area');
            let newUrl = `painel_lider.php?mes_id=${mesId}`;
            if (area) {
                newUrl += `&area=${area}`;
            }
            window.location.href = newUrl;
        }
        $(document).ready(function() {
            $('.user-tab').on('click', function() {
                const userId = $(this).data('user-id');

                $('.user-tab').removeClass('active');
                $('.user-content').removeClass('active');

                $(this).addClass('active');
                $('#content-user-' + userId).addClass('active');
            });

            function mostrarNotificacao(mensagem, tipo = 'success') {
                $('#notification-area').html('');
                const icone = tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
                const classeAlerta = tipo === 'success' ? 'alert-success' : 'alert-error';
                const notificacao = $(`<div class="alert ${classeAlerta} fixed-top"><i class="fas ${icone}"></i> ${mensagem}</div>`);
                $('body').append(notificacao);
                notificacao.fadeIn('slow', () => setTimeout(() => notificacao.fadeOut('slow', () => notificacao.remove()), 4000));
            }

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

            $('#form-delegacao').on('submit', function(e) {
                e.preventDefault();
                const form = $(this);
                const btn = form.find('button[name="delegar_em_massa"]');
                const originalHtml = btn.html();

                btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Delegando...');

                $.ajax({
                    // Ponto 1: A URL agora mantém os parâmetros (?area=... e ?mes_id=...)
                    url: '<?= $nome_arquivo_atual ?>?' + new URLSearchParams(window.location.search).toString(),
                    method: 'POST',
                    // Ponto 2 (A CORREÇÃO PRINCIPAL):
                    // A função .serialize() pega TODOS os campos do formulário (incluindo o id_mes_selecionado)
                    // e os formata para envio. É mais simples e à prova de erros.
                    data: form.serialize() + '&delegar_em_massa=true',
                    dataType: 'json',
                    success: function(response) {
                        if (response.success) {
                            mostrarNotificacao(response.message, 'success');
                            setTimeout(() => location.reload(), 2000);
                        } else {
                            mostrarNotificacao(response.message || 'Ocorreu um erro ao delegar.', 'error');
                        }
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        console.error("Erro AJAX:", textStatus, errorThrown);
                        console.error("Resposta do servidor:", jqXHR.responseText);
                        mostrarNotificacao('Erro de comunicação. Verifique o console (F12) para detalhes.', 'error');
                    },
                    complete: function() {
                        btn.prop('disabled', false).html(originalHtml);
                    }
                });
            });

            const passwordModal = $('#passwordModal');
            const changePasswordForm = $('#changePasswordForm');
            const modalMessage = $('#modal-message');

            $('#changePasswordBtn').on('click', function() {
                changePasswordForm[0].reset();
                modalMessage.hide().removeClass('alert-success alert-error');
                passwordModal.fadeIn();
            });

            $('.modal-close, .modal').on('click', function(e) {
                if ($(e.target).is('.modal') || $(e.target).is('.modal-close')) {
                    $(this).closest('.modal').fadeOut();
                }
            });
            $('.modal-content').on('click', function(e) {
                e.stopPropagation();
            });
            $('#btnLogsAcesso').on('click', function() {
                $('#modalLogsAcesso').fadeIn();
            });

            $('#btnLogsAlteracoes').on('click', function() {
                $('#modalLogsAlteracoes').fadeIn();
            });

            $('.user-tab-alteracoes').on('click', function() {
                const userId = $(this).data('user-id');

                $('.user-tab-alteracoes').removeClass('active');
                $('.user-content-alteracoes').removeClass('active');

                $(this).addClass('active');
                $('#content-alteracoes-user-' + userId).addClass('active');
            });


            $('.modal-close, .modal').on('click', function(e) {
                if ($(e.target).is('.modal') || $(e.target).is('.modal-close')) {
                    $(this).closest('.modal').fadeOut();
                }
            });

            changePasswordForm.on('submit', function(e) {
                e.preventDefault();
                $.ajax({
                    url: 'alterar_senha.php',
                    method: 'POST',
                    data: new FormData(this),
                    processData: false,
                    contentType: false,
                    dataType: 'json',
                    success: function(response) {
                        modalMessage.text(response.message);
                        if (response.success) {
                            modalMessage.removeClass('alert-error').addClass('alert-success').fadeIn();
                            setTimeout(() => passwordModal.fadeOut(), 2500);
                        } else {
                            modalMessage.removeClass('alert-success').addClass('alert-error').fadeIn();
                        }
                    },
                    error: function() {
                        modalMessage.removeClass('alert-success').addClass('alert-error').text('Erro de comunicação.').fadeIn();
                    }
                });
            });
        });
    </script>
    <script src="scripts_globais.js"></script>

</body>

</html>