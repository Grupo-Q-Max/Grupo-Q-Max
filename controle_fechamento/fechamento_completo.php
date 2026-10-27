<?php
require 'assets/backend/config.php';
session_start();

if (!isset($_SESSION['usuario_id'])) {
    header('Location: index.php');
    exit();
}
if ($_SESSION['tipo_conta'] !== 'admin' && $_SESSION['tipo_conta'] !== 'fechamento') {
    header('Location: dashboard.php');
    exit();
}

?>
<!DOCTYPE html>
<html lang="pt-br" data-theme="light">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Painel de Controle - Admin</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/fechamento_completo.css">
    <style>
        /* Estilos adicionais para os novos cards de acesso */
        .access-panel {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-top: 2rem;
        }

        .access-card {
            background-color: var(--card-bg, #fff);
            border-radius: 12px;
            padding: 2rem;
            text-align: center;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.08);
            transition: all 0.3s ease;
            border: 1px solid var(--border-color, #eee);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }

        .access-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.12);
        }

        .access-card .icon {
            font-size: 3.5rem;
            margin-bottom: 1rem;
        }

        .access-card .icon-fiscal {
            color: #ffc107;
        }

        /* Amarelo */
        .access-card .icon-dp {
            color: #0dcaf0;
        }

        /* Ciano */
        .access-card .icon-contabil {
            color: #6f42c1;
        }

        /* Roxo */
        .access-card h3 {
            font-size: 1.5rem;
            margin-bottom: 0.75rem;
            color: var(--text-color, #333);
        }

        .access-card p {
            color: var(--text-muted, #777);
            margin-bottom: 1.5rem;
            flex-grow: 1;
        }

        .access-card .btn-access {
            text-decoration: none;
            padding: 0.75rem 1.5rem;
            border-radius: 50px;
            font-weight: 600;
            transition: all 0.3s ease;
        }

        .btn-fiscal {
            background-color: #ffc107;
            color: #111;
        }

        .btn-fiscal:hover {
            background-color: #e0a800;
        }

        .btn-dp {
            background-color: #0dcaf0;
            color: #111;
        }

        .btn-dp:hover {
            background-color: #0baccc;
        }

        .btn-contabil {
            background-color: #6f42c1;
            color: #fff;
        }

        .btn-contabil:hover {
            background-color: #5d37a2;
        }

        /* ADICIONE ESTE BLOCO ABAIXO */
        .access-card .icon-cushman {
            color: #1abc9c;
            /* Verde-azulado (Teal) */
        }

        .btn-cushman {
            background-color: #1abc9c;
            color: #fff;
        }

        .btn-cushman:hover {
            background-color: #16a085;
            /* Tom mais escuro */
        }
    </style>
</head>

<body>

    <header class="header">
        <h1><i class="fas fa-user-shield me-2"></i>Painel de Controle do Administrador</h1>
        <a href="dashboard.php" class="btn-primary-custom"><i class="fas fa-arrow-left me-1"></i> Voltar ao Painel</a>
    </header>

    <div class="main-content">
        <div class="filters-card">
            <h2><i class="fas fa-th-large me-2"></i>Acesso Rápido aos Setores</h2>
            <p>Selecione um setor para acessar a visão de gerenciamento completa, com filtros, edição e exportação de dados.</p>

            <div class="access-panel">
                <div class="access-card">
                    <div>
                        <div class="icon icon-fiscal"><i class="fas fa-file-invoice-dollar"></i></div>
                        <h3>Gestão Fiscal</h3>
                        <p>Visualize e gerencie todas as empresas, atribua responsáveis e edite os dados do fechamento fiscal mês a mês.</p>
                    </div>
                    <a href="fiscal_admin.php" class="btn-access btn-fiscal">Acessar Painel Fiscal</a>
                </div>

                <div class="access-card">
                    <div>
                        <div class="icon icon-dp"><i class="fas fa-users-cog"></i></div>
                        <h3>Gestão DP</h3>
                        <p>Controle completo do Departamento Pessoal. Atribua responsáveis e edite informações da folha de pagamento.</p>
                    </div>
                    <a href="dp_admin.php" class="btn-access btn-dp">Acessar Painel DP</a>
                </div>

                <div class="access-card">
                    <div>
                        <div class="icon icon-contabil"><i class="fas fa-calculator"></i></div>
                        <h3>Gestão Contábil</h3>
                        <p>Visão anual do fechamento contábil. Gerencie responsáveis e edite os status mensais e obrigações anuais.</p>
                    </div>
                    <a href="contabil_admin.php" class="btn-access btn-contabil">Acessar Painel Contábil</a>
                </div>
                <div class="access-card">
                    <div>
                        <div class="icon icon-cushman"><i class="fas fa-shield-alt"></i></div>
                        <h3>Gestão Cushman</h3>
                        <p>Acesso à tela de controle exclusiva para as empresas do grupo Cushman, com campos e obrigações específicas.</p>
                    </div>
                    <a href="cushman.php" class="btn-access btn-cushman">Acessar Painel Cushman</a>
                </div>

            </div>
        </div>
    </div>
    <div class="theme-toggle" id="themeToggle" title="Alterar Tema">
        <i class="fas fa-moon"></i>
    </div>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="scripts_globais.js"></script>
</body>

</html>