<?php
require 'assets/backend/config.php';
session_start();

$tipo_conta = $_SESSION['tipo_conta'] ?? '';
$is_admin = ($tipo_conta === 'admin');
$area_lider = '';

if (strpos($tipo_conta, 'lider_') === 0) {
    $area_lider = str_replace('lider_', '', $tipo_conta);
}

if (!$is_admin && empty($area_lider)) {
    header('Location: dashboard.php');
    exit();
}

$tipos_tarefa = ['dp', 'fiscal', 'contabil'];

$meses_anos = [];
$sql_meses = "SELECT DISTINCT cm.id, cm.mes, cm.ano FROM controle_meses cm JOIN controle_fechamento cf ON cm.id = cf.id_mes ORDER BY cm.ano DESC, cm.mes DESC";
$result_meses = $conexao->query($sql_meses);
if ($result_meses) {
    $meses_anos = $result_meses->fetch_all(MYSQLI_ASSOC);
}

$mes_selecionado = $_GET['mes'] ?? null;
$filtro_tarefas = $_GET['filtro_tarefas'] ?? 'todas';
$filtro_status = $_GET['filtro_status'] ?? 'todas';
$busca = $_GET['busca'] ?? '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['delegar_em_massa'])) {
        $empresas_selecionadas = $_POST['empresas_selecionadas'] ?? [];
        $usuarios_selecionados = $_POST['usuarios_selecionados'] ?? [];
        $tipo_tarefa_massa = $_POST['tipo_tarefa_massa'] ?? '';

        if (empty($empresas_selecionadas) || empty($usuarios_selecionados) || empty($tipo_tarefa_massa)) {
            $erro = "Para delegar em massa, selecione empresas, responsáveis e o tipo de tarefa.";
        } else {
            $novas_delegacoes = 0;
            $total_falha = 0;
            $sql_insert = "INSERT IGNORE INTO responsaveis_empresa (id_empresa, id_usuario, id_mes, tipo_tarefa) VALUES (?, ?, ?, ?)";
            $stmt_insert = $conexao->prepare($sql_insert);

            foreach ($empresas_selecionadas as $id_empresa) {
                $sql_mes = "SELECT id_mes FROM controle_fechamento WHERE id = ?";
                $stmt_mes = $conexao->prepare($sql_mes);
                $stmt_mes->bind_param('i', $id_empresa);
                $stmt_mes->execute();
                $id_mes = $stmt_mes->get_result()->fetch_assoc()['id_mes'] ?? null;
                $stmt_mes->close();

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
            $stmt_insert->close();
            if ($novas_delegacoes > 0) $sucesso = "$novas_delegacoes novas delegações foram adicionadas!";
            else if (empty($erro)) $sucesso = "Nenhuma nova delegação foi adicionada (provavelmente já existiam).";
            if ($total_falha > 0) $erro = "$total_falha delegações falharam.";
        }
    }
    if (isset($_POST['delegar_tarefa'])) {
        $id_empresa = $_POST['id_empresa'];
        $id_usuario = $_POST['id_usuario'];
        $tipo_tarefa = $_POST['tipo_tarefa'] ?? null;
        $sql_mes = "SELECT id_mes FROM controle_fechamento WHERE id = ?";
        $stmt_mes = $conexao->prepare($sql_mes);
        $stmt_mes->bind_param('i', $id_empresa);
        $stmt_mes->execute();
        $id_mes = $stmt_mes->get_result()->fetch_assoc()['id_mes'] ?? null;
        if (empty($id_empresa) || empty($id_usuario) || empty($tipo_tarefa) || empty($id_mes)) {
            $erro = "Todos os campos são obrigatórios!";
        } else {
            $sql_upsert = "INSERT INTO responsaveis_empresa (id_empresa, id_usuario, tipo_tarefa, id_mes) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id_usuario = VALUES(id_usuario)";
            $stmt = $conexao->prepare($sql_upsert);
            $stmt->bind_param('iisi', $id_empresa, $id_usuario, $tipo_tarefa, $id_mes);
            if ($stmt->execute()) $sucesso = "Tarefa delegada com sucesso!";
            else $erro = "Erro ao delegar tarefa: " . $conexao->error;
        }
    }
    if (isset($_POST['editar_delegacao'])) {
        $delegacao_id = $_POST['delegacao_id'];
        $id_usuario = $_POST['id_usuario'];
        $tipo_tarefa = $_POST['tipo_tarefa'] ?? null;
        if (empty($delegacao_id) || empty($id_usuario) || empty($tipo_tarefa)) {
            $erro = "Todos os campos são obrigatórios!";
        } else {
            $sql_atualizar = "UPDATE responsaveis_empresa SET id_usuario = ?, tipo_tarefa = ? WHERE id = ?";
            $stmt = $conexao->prepare($sql_atualizar);
            $stmt->bind_param('isi', $id_usuario, $tipo_tarefa, $delegacao_id);
            if ($stmt->execute()) $sucesso = "Delegação atualizada com sucesso!";
            else $erro = "Erro ao atualizar delegação: " . $conexao->error;
        }
    }
}

$por_pagina = 10;
$pagina = isset($_GET['pagina']) ? max(1, intval($_GET['pagina'])) : 1;
$offset = ($pagina - 1) * $por_pagina;

$where = [];
$params = [];
$types = '';
$where[] = "(cf.data_saida IS NULL OR cf.data_saida > CURDATE())";
if ($mes_selecionado) {
    $where[] = "cf.id_mes = ?";
    $params[] = $mes_selecionado;
    $types .= 'i';
}
if ($busca) {
    $where[] = "(cf.codigo LIKE ? OR cf.empresa LIKE ?)";
    $params[] = "%$busca%";
    $params[] = "%$busca%";
    $types .= 'ss';
}
$where_clause = $where ? "WHERE " . implode(" AND ", $where) : "";

