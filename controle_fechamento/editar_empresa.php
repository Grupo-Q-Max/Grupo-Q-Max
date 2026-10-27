<?php
require 'assets/backend/config.php';
session_start();

if (!isset($_SESSION['usuario_id'])) {
    header('Location: index.php');
    exit();
}

if ($_SESSION['tipo_conta'] !== 'admin' && $_SESSION['tipo_conta'] !== 'fechamento'&& $_SESSION['tipo_conta'] !== 'lider_fiscal') {
    header('Location: dashboard.php');
    exit();
}

$id = isset($_GET['id']) ? intval($_GET['id']) : 0;

if ($id === 0) {
    header('Location: fechamento_completo.php');
    exit();
}

    $sql = "SELECT * FROM controle_fechamento WHERE id = ?";
$stmt = $conexao->prepare($sql);
$stmt->bind_param('i', $id);
$stmt->execute();
$result = $stmt->get_result();
$empresa = $result->fetch_assoc();

if (!$empresa) {
    header('Location: fechamento_completo.php');
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $dados = [];
    foreach ($_POST as $campo => $valor) {
        if ($campo === 'id') continue;

        if (in_array($campo, [
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
            'dezembro'
        ])) {
            $dados[$campo] = $valor === 'on' ? 1 : 0;
            continue;
        }

        if (strpos($campo, 'data_') === 0 && !empty($valor)) {
            $data = DateTime::createFromFormat('d/m/Y', $valor);
            $dados[$campo] = $data ? $data->format('Y-m-d') : null;
            continue;
        }

        $dados[$campo] = $valor === '' ? null : $conexao->real_escape_string($valor);
    }

    $campos = [];
    $tipos = '';
    $valores = [];

    foreach ($dados as $campo => $valor) {
        $campos[] = "$campo = ?";

        if (is_int($valor)) {
            $tipos .= 'i';
        } elseif (is_float($valor)) {
            $tipos .= 'd';
        } else {
            $tipos .= 's';
        }

        $valores[] = $valor;
    }

    $sql = "UPDATE controle_fechamento SET " . implode(', ', $campos) . " WHERE id = ?";
    $stmt = $conexao->prepare($sql);

    $tipos .= 'i';
    $valores[] = $id;

    $stmt->bind_param($tipos, ...$valores);
    $stmt->execute();

    if ($stmt->affected_rows > 0 || $stmt->errno === 0) {
        $_SESSION['mensagem'] = ['tipo' => 'success', 'texto' => 'Empresa atualizada com sucesso!'];
    } else {
        $_SESSION['mensagem'] = ['tipo' => 'danger', 'texto' => 'Erro ao atualizar empresa: ' . $stmt->error];
    }

    header("Location: editar_empresa.php?id=$id");
    exit();
}

function formatarData($data)
{
    if (empty($data)) {
        return '';
    }
    $date = new DateTime($data);
    return $date->format('d/m/Y');
}
?>