$sql_empresas = "SELECT SQL_CALC_FOUND_ROWS cf.id, cf.codigo, cf.empresa, cf.tributacao, DATE_FORMAT(cf.data_contrato, '%d/%m/%Y') as data_contrato_formatada, cm.mes, cm.ano, cf.id_mes FROM controle_fechamento cf JOIN controle_meses cm ON cf.id_mes = cm.id $where_clause ORDER BY cf.codigo LIMIT $offset, $por_pagina";

if ($params) {
    $stmt_empresas = $conexao->prepare($sql_empresas);
    $stmt_empresas->bind_param($types, ...$params);
    $stmt_empresas->execute();
    $result_empresas = $stmt_empresas->get_result();
} else {
    $result_empresas = $conexao->query($sql_empresas);
}

$empresas = $result_empresas ? $result_empresas->fetch_all(MYSQLI_ASSOC) : [];
$total_resultados = $conexao->query("SELECT FOUND_ROWS()")->fetch_row()[0];
$total_paginas = ceil($total_resultados / $por_pagina);

$responsaveis_empresa = [];
$sql_responsaveis_empresa = "SELECT d.id, d.id_empresa, d.id_usuario, d.tipo_tarefa, d.id_mes, u.nome as funcionario_nome, e.empresa as empresa_nome, cm.mes, cm.ano FROM responsaveis_empresa d JOIN usuarios u ON d.id_usuario = u.id JOIN controle_fechamento e ON d.id_empresa = e.id JOIN controle_meses cm ON d.id_mes = cm.id";
$conditions_resp = [];
if ($mes_selecionado) $conditions_resp[] = "d.id_mes = " . intval($mes_selecionado);
if ($filtro_tarefas !== 'todas') $conditions_resp[] = "d.tipo_tarefa = '" . $conexao->real_escape_string($filtro_tarefas) . "'";
if (!empty($conditions_resp)) $sql_responsaveis_empresa .= " WHERE " . implode(" AND ", $conditions_resp);

$result_responsaveis_empresa = $conexao->query($sql_responsaveis_empresa);
if ($result_responsaveis_empresa) {
    $responsaveis_empresa = $result_responsaveis_empresa->fetch_all(MYSQLI_ASSOC);
}

$todas_delegacoes = [];
foreach ($responsaveis_empresa as $delegacao) {
    $chave = $delegacao['id_empresa'] . '_' . $delegacao['id_mes'];
    if (!isset($todas_delegacoes[$chave][$delegacao['tipo_tarefa']])) {
        $todas_delegacoes[$chave][$delegacao['tipo_tarefa']] = [];
    }
    $todas_delegacoes[$chave][$delegacao['tipo_tarefa']][] = $delegacao['funcionario_nome'];
}

foreach ($empresas as &$empresa) {
    $chave = $empresa['id'] . '_' . $empresa['id_mes'];
    foreach ($tipos_tarefa as $tipo) {
        $responsaveis_da_tarefa = $todas_delegacoes[$chave][$tipo] ?? null;
        $empresa['tarefas_delegadas'][$tipo] = !empty($responsaveis_da_tarefa);
        if (count($responsaveis_da_tarefa ?? []) > 1) {
            $empresa['responsaveis'][$tipo] = count($responsaveis_da_tarefa) . ' responsáveis';
        } else {
            $empresa['responsaveis'][$tipo] = $responsaveis_da_tarefa[0] ?? null;
        }
    }
    $empresa['todas_tarefas_delegadas'] = count(array_filter($empresa['tarefas_delegadas'])) === count($tipos_tarefa);
    $empresa['nenhuma_tarefa_delegada'] = count(array_filter($empresa['tarefas_delegadas'])) === 0;
}
unset($empresa);

if ($filtro_status !== 'todas') {
    $empresas = array_filter($empresas, function ($empresa) use ($filtro_status) {
        if ($filtro_status === 'completas') return $empresa['todas_tarefas_delegadas'];
        else return !$empresa['todas_tarefas_delegadas'];
    });
}

$funcionarios = [];
$sql_funcionarios = "SELECT id, nome, tipo_conta FROM usuarios ORDER BY nome";
if (!empty($area_lider)) {
    $sql_funcionarios .= " AND tipo_conta = '" . $conexao->real_escape_string($area_lider) . "'";
}
$result_funcionarios = $conexao->query($sql_funcionarios);
if ($result_funcionarios) {
    $funcionarios = $result_funcionarios->fetch_all(MYSQLI_ASSOC);
}

$parametros_url = [];
if ($mes_selecionado) $parametros_url['mes'] = $mes_selecionado;
if ($filtro_tarefas !== 'todas') $parametros_url['filtro_tarefas'] = $filtro_tarefas;
if ($filtro_status !== 'todas') $parametros_url['filtro_status'] = $filtro_status;
if ($busca) $parametros_url['busca'] = $busca;
$query_string = !empty($parametros_url) ? '&' . http_build_query($parametros_url) : '';

?>
<!DOCTYPE html>
<html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gestão de Empresas - Delegar Tarefas</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        :root {
            --primary-color: #6a11cb;
            --primary-dark: #2575fc;
            --primary-gradient: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%);
            --secondary-color: #00d2ff;
            --accent-color: #ff7e5f;
            --success-color: #2ecc71;
            --error-color: #e74c3c;
            --bg-color: #f8f9fa;
            --card-bg: rgba(255, 255, 255, 0.98);
            --text-color: #333333;
            --text-muted: #6c757d;
            --border-color: rgba(0, 0, 0, 0.1);
            --input-bg: #ffffff;
            --input-focus-bg: #ffffff;
            --shadow-color: rgba(0, 0, 0, 0.1);
            --warning-color: #ffc107;
            --info-color: #17a2b8;
        }

        [data-theme="dark"] {
            --primary-color: #2575fc;
            --primary-dark: #6a11cb;
            --primary-gradient: linear-gradient(135deg, #2575fc 0%, #6a11cb 100%);
            --secondary-color: #0bd3c4;
            --bg-color: #121212;
            --card-bg: rgba(30, 30, 30, 0.98);
            --text-color: #e0e0e0;
            --text-muted: #b0b0b0;
            --border-color: rgba(255, 255, 255, 0.15);
            --input-bg: rgba(255, 255, 255, 0.1);
            --input-focus-bg: rgba(255, 255, 255, 0.15);
            --shadow-color: rgba(0, 0, 0, 0.3);
            --success-color: #28a745;
            --error-color: #dc3545;
            --warning-color: #ffc107;
            --info-color: #17a2b8;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', sans-serif;
            transition: background-color 0.3s ease, color 0.3s ease;
            scrollbar-width: 10px;
            scrollbar-color: var(--primary-color) var(--input-bg);
        }

        ::-webkit-scrollbar {
            width: 10px;
        }

        ::-webkit-scrollbar-track {
            background: var(--input-bg);
        }

        ::-webkit-scrollbar-thumb {
            background: var(--primary-color);
            border-radius: 10px;
            border: 4px solid var(--input-bg);
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--primary-color);
            box-shadow: 0 1px 100px var(--primary-color);
        }

        body {
            background: var(--bg-color);
            color: var(--text-color);
            overflow-x: hidden;
        }

        .header {
            background: var(--card-bg);
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 5px var(--shadow-color);
            position: relative;
            gap: 20px;
            border-bottom: 1px solid var(--border-color);
        }

        .header h1 {
            color: var(--primary-color);
            font-size: 30px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
        }

        .header-actions {
            display: flex;
            align-items: center;
            gap: 25px;
            flex-shrink: 0;
        }

        .header-btn {
            background: var(--primary-color);
            color: white;
            padding: 8px 16px;
            border-radius: 5px;
            text-decoration: none;
            transition: 0.3s;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .header-btn:hover {
            background: var(--primary-dark);
        }

        .notifications-btn {
            font-size: 1.5rem;
            color: var(--text-muted);
            cursor: pointer;
            transition: 0.3s;
        }

        .notifications-btn:hover {
            color: var(--primary-color);
        }

        .notifications-nav {
            position: fixed;
            top: 60px;
            right: -300px;
            width: 300px;
            height: calc(100vh - 60px);
            background: var(--card-bg);
            box-shadow: -2px 0 15px var(--shadow-color);
            padding: 1rem;
            transition: 0.3s;
            overflow-y: auto;
            z-index: 100;
            border-radius: 15px 0 0 0;
            border: 1px solid var(--border-color);
        }

        .notifications-nav.active {
            right: 0;
        }

        .main-content {
            padding: 20px;
            max-width: 1800px;
            margin: 0 auto;
        }

        .card {
            background: var(--card-bg);
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 5px var(--shadow-color);
            border: 1px solid var(--border-color);
        }

        .card h2 {
            color: var(--primary-color);
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }

        th,
        td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }

        th {
            background-color: var(--input-bg);
            font-weight: 600;
        }

        tr:hover {
            background-color: var(--input-bg);
        }

        .btn {
            background: var(--primary-color);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 5px;
            cursor: pointer;
            transition: 0.3s;
            text-decoration: none;
            display: inline-block;
        }

        .btn:hover {
            background: var(--primary-dark);
        }

        .btn-small {
            padding: 5px 10px;
            font-size: 0.8rem;
        }

        .btn-outline {
            background: transparent;
            border: 1px solid var(--primary-color);
            color: var(--primary-color);
        }

        .btn-outline:hover {
            background: var(--primary-color);
            color: white;
        }

        .btn-warning {
            background: var(--warning-color);
            color: #212529;
        }

        .btn-warning:hover {
            background: #e0a800;
            color: #212529;
        }

        .btn-success {
            background: var(--success-color);
            color: white;
        }

        .btn-success:hover {
            background: #218838;
            color: white;
        }

        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .badge-sn {
            background-color: #4e73df;
            color: white;
        }

        .badge-lp {
            background-color: #1cc88a;
            color: white;
        }

        .badge-lr {
            background-color: #36b9cc;
            color: white;
        }

        .badge-imune {
            background-color: #f6c23e;
            color: #2d3748;
        }

        .badge-mei {
            background-color: #e74a3b;
            color: white;
        }

        .form-group {
            margin-bottom: 15px;
        }

        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
        }

        .form-control {
            width: 100%;
            padding: 10px;
            border: 1px solid var(--border-color);
            border-radius: 5px;
            background: var(--input-bg);
            color: var(--text-color);
        }

        .form-control:focus {
            outline: none;
            border-color: var(--primary-color);
            box-shadow: 0 0 0 3px rgba(217, 15, 129, 0.2);
        }

        .alert {
            padding: 10px 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }

        .alert-success {
            background-color: rgba(40, 167, 69, 0.2);
            border: 1px solid var(--success-color);
            color: var(--success-color);
        }

        .alert-error {
            background-color: rgba(220, 53, 69, 0.2);
            border: 1px solid var(--error-color);
            color: var(--error-color);
        }

        .alert-warning {
            background-color: rgba(255, 193, 7, 0.2);
            border: 1px solid var(--warning-color);
            color: var(--warning-color);
        }

        .theme-toggle {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 50%;
            width: 50px;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 100;
            box-shadow: 0 4px 15px var(--shadow-color);
            transition: all 0.3s ease;
        }

        .theme-toggle:hover {
            transform: scale(1.1) rotate(30deg);
        }

        .theme-toggle i {
            font-size: 1.3rem;
            color: var(--primary-color);
        }

        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1000;
        }

        .modal-content {
            background: var(--card-bg);
            padding: 25px;
            width: 90%;
            max-width: 600px;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            border-radius: 10px;
            box-shadow: 0 5px 20px var(--shadow-color);
            border: 1px solid var(--border-color);
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--border-color);
        }

        .modal-title {
            color: var(--primary-color);
            font-size: 1.5rem;
            margin: 0;
        }

        .modal-close {
            background: none;
            border: none;
            color: var(--text-muted);
            font-size: 1.5rem;
            cursor: pointer;
            transition: color 0.3s;
        }

        .modal-close:hover {
            color: var(--primary-color);
        }

        .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid var(--border-color);
        }

        .confirmation-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1000;
        }

        .confirmation-content {
            background: var(--card-bg);
            padding: 20px;
            width: 300px;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            border-radius: 8px;
            text-align: center;
            color: var(--text-color);
            border: 1px solid var(--border-color);
        }

        .confirmation-buttons {
            margin-top: 15px;
            display: flex;
            gap: 10px;
            justify-content: center;
        }

        .confirmation-btn {
            padding: 8px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }

        .confirmation-btn-confirm {
            background: var(--primary-color);
            color: white;
        }

        .confirmation-btn-confirm:hover {
            background-color: var(--primary-dark);
        }

        .confirmation-btn-cancel {
            background: var(--input-bg);
            color: var(--text-color);
        }

        .confirmation-btn-cancel:hover {
            background: var(--primary-dark);
            color: #fff;
        }

        @media (max-width: 768px) {
            .header h1 {
                font-size: 20px;
            }

            .header-actions {
                gap: 15px;
            }

            table {
                display: block;
                overflow-x: auto;
            }

            .modal-content {
                width: 95%;
                padding: 15px;
            }
        }

        @media (max-width: 480px) {
            .header h1 {
                font-size: 18px;
            }

            .header-btn {
                padding: 6px 12px;
                font-size: 12px;
            }

            th,
            td {
                padding: 8px 10px;
                font-size: 0.9rem;
            }
        }

        .mes-selector {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 20px;
        }

        .mes-selector select {
            flex: 1;
            max-width: 300px;
        }

        .mes-selector .btn {
            margin-left: 10px;
        }

        .filtros-container {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin-bottom: 20px;
        }

        .filtro-group {
            flex: 1;
            min-width: 200px;
        }

        .filtro-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            color: var(--text-color);
        }

        .filtro-group select,
        .filtro-group input {
            width: 100%;
        }

        .status-badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
        }

        .status-completo {
            background-color: var(--success-color);
            color: white;
        }

        .status-incompleto {
            background-color: var(--error-color);
            color: white;
        }

        .status-pendente {
            background-color: var(--warning-color);
            color: #212529;
        }

        .tarefa-status {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
        }

        .tarefa-item {
            display: flex;
            align-items: center;
            gap: 3px;
            font-size: 0.85rem;
        }

        .tarefa-icon {
            font-size: 0.8rem;
        }

        .tarefa-delegada {
            color: var(--success-color);
        }

        .tarefa-pendente {
            color: var(--error-color);
        }

        .tarefa-responsavel {
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-left: 5px;
        }

        .paginacao {
            display: flex;
            justify-content: center;
            margin-top: 20px;
            gap: 5px;
        }

        .paginacao a,
        .paginacao span {
            padding: 8px 12px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            text-decoration: none;
            color: var(--text-color);
            background: var(--input-bg);
        }

        .paginacao a:hover {
            background: var(--primary-color);
            color: white;
            border-color: var(--primary-color);
        }

        .paginacao .ativa {
            background: var(--primary-color);
            color: white;
            border-color: var(--primary-color);
        }

        .paginacao .desabilitada {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .info-badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
            background: var(--info-color);
            color: white;
            margin-left: 10px;
        }

        .tarefas-delegadas-card {
            background: rgba(40, 167, 69, 0.1);
            border: 1px solid var(--success-color);
        }

        .tarefas-delegadas-card h2 {
            color: var(--success-color);
        }

        .tarefas-delegadas-card h2 i {
            color: var(--success-color);
        }

        .busca-container {
            margin-bottom: 20px;
            display: flex;
            gap: 10px;
        }

        .busca-container input {
            flex: 1;
            max-width: 400px;
        }

        .filtros-avancados {
            display: none;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid var(--border-color);
        }

        .filtros-avancados.active {
            display: block;
        }

        .toggle-filtros {
            background: none;
            border: none;
            color: var(--primary-color);
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 5px;
            margin-bottom: 10px;
        }

        .toggle-filtros i {
            transition: transform 0.3s;
        }

        .toggle-filtros.active i {
            transform: rotate(180deg);
        }
    </style>