<!DOCTYPE html>
<html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Editar Empresa - <?= htmlspecialchars($empresa['empresa']) ?></title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        :root {
            --primary-color: #D90F81;
            --primary-dark: #a00a5d;
            --primary-gradient: linear-gradient(135deg, #D90F81 0%, #D90F89 100%);
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

        body {
            background-color: var(--bg-color);
            color: var(--text-color);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        .header {
            background: var(--card-bg);
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 10px var(--shadow-color);
            border-bottom: 1px solid var(--primary-color);
        }

        .header h1 {
            color: var(--primary-color);
            font-weight: 700;
            margin: 0;
            font-size: 1.8rem;
        }

        .btn-primary-custom {
            background: var(--primary-gradient);
            color: white;
            border: none;
            padding: 0.6rem 1.2rem;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: 500;
        }

        .btn-primary-custom:hover {
            background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-color) 100%);
            transform: translateY(-2px);
            box-shadow: 0 6px 15px rgba(217, 15, 129, 0.4);
            color: white;
        }

        .main-content {
            padding: 2rem;
            max-width: 95vw;
            margin: 0 auto;
        }

        .card {
            background: var(--card-bg);
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 2rem;
            box-shadow: 0 4px 15px var(--shadow-color);
            border: 1px solid var(--primary-color);
        }

        .card-header {
            background: transparent;
            border-bottom: 1px solid var(--primary-color);
            padding-bottom: 1rem;
            margin-bottom: 1.5rem;
        }

        .card-header h2 {
            color: var(--primary-color);
            margin: 0;
            font-size: 1.5rem;
        }

        .form-label {
            color: var(--text-color);
            font-weight: 500;
        }

        .form-control,
        .form-select {
            background-color: var(--input-bg);
            border: 1px solid var(--border-color);
            color: var(--text-color);
        }

        .form-control:focus,
        .form-select:focus {
            background-color: var(--input-focus-bg);
            color: var(--text-color);
            border-color: var(--primary-color);
            box-shadow: 0 0 0 0.25rem rgba(217, 15, 129, 0.25);
        }

        .form-check-input {
            background-color: var(--input-bg);
            border: 1px solid var(--border-color);
        }

        .form-check-input:checked {
            background-color: var(--primary-color);
            border-color: var(--primary-color);
        }

        .form-check-label {
            color: var(--text-color) !important;
        }

        .month-checkbox+.form-check-label {
            color: var(--text-color) !important;
        }

        .badge {
            padding: 0.5em 0.75em;
            border-radius: 50px;
            font-weight: 600;
            font-size: 0.85rem;
        }

        .badge-success {
            background-color: var(--success-color);
            color: white;
        }

        .badge-danger {
            background-color: var(--error-color);
            color: white;
        }

        .badge-warning {
            background-color: var(--warning-color);
            color: #212529;
        }

        .badge-primary {
            background-color: var(--primary-color);
            color: white;
        }

        .month-checkbox {
            width: 20px;
            height: 20px;
        }

        .alert {
            border-radius: 8px;
        }

        .alert-success {
            background-color: rgba(40, 167, 69, 0.2);
            border-color: var(--success-color);
            color: var(--text-color);
        }

        .alert-danger {
            background-color: rgba(220, 53, 69, 0.2);
            border-color: var(--error-color);
            color: var(--text-color);
        }

        .section-title {
            color: var(--primary-color);
            font-size: 1.2rem;
            margin-top: 1.5rem;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid var(--border-color);
        }

        .nav-tabs .nav-link {
            color: var(--text-muted);
            border: none;
            padding: 0.75rem 1.5rem;
        }

        .nav-tabs .nav-link.active {
            color: var(--primary-color);
            background-color: transparent;
            border-bottom: 2px solid var(--primary-color);
            font-weight: 600;
        }

        .nav-tabs {
            border-bottom: 1px solid var(--border-color);
        }

        @media (max-width: 768px) {
            .header h1 {
                font-size: 1.5rem;
            }

            .main-content {
                padding: 1rem;
            }
        }
    </style>
</head>

<body data-theme="dark">
    <header class="header">
        <h1><i class="fas fa-building me-2"></i>Editar Empresa: <?= htmlspecialchars($empresa['empresa']) ?></h1>
        <div>
            <a href="fechamento_completo.php" class="btn-primary-custom"><i class="fas fa-arrow-left me-1"></i> Voltar</a>
        </div>
    </header>

    <div class="main-content">
        <?php if (isset($_SESSION['mensagem'])): ?>
            <div class="alert alert-<?= $_SESSION['mensagem']['tipo'] ?> alert-dismissible fade show" role="alert">
                <?= $_SESSION['mensagem']['texto'] ?>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
            <?php unset($_SESSION['mensagem']); ?>
        <?php endif; ?>

        <div class="card">
            <div class="card-header">
                <h2><i class="fas fa-edit me-2"></i>Formulário de Edição</h2>
            </div>

            <form method="POST" action="">
                <input type="hidden" name="id" value="<?= $empresa['id'] ?>">

                <ul class="nav nav-tabs mb-4" id="empresaTabs" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active" id="dados-tab" data-bs-toggle="tab" data-bs-target="#dados" type="button" role="tab">Dados Básicos</button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="tributacao-tab" data-bs-toggle="tab" data-bs-target="#tributacao" type="button" role="tab">Tributação</button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="dp-tab" data-bs-toggle="tab" data-bs-target="#dp" type="button" role="tab">Departamento Pessoal</button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="fiscal-tab" data-bs-toggle="tab" data-bs-target="#fiscal" type="button" role="tab">Fiscal</button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="mensal-tab" data-bs-toggle="tab" data-bs-target="#mensal" type="button" role="tab">Controle Mensal</button>
                    </li>
                </ul>

                <div class="tab-content" id="empresaTabsContent">
                    <div class="tab-pane fade show active" id="dados" role="tabpanel" aria-labelledby="dados-tab">
                        <div class="row">
                            <div class="col-md-4 mb-3">
                                <label for="codigo" class="form-label">Código</label>
                                <input type="text" class="form-control" id="codigo" name="codigo" value="<?= htmlspecialchars($empresa['codigo'] ?? '') ?>">
                            </div>
                            <div class="col-md-8 mb-3">
                                <label for="empresa" class="form-label">Empresa</label>
                                <input type="text" class="form-control" id="empresa" name="empresa" value="<?= htmlspecialchars($empresa['empresa'] ?? '') ?>" required>
                            </div>
                        </div>

                        <div class="row">
                            <div class="col-md-4 mb-3">
                                <label for="cnpj" class="form-label">CNPJ</label>
                                <input type="text" class="form-control" id="cnpj" name="cnpj" value="<?= htmlspecialchars($empresa['cnpj'] ?? '') ?>">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="insc_estadual" class="form-label">Inscrição Estadual</label>
                                <input type="text" class="form-control" id="insc_estadual" name="insc_estadual" value="<?= htmlspecialchars($empresa['insc_estadual'] ?? '') ?>">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="insc_municipal" class="form-label">Inscrição Municipal</label>
                                <input type="text" class="form-control" id="insc_municipal" name="insc_municipal" value="<?= htmlspecialchars($empresa['insc_municipal'] ?? '') ?>">
                            </div>
                        </div>

                        <div class="row">
                            <div class="col-md-4 mb-3">
                                <label for="login_prefeitura" class="form-label">Login Prefeitura</label>
                                <input type="text" class="form-control" id="login_prefeitura" name="login_prefeitura" value="<?= htmlspecialchars($empresa['login_prefeitura'] ?? '') ?>">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="senha_prefeitura_ginfes" class="form-label">Senha Ginfes</label>
                                <input type="text" class="form-control" id="senha_prefeitura_ginfes" name="senha_prefeitura_ginfes" value="<?= htmlspecialchars($empresa['senha_prefeitura_ginfes'] ?? '') ?>">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="senha_giss_online" class="form-label">Senha GISS</label>
                                <input type="text" class="form-control" id="senha_giss_online" name="senha_giss_online" value="<?= htmlspecialchars($empresa['senha_giss_online'] ?? '') ?>">
                            </div>
                        </div>

                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="link_prefeitura" class="form-label">Link Prefeitura</label>
                                <input type="text" class="form-control" id="link_prefeitura" name="link_prefeitura" value="<?= htmlspecialchars($empresa['link_prefeitura'] ?? '') ?>">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="municipio" class="form-label">Município</label>
                                <input type="text" class="form-control" id="municipio" name="municipio" value="<?= htmlspecialchars($empresa['municipio'] ?? '') ?>">
                            </div>
                        </div>

                        <div class="row">
                            <div class="col-md-4 mb-3">
                                <label for="data_contrato" class="form-label">Data Contrato</label>
                                <input type="text" class="form-control" id="data_contrato" name="data_contrato" value="<?= formatarData($empresa['data_contrato']) ?>">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="data_obrigacao" class="form-label">Data Obrigação</label>
                                <input type="text" class="form-control" id="data_obrigacao" name="data_obrigacao" value="<?= formatarData($empresa['data_obrigacao']) ?>">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="data_saida" class="form-label">Data Saída</label>
                                <input type="text" class="form-control" id="data_saida" name="data_saida" value="<?= formatarData($empresa['data_saida']) ?>">
                            </div>
                        </div>

                        <div class="mb-3">
                            <label for="observacoes" class="form-label">Observações</label>
                            <textarea class="form-control" id="observacoes" name="observacoes" rows="3"><?= htmlspecialchars($empresa['observacoes'] ?? '') ?></textarea>
                        </div>

                        <div class="row">
                            <div class="col-md-4 mb-3">
                                <label for="status" class="form-label">Status</label>
                                <select class="form-select" id="status" name="status">
                                    <option value="Ativo" <?= ($empresa['status'] ?? '') === 'Ativo' ? 'selected' : '' ?>>Ativo</option>
                                    <option value="Inativo" <?= ($empresa['status'] ?? '') === 'Inativo' ? 'selected' : '' ?>>Inativo</option>
                                    <option value="Pendente" <?= ($empresa['status'] ?? '') === 'Pendente' ? 'selected' : '' ?>>Pendente</option>
                                    <option value="Cancelado" <?= ($empresa['status'] ?? '') === 'Cancelado' ? 'selected' : '' ?>>Cancelado</option>
                                </select>
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="tipo" class="form-label">Tipo</label>
                                <input type="text" class="form-control" id="tipo" name="tipo" value="<?= htmlspecialchars($empresa['tipo'] ?? '') ?>">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="envio" class="form-label">Envio</label>
                                <input type="text" class="form-control" id="envio" name="envio" value="<?= htmlspecialchars($empresa['envio'] ?? '') ?>">
                            </div>
                        </div>
                    </div>

                    <!-- Aba Tributação -->
                    <div class="tab-pane fade" id="tributacao" role="tabpanel" aria-labelledby="tributacao-tab">
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="tributacao" class="form-label">Tributação</label>
                                <select class="form-select" id="tributacao" name="tributacao">
                                    <option value="simples_nacional" <?= ($empresa['tributacao'] ?? '') === 'simples_nacional' ? 'selected' : '' ?>>Simples Nacional</option>
                                    <option value="lucro_presumido" <?= ($empresa['tributacao'] ?? '') === 'lucro_presumido' ? 'selected' : '' ?>>Lucro Presumido</option>
                                    <option value="lucro_real" <?= ($empresa['tributacao'] ?? '') === 'lucro_real' ? 'selected' : '' ?>>Lucro Real</option>
                                    <option value="imune_irpj" <?= ($empresa['tributacao'] ?? '') === 'imune_irpj' ? 'selected' : '' ?>>Imune/Isenta IRPJ</option>
                                    <option value="mei" <?= ($empresa['tributacao'] ?? '') === 'mei' ? 'selected' : '' ?>>MEI</option>
                                </select>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="adto" class="form-label">ADTO</label>
                                <input type="text" class="form-control" id="adto" name="adto" value="<?= htmlspecialchars($empresa['adto'] ?? '') ?>">
                            </div>
                        </div>

                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="impostos" class="form-label">Impostos</label>
                                <input type="text" class="form-control" id="impostos" name="impostos" value="<?= htmlspecialchars($empresa['impostos'] ?? '') ?>">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="iss" class="form-label">ISS</label>
                                <input type="text" class="form-control" id="iss" name="iss" value="<?= htmlspecialchars($empresa['iss'] ?? '') ?>">
                            </div>
                        </div>

                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="mit" class="form-label">MIT</label>
                                <input type="text" class="form-control" id="mit" name="mit" value="<?= htmlspecialchars($empresa['mit'] ?? '') ?>">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="status_fiscal" class="form-label">Status Fiscal</label>
                                <select class="form-select" id="status_fiscal" name="status_fiscal">
                                    <option value="Concluído" <?= ($empresa['status_fiscal'] ?? '') === 'Concluído' ? 'selected' : '' ?>>Concluído</option>
                                    <option value="Pendente" <?= ($empresa['status_fiscal'] ?? '') === 'Pendente' ? 'selected' : '' ?>>Pendente</option>
                                    <option value="Atrasado" <?= ($empresa['status_fiscal'] ?? '') === 'Atrasado' ? 'selected' : '' ?>>Atrasado</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Aba Departamento Pessoal -->
                    <div class="tab-pane fade" id="dp" role="tabpanel" aria-labelledby="dp-tab">
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="folha_pagamento" class="form-label">Folha de Pagamento</label>
                                <input type="text" class="form-control" id="folha_pagamento" name="folha_pagamento" value="<?= htmlspecialchars($empresa['folha_pagamento'] ?? '') ?>">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="data_pagamento" class="form-label">Data de Pagamento</label>
                                <input type="text" class="form-control" id="data_pagamento" name="data_pagamento" value="<?= formatarData($empresa['data_pagamento']) ?>">
                            </div>
                        </div>

                        <div class="row">
                            <div class="col-md-4 mb-3">
                                <label for="qtde_funcionarios" class="form-label">Quantidade de Funcionários</label>
                                <input type="number" class="form-control" id="qtde_funcionarios" name="qtde_funcionarios" value="<?= htmlspecialchars($empresa['qtde_funcionarios'] ?? '0') ?>">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="guias_sindicato" class="form-label">Guias Sindicato</label>
                                <input type="text" class="form-control" id="guias_sindicato" name="guias_sindicato" value="<?= htmlspecialchars($empresa['guias_sindicato'] ?? '') ?>">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="dissidio" class="form-label">Dissídio</label>
                                <input type="text" class="form-control" id="dissidio" name="dissidio" value="<?= htmlspecialchars($empresa['dissidio'] ?? '') ?>">
                            </div>
                        </div>

                        <div class="row">
                            <div class="col-md-4 mb-3">
                                <label for="fgts_digital" class="form-label">FGTS Digital</label>
                                <input type="text" class="form-control" id="fgts_digital" name="fgts_digital" value="<?= htmlspecialchars($empresa['fgts_digital'] ?? '') ?>">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="e_social" class="form-label">eSocial</label>
                                <input type="text" class="form-control" id="e_social" name="e_social" value="<?= htmlspecialchars($empresa['e_social'] ?? '') ?>">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="dctf_web_mes" class="form-label">DCTF Web</label>
                                <input type="text" class="form-control" id="dctf_web_mes" name="dctf_web_mes" value="<?= htmlspecialchars($empresa['dctf_web_mes'] ?? '') ?>">
                            </div>
                        </div>

                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="reinf" class="form-label">REINF</label>
                                <input type="text" class="form-control" id="reinf" name="reinf" value="<?= htmlspecialchars($empresa['reinf'] ?? '') ?>">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="status_dp" class="form-label">Status DP</label>
                                <select class="form-select" id="status_dp" name="status_dp">
                                    <option value="Concluído" <?= ($empresa['status_dp'] ?? '') === 'Concluído' ? 'selected' : '' ?>>Concluído</option>
                                    <option value="Pendente" <?= ($empresa['status_dp'] ?? '') === 'Pendente' ? 'selected' : '' ?>>Pendente</option>
                                    <option value="Atrasado" <?= ($empresa['status_dp'] ?? '') === 'Atrasado' ? 'selected' : '' ?>>Atrasado</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Aba Fiscal -->
                    <div class="tab-pane fade" id="fiscal" role="tabpanel" aria-labelledby="fiscal-tab">
                        <div class="row">
                            <div class="col-md-4 mb-3">
                                <label for="balancete" class="form-label">Balancete</label>
                                <input type="text" class="form-control" id="balancete" name="balancete" value="<?= htmlspecialchars($empresa['balancete'] ?? '') ?>">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="distribuicao_dirf" class="form-label">Distribuição DIRF</label>
                                <input type="text" class="form-control" id="distribuicao_dirf" name="distribuicao_dirf" value="<?= htmlspecialchars($empresa['distribuicao_dirf'] ?? '') ?>">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label for="defs" class="form-label">DEFS</label>
                                <input type="text" class="form-control" id="defs" name="defs" value="<?= htmlspecialchars($empresa['defs'] ?? '') ?>">
                            </div>
                        </div>

                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="dasn" class="form-label">DASN</label>
                                <input type="text" class="form-control" id="dasn" name="dasn" value="<?= htmlspecialchars($empresa['dasn'] ?? '') ?>">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="ecd" class="form-label">ECD</label>
                                <input type="text" class="form-control" id="ecd" name="ecd" value="<?= htmlspecialchars($empresa['ecd'] ?? '') ?>">
                            </div>
                        </div>

                        <div class="mb-3">
                            <label for="ecf" class="form-label">ECF</label>
                            <input type="text" class="form-control" id="ecf" name="ecf" value="<?= htmlspecialchars($empresa['ecf'] ?? '') ?>">
                        </div>
                    </div>

                    <!-- Aba Controle Mensal -->
                    <div class="tab-pane fade" id="mensal" role="tabpanel" aria-labelledby="mensal-tab">
                        <h5 class="section-title">Meses Concluídos</h5>
                        <div class="row">
                            <div class="col-md-3 mb-3">
                                <div class="form-check form-switch">
                                    <input class="form-check-input month-checkbox" type="checkbox" id="janeiro" name="janeiro" <?= $empresa['janeiro'] ? 'checked' : '' ?>>
                                    <label class="form-check-label" for="janeiro">Janeiro</label>
                                </div>
                            </div>
                            <div class="col-md-3 mb-3">
                                <div class="form-check form-switch">
                                    <input class="form-check-input month-checkbox" type="checkbox" id="fevereiro" name="fevereiro" <?= $empresa['fevereiro'] ? 'checked' : '' ?>>
                                    <label class="form-check-label" for="fevereiro">Fevereiro</label>
                                </div>
                            </div>
                            <div class="col-md-3 mb-3">
                                <div class="form-check form-switch">
                                    <input class="form-check-input month-checkbox" type="checkbox" id="marco" name="marco" <?= $empresa['marco'] ? 'checked' : '' ?>>
                                    <label class="form-check-label" for="marco">Março</label>
                                </div>
                            </div>
                            <div class="col-md-3 mb-3">
                                <div class="form-check form-switch">
                                    <input class="form-check-input month-checkbox" type="checkbox" id="abril" name="abril" <?= $empresa['abril'] ? 'checked' : '' ?>>
                                    <label class="form-check-label" for="abril">Abril</label>
                                </div>
                            </div>
                        </div>

                        <div class="row">
                            <div class="col-md-3 mb-3">
                                <div class="form-check form-switch">
                                    <input class="form-check-input month-checkbox" type="checkbox" id="maio" name="maio" <?= $empresa['maio'] ? 'checked' : '' ?>>
                                    <label class="form-check-label" for="maio">Maio</label>
                                </div>
                            </div>
                            <div class="col-md-3 mb-3">
                                <div class="form-check form-switch">
                                    <input class="form-check-input month-checkbox" type="checkbox" id="junho" name="junho" <?= $empresa['junho'] ? 'checked' : '' ?>>
                                    <label class="form-check-label" for="junho">Junho</label>
                                </div>
                            </div>
                            <div class="col-md-3 mb-3">
                                <div class="form-check form-switch">
                                    <input class="form-check-input month-checkbox" type="checkbox" id="julho" name="julho" <?= $empresa['julho'] ? 'checked' : '' ?>>
                                    <label class="form-check-label" for="julho">Julho</label>
                                </div>
                            </div>
                            <div class="col-md-3 mb-3">
                                <div class="form-check form-switch">
                                    <input class="form-check-input month-checkbox" type="checkbox" id="agosto" name="agosto" <?= $empresa['agosto'] ? 'checked' : '' ?>>
                                    <label class="form-check-label" for="agosto">Agosto</label>
                                </div>
                            </div>
                        </div>

                        <div class="row">
                            <div class="col-md-3 mb-3">
                                <div class="form-check form-switch">
                                    <input class="form-check-input month-checkbox" type="checkbox" id="setembro" name="setembro" <?= $empresa['setembro'] ? 'checked' : '' ?>>
                                    <label class="form-check-label" for="setembro">Setembro</label>
                                </div>
                            </div>
                            <div class="col-md-3 mb-3">
                                <div class="form-check form-switch">
                                    <input class="form-check-input month-checkbox" type="checkbox" id="outubro" name="outubro" <?= $empresa['outubro'] ? 'checked' : '' ?>>
                                    <label class="form-check-label" for="outubro">Outubro</label>
                                </div>
                            </div>
                            <div class="col-md-3 mb-3">
                                <div class="form-check form-switch">
                                    <input class="form-check-input month-checkbox" type="checkbox" id="novembro" name="novembro" <?= $empresa['novembro'] ? 'checked' : '' ?>>
                                    <label class="form-check-label" for="novembro">Novembro</label>
                                </div>
                            </div>
                            <div class="col-md-3 mb-3">
                                <div class="form-check form-switch">
                                    <input class="form-check-input month-checkbox" type="checkbox" id="dezembro" name="dezembro" <?= $empresa['dezembro'] ? 'checked' : '' ?>>
                                    <label class="form-check-label" for="dezembro">Dezembro</label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="d-grid gap-2 d-md-flex justify-content-md-end mt-4">
                    <button type="submit" class="btn-primary-custom me-md-2">
                        <i class="fas fa-save me-1"></i> Salvar Alterações
                    </button>
                    <a href="fechamento_completo.php" class="btn btn-secondary">
                        <i class="fas fa-times me-1"></i> Cancelar
                    </a>
                </div>
            </form>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery.mask/1.14.16/jquery.mask.min.js"></script>
    <script>
        $(document).ready(function() {
            $('#cnpj').mask('00.000.000/0000-00', {
                reverse: true
            });

            $('[id^="data_"]').mask('00/00/0000');

            var tabEls = document.querySelectorAll('button[data-bs-toggle="tab"]');
            tabEls.forEach(function(tabEl) {
                tabEl.addEventListener('shown.bs.tab', function(event) {
                    event.target 
                    event.relatedTarget 
                });
            });
        });
    </script>
    <script src="scripts_globais.js"></script>

</body>

</html>