</head>

<body>
    <header class="header">
        <h1>Gestão de Empresas - Delegar Tarefas</h1>
        <div class="header-actions">
            <a href="dashboard.php" class="header-btn" style="text-decoration: none;"><i class="fas fa-arrow-left"></i> Voltar</a>
            <a href="#" id="logout-btn" class="header-btn" style="text-decoration: none;"><i class="fas fa-sign-out-alt"></i> Sair</a>
            <i class="fas fa-bell notifications-btn"></i>
        </div>
        <nav class="notifications-nav">
            <div class="notification-badge"></div>
            <h3>Notificações</h3>
        </nav>
    </header>

    <main class="main-content">
        <?php if (isset($erro)): ?>
            <div class="alert alert-error"><i class="fas fa-exclamation-circle"></i> <?= $erro ?></div>
        <?php endif; ?>

        <?php if (isset($sucesso)): ?>
            <div class="alert alert-success"><i class="fas fa-check-circle"></i> <?= $sucesso ?></div>
        <?php endif; ?>

        <div class="card">
            <h2><i class="fas fa-filter"></i> Filtros</h2>

            <div class="busca-container">
                <input type="text" id="campo-busca" name="busca" value="<?= htmlspecialchars($busca) ?>"
                    placeholder="Buscar por código ou nome da empresa..." class="form-control">
                <button type="button" id="limpar-busca" class="btn btn-outline" <?= !$busca ? 'disabled' : '' ?>>
                    <i class="fas fa-times"></i> Limpar
                </button>
            </div>

            <button type="button" class="toggle-filtros <?= ($mes_selecionado || $filtro_tarefas !== 'todas' || $filtro_status !== 'todas') ? 'active' : '' ?>">
                <i class="fas fa-chevron-down"></i> Filtros Avançados
            </button>

            <div class="filtros-avancados <?= ($mes_selecionado || $filtro_tarefas !== 'todas' || $filtro_status !== 'todas') ? 'active' : '' ?>">
                <form id="filtrosForm" method="get" class="filtros-container">
                    <input type="hidden" name="busca" value="<?= htmlspecialchars($busca) ?>">

                    <div class="filtro-group">
                        <label for="mes">Mês/Ano</label>
                        <select name="mes" id="mes" class="form-control">
                            <option value="">Todos os meses/anos</option>
                            <?php foreach ($meses_anos as $mes): ?>
                                <option value="<?= $mes['id'] ?>" <?= $mes_selecionado == $mes['id'] ? 'selected' : '' ?>>
                                    <?= $mes['mes'] ?>/<?= $mes['ano'] ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div class="filtro-group">
                        <label for="filtro_tarefas">Tipo de Tarefa</label>
                        <select name="filtro_tarefas" id="filtro_tarefas" class="form-control">
                            <option value="todas" <?= $filtro_tarefas === 'todas' ? 'selected' : '' ?>>Todas as tarefas</option>
                            <option value="dp" <?= $filtro_tarefas === 'dp' ? 'selected' : '' ?>>DP</option>
                            <option value="fiscal" <?= $filtro_tarefas === 'fiscal' ? 'selected' : '' ?>>Fiscal</option>
                            <option value="contabil" <?= $filtro_tarefas === 'contabil' ? 'selected' : '' ?>>Contábil</option>
                        </select>
                    </div>

                    <div class="filtro-group">
                        <label for="filtro_status">Status Empresas</label>
                        <select name="filtro_status" id="filtro_status" class="form-control">
                            <option value="todas" <?= $filtro_status === 'todas' ? 'selected' : '' ?>>Todas empresas</option>
                            <option value="completas" <?= $filtro_status === 'completas' ? 'selected' : '' ?>>Com todas tarefas delegadas</option>
                            <option value="incompletas" <?= $filtro_status === 'incompletas' ? 'selected' : '' ?>>Com tarefas pendentes</option>
                        </select>
                    </div>

                    <div class="filtro-group" style="align-self: flex-end;">
                        <button type="submit" class="btn"><i class="fas fa-check"></i> Aplicar</button>
                        <a href="?<?= $busca ? 'busca=' . urlencode($busca) : '' ?>" class="btn btn-outline"><i class="fas fa-broom"></i> Limpar</a>
                    </div>
                </form>
            </div>
        </div>

        <div class="card">
            <h2>
                <i class="fas fa-building"></i> Empresas Ativas <?= $mes_selecionado ? 'do Mês Selecionado' : '' ?>
                <span class="info-badge">Página <?= $pagina ?> de <?= $total_paginas ?></span>
            </h2>
            <form method="POST" id="form-delegacao-massa">
                <div id="barra-acao-massa" style="display: none; background-color: rgba(106, 17, 203, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid var(--primary-color);">
                    <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 15px;">
                        <strong style="color: var(--primary-color);"><span id="contador-selecionados">0</span> empresas selecionadas</strong>

                        <div style="flex-grow: 1;">
                            <label for="usuarios-massa" style="font-size: 0.9rem;">Delegar para:</label>
                            <select name="usuarios_selecionados[]" id="usuarios-massa" class="form-control" multiple required>
                                <?php foreach ($funcionarios as $funcionario): ?>
                                    <option value="<?= $funcionario['id'] ?>"><?= htmlspecialchars($funcionario['nome']) ?></option>
                                <?php endforeach; ?>
                            </select>
                            <small>Segure CTRL (ou CMD) para selecionar vários.</small>
                        </div>

                        <div style="flex-grow: 1;">
                            <label for="tarefa-massa" style="font-size: 0.9rem;">Tipo de Tarefa:</label>
                            <select name="tipo_tarefa_massa" id="tarefa-massa" class="form-control" required <?= !empty($area_lider) ? 'readonly' : '' ?>>
                                <?php if (!empty($area_lider)): ?>
                                    <option value="<?= $area_lider ?>" selected><?= ucfirst($area_lider) ?></option>
                                <?php else: ?>
                                    <option value="">Selecione a tarefa</option>
                                    <option value="dp">DP</option>
                                    <option value="fiscal">Fiscal</option>
                                    <option value="contabil">Contábil</option>
                                <?php endif; ?>
                            </select>
                        </div>

                        <div>
                            <button type="submit" name="delegar_em_massa" class="btn btn-success">
                                <i class="fas fa-check-double"></i> Aplicar Delegação
                            </button>
                        </div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th><input type="checkbox" id="selecionar-todos-empresas" title="Selecionar Todos"></th>
                            <th>Código</th>
                            <th>Empresa</th>
                            <th>Tributação</th>
                            <th>Contrato</th>
                            <th>Mês/Ano</th>
                            <th>Status Tarefas</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($empresas)): ?>
                            <tr>
                                <td colspan="7" style="text-align: center;">Nenhuma empresa encontrada com os filtros aplicados</td>
                            </tr>
                        <?php else: ?>
                            <?php foreach ($empresas as $empresa): ?>
                                <tr>
                                    <td> <input type="checkbox" class="checkbox-empresa" name="empresas_selecionadas[]" value="<?= $empresa['id'] ?>">
                                    </td>
                                    <td><?= htmlspecialchars($empresa['codigo'] ?? 'não informado') ?></td>
                                    <td><?= htmlspecialchars($empresa['empresa'] ?? 'não informado') ?></td>
                                    <td>
                                        <?php
                                        $tributacao = strtolower($empresa['tributacao']);
                                        $badge_class = '';
                                        $tributacao_label = '';

                                        if (strpos($tributacao, 'simples') !== false) {
                                            $badge_class = 'badge-sn';
                                            $tributacao_label = 'SN';
                                        } elseif (strpos($tributacao, 'presumido') !== false) {
                                            $badge_class = 'badge-lp';
                                            $tributacao_label = 'LP';
                                        } elseif (strpos($tributacao, 'real') !== false) {
                                            $badge_class = 'badge-lr';
                                            $tributacao_label = 'LR';
                                        } elseif (strpos($tributacao, 'imune') !== false) {
                                            $badge_class = 'badge-imune';
                                            $tributacao_label = 'Imune';
                                        } elseif (strpos($tributacao, 'mei') !== false) {
                                            $badge_class = 'badge-mei';
                                            $tributacao_label = 'MEI';
                                        }
                                        ?>
                                        <span class="badge <?= $badge_class ?>"><?= $tributacao_label ?></span>
                                    </td>
                                    <td><?= htmlspecialchars($empresa['data_contrato_formatada'] ?? 'não informado') ?></td>
                                    <td><?= $empresa['mes'] ?>/<?= $empresa['ano'] ?></td>
                                    <td>
                                        <span class="status-badge <?= $empresa['todas_tarefas_delegadas'] ? 'status-completo' : ($empresa['nenhuma_tarefa_delegada'] ? 'status-incompleto' : 'status-pendente') ?>">
                                            <?= $empresa['todas_tarefas_delegadas'] ? 'Completo' : ($empresa['nenhuma_tarefa_delegada'] ? 'Pendente' : 'Parcial') ?>
                                        </span>
                                        <div class="tarefa-status">
                                            <?php foreach ($tipos_tarefa as $tipo): ?>
                                                <div class="tarefa-item">
                                                    <i class="fas fa-<?= $empresa['tarefas_delegadas'][$tipo] ? 'check-circle tarefa-delegada' : 'times-circle tarefa-pendente' ?> tarefa-icon"></i>
                                                    <span><?= ucfirst($tipo) ?></span>
                                                    <?php if ($empresa['tarefas_delegadas'][$tipo]): ?>
                                                        <span class="tarefa-responsavel" title="<?= htmlspecialchars($empresa['responsaveis'][$tipo]) ?>">
                                                            <i class="fas fa-user"></i>
                                                        </span>
                                                    <?php endif; ?>
                                                </div>
                                            <?php endforeach; ?>
                                        </div>
                                    </td>
                                    <td>
                                        <button class="btn btn-small btn-outline delegar-btn"
                                            data-empresa-id="<?= $empresa['id'] ?>"
                                            data-empresa-nome="<?= htmlspecialchars($empresa['empresa']) ?>">
                                            <i class="fas fa-user-plus"></i> Delegar
                                        </button>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </form>
            <?php if ($total_paginas > 1): ?>
                <div class="paginacao">
                    <?php if ($pagina > 1): ?>
                        <a href="?pagina=1<?= $query_string ?>"><i class="fas fa-angle-double-left"></i></a>
                        <a href="?pagina=<?= $pagina - 1 ?><?= $query_string ?>"><i class="fas fa-angle-left"></i></a>
                    <?php else: ?>
                        <span class="desabilitada"><i class="fas fa-angle-double-left"></i></span>
                        <span class="desabilitada"><i class="fas fa-angle-left"></i></span>
                    <?php endif; ?>

                    <?php
                    $inicio = max(1, $pagina - 2);
                    $fim = min($total_paginas, $pagina + 2);

                    if ($inicio > 1) echo '<span>...</span>';

                    for ($i = $inicio; $i <= $fim; $i++): ?>
                        <a href="?pagina=<?= $i ?><?= $query_string ?>" <?= $i == $pagina ? 'class="ativa"' : '' ?>><?= $i ?></a>
                    <?php endfor;

                    if ($fim < $total_paginas) echo '<span>...</span>';
                    ?>

                    <?php if ($pagina < $total_paginas): ?>
                        <a href="?pagina=<?= $pagina + 1 ?><?= $query_string ?>"><i class="fas fa-angle-right"></i></a>
                        <a href="?pagina=<?= $total_paginas ?><?= $query_string ?>"><i class="fas fa-angle-double-right"></i></a>
                    <?php else: ?>
                        <span class="desabilitada"><i class="fas fa-angle-right"></i></span>
                        <span class="desabilitada"><i class="fas fa-angle-double-right"></i></span>
                    <?php endif; ?>
                </div>
            <?php endif; ?>
        </div>

        <div class="card tarefas-delegadas-card">
            <h2><i class="fas fa-tasks"></i> Tarefas Delegadas <?= $mes_selecionado ? 'do Mês Selecionado' : '' ?></h2>
            <?php if ($filtro_tarefas !== 'todas'): ?>
                <p>Filtrado por: <?= ucfirst($filtro_tarefas) ?></p>
            <?php endif; ?>

            <?php if (empty($responsaveis_empresa)): ?>
                <p>Nenhuma tarefa delegada encontrada com os filtros aplicados.</p>
            <?php else: ?>
                <table>
                    <thead>
                        <tr>
                            <th>Empresa</th>
                            <th>Tipo de Tarefa</th>
                            <th>Responsável</th>
                            <th>Mês/Ano</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($responsaveis_empresa as $delegacao): ?>
                            <tr>
                                <td><?= htmlspecialchars($delegacao['empresa_nome']) ?></td>
                                <td><?= ucfirst(htmlspecialchars($delegacao['tipo_tarefa'] ?? 'contabil')) ?></td>
                                <td><?= htmlspecialchars($delegacao['funcionario_nome']) ?></td>
                                <td><?= $delegacao['mes'] ?>/<?= $delegacao['ano'] ?></td>
                                <td>
                                    <button class="btn btn-small editar-delegacao-btn"
                                        data-delegacao-id="<?= $delegacao['id'] ?>"
                                        data-empresa-id="<?= $delegacao['id_empresa'] ?>"
                                        data-funcionario-id="<?= $delegacao['id_usuario'] ?>"
                                        data-tipo-tarefa="<?= htmlspecialchars($delegacao['tipo_tarefa']) ?>"
                                        data-empresa-nome="<?= htmlspecialchars($delegacao['empresa_nome']) ?>">
                                        <i class="fas fa-edit"></i> Editar
                                    </button>
                                    <button class="btn btn-small btn-outline remover-delegacao-btn"
                                        data-delegacao-id="<?= $delegacao['id'] ?>">
                                        <i class="fas fa-trash"></i> Remover
                                    </button>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>
    </main>


    <div class="modal" id="delegarModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-user-plus"></i> Delegar Tarefa</h3>
                <button class="modal-close">&times;</button>
            </div>
            <form id="delegarForm" method="POST">
                <input type="hidden" name="id_empresa" id="delegar-empresa-id">

                <div class="form-group">
                    <label for="delegar-empresa-nome">Empresa</label>
                    <input type="text" id="delegar-empresa-nome" class="form-control" readonly>
                </div>

                <div class="form-group">
                    <label for="delegar-tipo-tarefa">Tipo de Tarefa</label>
                    <select name="tipo_tarefa" id="delegar-tipo-tarefa" class="form-control" required>
                        <option value="">Selecione o tipo de tarefa</option>
                        <option value="fiscal">Fiscal</option>
                        <option value="dp">DP</option>
                        <option value="contabil">Contábil</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="delegar-funcionario">Responsável</label>
                    <select name="id_usuario" id="delegar-funcionario" class="form-control" required>
                        <option value="">Selecione um responsável</option>
                        <?php foreach ($funcionarios as $funcionario): ?>
                            <option value="<?= $funcionario['id'] ?>"><?= htmlspecialchars($funcionario['nome']) ?> (<?= ucfirst($funcionario['tipo_conta']) ?>)</option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-outline modal-close"><i class="fas fa-times"></i> Cancelar</button>
                    <button type="submit" name="delegar_tarefa" class="btn"><i class="fas fa-save"></i> Salvar</button>
                </div>
            </form>
        </div>
    </div>

    <div class="modal" id="editarDelegacaoModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-edit"></i> Editar Delegação</h3>
                <button class="modal-close">&times;</button>
            </div>
            <form id="editarDelegacaoForm" method="POST">
                <input type="hidden" name="delegacao_id" id="editar-delegacao-id">

                <div class="form-group">
                    <label for="editar-empresa-nome">Empresa</label>
                    <input type="text" id="editar-empresa-nome" class="form-control" readonly>
                </div>

                <div class="form-group">
                    <label for="editar-tipo-tarefa">Tipo de Tarefa</label>
                    <select name="tipo_tarefa" id="editar-tipo-tarefa" class="form-control" required>
                        <option value="">Selecione o tipo de tarefa</option>
                        <option value="fiscal">Fiscal</option>
                        <option value="dp">DP</option>
                        <option value="contabil">Contábil</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="editar-funcionario">Responsável</label>
                    <select name="id_usuario" id="editar-funcionario" class="form-control" required>
                        <option value="">Selecione um responsável</option>
                        <?php foreach ($funcionarios as $funcionario): ?>
                            <option value="<?= $funcionario['id'] ?>"><?= htmlspecialchars($funcionario['nome']) ?> (<?= ucfirst($funcionario['tipo_conta']) ?>)</option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-outline modal-close"><i class="fas fa-times"></i> Cancelar</button>
                    <button type="submit" name="editar_delegacao" class="btn"><i class="fas fa-save"></i> Salvar</button>
                </div>
            </form>
        </div>
    </div>

    <div class="confirmation-modal" id="removerDelegacaoModal">
        <div class="confirmation-content">
            <p><i class="fas fa-exclamation-triangle"></i> Tem certeza que deseja remover esta delegação?</p>
            <div class="confirmation-buttons">
                <button class="confirmation-btn confirmation-btn-confirm" id="confirmar-remocao"><i class="fas fa-check"></i> Sim</button>
                <button class="confirmation-btn confirmation-btn-cancel"><i class="fas fa-times"></i> Cancelar</button>
            </div>
        </div>
    </div>

    <div class="confirmation-modal" id="logoutModal">
        <div class="confirmation-content">
            <p><i class="fas fa-sign-out-alt"></i> Tem certeza que deseja sair do sistema?</p>
            <div class="confirmation-buttons">
                <a href="logout.php" class="confirmation-btn confirmation-btn-confirm"><i class="fas fa-check"></i> Sim</a>
                <button class="confirmation-btn confirmation-btn-cancel"><i class="fas fa-times"></i> Cancelar</button>
            </div>
        </div>
    </div>

    <div class="theme-toggle" id="themeToggle">
        <i class="fas fa-moon"></i>
    </div>

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script>
        $(document).ready(function() {
            // --- MEMÓRIA DE SELEÇÃO (JÁ ESTÁ PERFEITA) ---
            let empresasSelecionadasIds = new Set();

            // --- LÓGICA GERAL DA PÁGINA (JÁ ESTÁ PERFEITA) ---
            const themeToggle = $('#themeToggle');
            const currentTheme = localStorage.getItem('theme') || 'light';
            $('html').attr('data-theme', currentTheme);
            themeToggle.html(`<i class="fas fa-${currentTheme === 'dark' ? 'sun' : 'moon'}"></i>`);
            themeToggle.click(function() {});
            $('#logout-btn').click((e) => {
                e.preventDefault();
                $('#logoutModal').fadeIn();
            });
            $(document).on('click', '.modal-close, .confirmation-btn-cancel', function() {
                $(this).closest('.modal, .confirmation-modal').fadeOut();
            });

            function mostrarNotificacao(mensagem, tipo = 'success') {
                const icone = tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
                const classeAlerta = tipo === 'success' ? 'alert-success' : 'alert-error';
                const notificacao = $(`
                <div class="alert ${classeAlerta}" style="position: fixed; top: 80px; right: 20px; z-index: 2000; display: none; box-shadow: 0 5px 15px rgba(0,0,0,0.2);">
                    <i class="fas ${icone}"></i> ${mensagem}
                </div>
            `);
                $('body').append(notificacao);
                notificacao.fadeIn('slow', function() {
                    setTimeout(function() {
                        notificacao.fadeOut('slow', function() {
                            $(this).remove();
                        });
                    }, 3000);
                });
            }

            const formDelegacao = $('#form-delegacao-massa');
            const tabelaBody = formDelegacao.find('tbody');
            const paginacaoContainer = $('.paginacao');
            const delegacoesContainer = $('#container-delegacoes');

            function buscarEmpresas(pagina = 1) {
                const busca = $('#campo-busca').val().trim();
                const mes = $('#mes').val();
                const filtro_status = $('#filtro_status').val();
                const filtro_tarefas = $('#filtro_tarefas').val();

                tabelaBody.html('<tr><td colspan="8" style="text-align: center;"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>');

                $.ajax({
                    url: 'buscar_empresas.php',
                    method: 'GET',
                    data: {
                        busca,
                        mes,
                        filtro_status,
                        filtro_tarefas,
                        pagina
                    },
                    dataType: 'json',
                    success: function(response) {
                        tabelaBody.html(response.tabela_html);
                        paginacaoContainer.html(response.paginacao_html);

                        tabelaBody.find('.checkbox-empresa').each(function() {
                            const empresaId = parseInt($(this).val());
                            if (empresasSelecionadasIds.has(empresaId)) {
                                $(this).prop('checked', true);
                            }
                        });

                        atualizarBarraAcao();
                    },
                    error: function() {
                        tabelaBody.html('<tr><td colspan="8" style="text-align: center; color: var(--error-color);">Erro ao carregar dados.</td></tr>');
                    }
                });
            }

            // --- ATIVADORES DOS FILTROS E BUSCA (CORRIGIDO) ---
            let buscaTimer;
            $('#campo-busca').on('keyup', function() {
                // Habilita/desabilita o botão de limpar conforme o campo tem texto ou não
                $('#limpar-busca').prop('disabled', $(this).val().trim() === '');

                clearTimeout(buscaTimer);
                buscaTimer = setTimeout(() => buscarEmpresas(1), 500);
            });

            $('#mes, #filtro_status, #filtro_tarefas').change(() => buscarEmpresas(1));

            $('#filtrosForm').on('submit', (e) => {
                e.preventDefault();
                buscarEmpresas(1);
            });

            $('#limpar-busca').click(function() {
                $('#campo-busca').val('');
                $(this).prop('disabled', true);
                buscarEmpresas(1);
            });

            function atualizarBarraAcao() {
                const selecionados = empresasSelecionadasIds.size;
                $('#contador-selecionados').text(selecionados);
                if (selecionados > 0) {
                    $('#barra-acao-massa').slideDown('fast');
                } else {
                    $('#barra-acao-massa').slideUp('fast');
                }
            }

            $(document).on('click', '#selecionar-todos-empresas', function() {
                $('tbody tr:visible .checkbox-empresa').each(function() {
                    const empresaId = parseInt($(this).val());
                    const isChecked = $('#selecionar-todos-empresas').prop('checked');
                    $(this).prop('checked', isChecked);
                    if (isChecked) empresasSelecionadasIds.add(empresaId);
                    else empresasSelecionadasIds.delete(empresaId);
                });
                atualizarBarraAcao();
            });

            $(document).on('click', '.checkbox-empresa', function() {
                const empresaId = parseInt($(this).val());
                if (this.checked) empresasSelecionadasIds.add(empresaId);
                else empresasSelecionadasIds.delete(empresaId);
                atualizarBarraAcao();
            });

            formDelegacao.on('submit', function() {
                $(this).find('input.hidden-empresa-id').remove();
                empresasSelecionadasIds.forEach(id => {
                    $(this).append(`<input type="hidden" class="hidden-empresa-id" name="empresas_selecionadas[]" value="${id}">`);
                });
                return true;
            });

            $(document).on('click', '.delegar-btn', function() {
                $('#delegar-empresa-id').val($(this).data('empresa-id'));
                $('#delegar-empresa-nome').val($(this).data('empresa-nome'));
                $('#delegarModal').fadeIn();
            });

            $(document).on('click', '.editar-delegacao-btn', function() {
                $('#editar-delegacao-id').val($(this).data('delegacao-id'));
                $('#editar-empresa-nome').val($(this).data('empresa-nome'));
                $('#editar-tipo-tarefa').val($(this).data('tipo-tarefa'));
                $('#editar-funcionario').val($(this).data('funcionario-id'));
                $('#editarDelegacaoModal').fadeIn();
            });

            let delegacaoParaRemover = null;
            let botaoRemoverClicado = null;

            $(document).on('click', '.remover-delegacao-btn', function() {
                delegacaoParaRemover = $(this).data('delegacao-id');
                botaoRemoverClicado = $(this);
                $('#removerDelegacaoModal').fadeIn();
            });

            $('#confirmar-remocao').click(function() {
                if (!delegacaoParaRemover) return;

                const btnConfirmar = $(this);
                const htmlOriginal = btnConfirmar.html();

                btnConfirmar.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Removendo...');

                $.ajax({
                    url: 'remover_delegacao.php',
                    method: 'POST',
                    data: {
                        delegacao_id: delegacaoParaRemover
                    },
                    dataType: 'json',
                    success: function(response) {
                        if (response.success) {
                            mostrarNotificacao('Delegação removida com sucesso!', 'success');

                            if (botaoRemoverClicado) {
                                botaoRemoverClicado.closest('tr').fadeOut('slow', function() {
                                    $(this).remove();
                                    buscarEmpresas($('.paginacao .ativa').data('pagina') || 1);
                                });
                            }
                        } else {
                            mostrarNotificacao('Erro ao remover: ' + (response.message || 'Erro desconhecido'), 'error');
                        }
                    },
                    error: function() {
                        mostrarNotificacao('Erro de comunicação com o servidor.', 'error');
                    },
                    complete: function() {
                        btnConfirmar.prop('disabled', false).html(htmlOriginal);
                        $('#removerDelegacaoModal').fadeOut();
                        delegacaoParaRemover = null;
                        botaoRemoverClicado = null;
                    }
                });
            });
        });
    </script>
    <script src="scripts_globais.js"></script>

</body>

</html>