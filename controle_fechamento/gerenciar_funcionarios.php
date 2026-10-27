<?php
require 'assets/backend/config.php';
session_start();

if (!isset($_SESSION['tipo_conta']) || $_SESSION['tipo_conta'] !== 'admin') {
    header('Location: index.php');
    exit();
}

$usuario_logado_id = (int)($_SESSION['usuario_id'] ?? 0);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    if (isset($_POST['adicionar_funcionario'])) {
        $nome_completo = trim($_POST['nome_completo'] ?? '');
        $usuario = trim($_POST['usuario'] ?? '');
        $senha = $_POST['senha'] ?? '';
        $tipo_conta = $_POST['tipo_conta'] ?? '';

        if (empty($nome_completo) || empty($usuario) || empty($senha) || empty($tipo_conta)) {
            $erro = "Todos os campos são obrigatórios!";
        } else {
            $sql_verificar = "SELECT id FROM usuarios WHERE usuario = ?";
            $stmt = $conexao->prepare($sql_verificar);
            $stmt->bind_param('s', $usuario);
            $stmt->execute();

            if ($stmt->get_result()->num_rows > 0) {
                $erro = "Este nome de usuário já está em uso!";
            } else {
                $senha_hash = password_hash($senha, PASSWORD_DEFAULT);

                $sql_inserir = "INSERT INTO usuarios (nome, usuario, senha, tipo_conta, ativo) VALUES (?, ?, ?, ?, 1)";
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

    if (isset($_POST['editar_funcionario'])) {
        $id = (int)($_POST['id'] ?? 0);
        $nome_completo = trim($_POST['nome_completo'] ?? '');
        $usuario = trim($_POST['usuario'] ?? '');
        $tipo_conta = $_POST['tipo_conta'] ?? '';
        $senha = $_POST['senha'] ?? '';

        if (empty($nome_completo) || empty($usuario) || empty($tipo_conta)) {
            $erro_edicao = "Todos os campos, exceto a senha, são obrigatórios!";
        } else {
            $sql_verificar = "SELECT id FROM usuarios WHERE usuario = ? AND id != ?";
            $stmt = $conexao->prepare($sql_verificar);
            $stmt->bind_param('si', $usuario, $id);
            $stmt->execute();

            if ($stmt->get_result()->num_rows > 0) {
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

    if (isset($_POST['alterar_status'])) {
        $id = (int)($_POST['id'] ?? 0);
        $ativo_atual = (int)($_POST['ativo'] ?? 0);

        if ($id === $usuario_logado_id) {
            $erro = "Você não pode inativar o próprio usuário logado.";
        } else {
            $novo_status = $ativo_atual ? 0 : 1;

            $sql_status = "UPDATE usuarios SET ativo = ? WHERE id = ?";
            $stmt = $conexao->prepare($sql_status);
            $stmt->bind_param('ii', $novo_status, $id);

            if ($stmt->execute()) {
                $sucesso = $novo_status
                    ? "Funcionário ativado com sucesso!"
                    : "Funcionário inativado com sucesso!";
            } else {
                $erro = "Erro ao alterar status do funcionário: " . $conexao->error;
            }
        }
    }
}

$funcionarios = [];
$sql_funcionarios = "
    SELECT id, nome, usuario, tipo_conta, ativo
    FROM usuarios
    ORDER BY ativo DESC, nome ASC
";

$result_funcionarios = $conexao->query($sql_funcionarios);

if ($result_funcionarios) {
    $funcionarios = $result_funcionarios->fetch_all(MYSQLI_ASSOC);
}

function getInitials($name)
{
    $name = trim($name ?? '');
    $words = explode(' ', $name);

    if (empty($words[0])) {
        return '';
    }

    $initials = mb_substr($words[0], 0, 1);

    if (count($words) > 1) {
        $initials .= mb_substr(end($words), 0, 1);
    }

    return mb_strtoupper($initials);
}

function formatarTipoConta($tipo)
{
    return ucfirst(str_replace('_', ' ', $tipo ?? ''));
}
?>

<!DOCTYPE html>
<html lang="pt-br" data-theme="light">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gerenciar Funcionários</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link rel="stylesheet" href="assets/css/gerenciar_funcionarios.css">
</head>

<body>
    <div class="background-waves"></div>

    <header class="header">
        <h1><i class="fas fa-users-cog"></i> Gerenciar Funcionários</h1>
        <a href="dashboard.php" class="btn header-btn">
            <i class="fas fa-arrow-left"></i> Voltar ao Painel
        </a>
    </header>

    <main class="main-content">
        <div class="card user-management-card">
            <div class="card-notifications">
                <?php if (!empty($sucesso)): ?>
                    <div class="alert alert-success"><?= htmlspecialchars($sucesso ?? '') ?></div>
                <?php endif; ?>

                <?php if (!empty($erro)): ?>
                    <div class="alert alert-error"><?= htmlspecialchars($erro ?? '') ?></div>
                <?php endif; ?>
            </div>

            <div class="tabs">
                <button class="tab-btn active" data-tab="list-tab">
                    <i class="fas fa-list-ul"></i> Lista de Funcionários
                </button>

                <button class="tab-btn" data-tab="add-tab">
                    <i class="fas fa-user-plus"></i> Adicionar Novo
                </button>
            </div>

            <div class="tab-content active" id="list-tab">
                <div class="table-header">
                    <h3>Total de <?= count($funcionarios) ?> Funcionários</h3>

                    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                        <div class="search-container">
                            <i class="fas fa-search"></i>
                            <input
                                type="text"
                                id="search-input"
                                class="form-control"
                                placeholder="Buscar funcionário...">
                        </div>

                        <select
                            id="status-filter"
                            class="form-control"
                            style="width:170px;">
                            <option value="">Todos</option>
                            <option value="1">Ativos</option>
                            <option value="0">Inativos</option>
                        </select>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="user-table">
                        <thead>
                            <tr>
                                <th style="width: 70px;"></th>
                                <th>Nome</th>
                                <th>Tipo de Conta</th>
                                <th>Status</th>
                                <th class="action-cell">Ações</th>
                            </tr>
                        </thead>

                        <tbody>
                            <?php if (empty($funcionarios)): ?>
                                <tr>
                                    <td colspan="5" style="text-align:center; padding: 2rem;">
                                        Nenhum funcionário encontrado.
                                    </td>
                                </tr>
                            <?php else: ?>
                                <?php foreach ($funcionarios as $funcionario): ?>
                                    <?php
                                    $idFuncionario = (int)($funcionario['id'] ?? 0);
                                    $ativo = (int)($funcionario['ativo'] ?? 1);
                                    ?>

                                    <tr
                                        class="<?= $ativo ? '' : 'usuario-inativo' ?>"
                                        data-status="<?= $ativo ?>">
                                        <td>
                                            <div class="user-avatar">
                                                <?= htmlspecialchars(getInitials($funcionario['nome'] ?? '')) ?>
                                            </div>
                                        </td>

                                        <td>
                                            <div class="user-info">
                                                <span class="nome">
                                                    <?= htmlspecialchars($funcionario['nome'] ?? '') ?>
                                                </span>

                                                <span class="usuario">
                                                    @<?= htmlspecialchars($funcionario['usuario'] ?? '') ?>
                                                </span>
                                            </div>
                                        </td>

                                        <td>
                                            <span class="badge badge-<?= htmlspecialchars($funcionario['tipo_conta'] ?? '') ?>">
                                                <?= htmlspecialchars(formatarTipoConta($funcionario['tipo_conta'] ?? '')) ?>
                                            </span>
                                        </td>

                                        <td>
                                            <?php if ($ativo): ?>
                                                <span class="badge badge-success">Ativo</span>
                                            <?php else: ?>
                                                <span class="badge badge-danger">Inativo</span>
                                            <?php endif; ?>
                                        </td>

                                        <td class="action-cell">
                                            <button
                                                type="button"
                                                class="btn btn-small btn-edit"
                                                data-id="<?= $idFuncionario ?>"
                                                data-nome="<?= htmlspecialchars($funcionario['nome'] ?? '') ?>"
                                                data-usuario="<?= htmlspecialchars($funcionario['usuario'] ?? '') ?>"
                                                data-tipo="<?= htmlspecialchars($funcionario['tipo_conta'] ?? '') ?>">
                                                <i class="fas fa-pencil-alt"></i> Editar
                                            </button>

                                            <?php if ($idFuncionario !== $usuario_logado_id): ?>
                                                <form method="POST" style="display:inline;">
                                                    <input type="hidden" name="id" value="<?= $idFuncionario ?>">
                                                    <input type="hidden" name="ativo" value="<?= $ativo ?>">

                                                    <button
                                                        type="submit"
                                                        name="alterar_status"
                                                        class="btn btn-small <?= $ativo ? 'btn-danger' : 'btn-success' ?>"
                                                        onclick="return confirm('Deseja realmente <?= $ativo ? 'inativar' : 'ativar' ?> este usuário?');">
                                                        <i class="fas <?= $ativo ? 'fa-user-slash' : 'fa-user-check' ?>"></i>
                                                        <?= $ativo ? 'Inativar' : 'Ativar' ?>
                                                    </button>
                                                </form>
                                            <?php else: ?>
                                                <button
                                                    type="button"
                                                    class="btn btn-small btn-disabled"
                                                    disabled
                                                    title="Você não pode inativar seu próprio usuário">
                                                    <i class="fas fa-lock"></i> Usuário atual
                                                </button>
                                            <?php endif; ?>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="tab-content" id="add-tab">
                <h3>Adicionar Novo Funcionário</h3>

                <form method="POST" class="user-form">
                    <div class="form-group">
                        <label for="nome_completo">
                            <i class="fas fa-user"></i> Nome Completo
                        </label>

                        <input
                            type="text"
                            name="nome_completo"
                            class="form-control"
                            required
                            placeholder="Ex: João da Silva">
                    </div>

                    <div class="form-group">
                        <label for="usuario">
                            <i class="fas fa-at"></i> Nome de Usuário
                        </label>

                        <input
                            type="text"
                            name="usuario"
                            class="form-control"
                            required
                            placeholder="Ex: joao.silva">
                    </div>

                    <div class="form-group">
                        <label for="senha">
                            <i class="fas fa-lock"></i> Senha
                        </label>

                        <input
                            type="password"
                            name="senha"
                            class="form-control"
                            required
                            placeholder="••••••••">
                    </div>

                    <div class="form-group">
                        <label for="tipo_conta">
                            <i class="fas fa-user-shield"></i> Tipo de Conta
                        </label>

                        <select name="tipo_conta" class="form-control" required>
                            <option value="">Selecione um tipo</option>
                            <option value="dp">Departamento Pessoal</option>
                            <option value="fiscal">Fiscal</option>
                            <option value="contabil">Contábil</option>
                            <option value="cadastro">Cadastro</option>
                            <option value="lider_dp">Líder DP</option>
                            <option value="lider_fiscal">Líder Fiscal</option>
                            <option value="lider_contabil">Líder Contábil</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>

                    <div class="form-actions">
                        <button type="submit" name="adicionar_funcionario" class="btn">
                            <i class="fas fa-check"></i> Salvar Funcionário
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </main>

    <div class="modal" id="editFuncionarioModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="modal-title">
                    <i class="fas fa-user-edit"></i> Editar Funcionário
                </h3>

                <button class="modal-close">&times;</button>
            </div>

            <div class="modal-body">
                <form method="POST" class="user-form">
                    <input type="hidden" name="id" id="edit-id">

                    <div class="form-group">
                        <label for="edit-nome-completo">
                            <i class="fas fa-user"></i> Nome Completo
                        </label>

                        <input
                            type="text"
                            id="edit-nome-completo"
                            name="nome_completo"
                            class="form-control"
                            required>
                    </div>

                    <div class="form-group">
                        <label for="edit-usuario">
                            <i class="fas fa-at"></i> Nome de Usuário
                        </label>

                        <input
                            type="text"
                            id="edit-usuario"
                            name="usuario"
                            class="form-control"
                            required>
                    </div>

                    <div class="form-group">
                        <label for="edit-tipo-conta">
                            <i class="fas fa-user-shield"></i> Tipo de Conta
                        </label>

                        <select id="edit-tipo-conta" name="tipo_conta" class="form-control" required>
                            <option value="">Selecione um tipo</option>
                            <option value="dp">Departamento Pessoal</option>
                            <option value="fiscal">Fiscal</option>
                            <option value="contabil">Contábil</option>
                            <option value="cadastro">Cadastro</option>
                            <option value="lider_dp">Líder DP</option>
                            <option value="lider_fiscal">Líder Fiscal</option>
                            <option value="lider_contabil">Líder Contábil</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="edit-senha">
                            <i class="fas fa-lock"></i> Nova Senha (Opcional)
                        </label>

                        <input
                            type="password"
                            id="edit-senha"
                            name="senha"
                            class="form-control"
                            placeholder="Deixe em branco para não alterar">
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn btn-outline modal-close">
                            <i class="fas fa-times"></i> Cancelar
                        </button>

                        <button type="submit" name="editar_funcionario" class="btn">
                            <i class="fas fa-save"></i> Salvar Alterações
                        </button>
                    </div>
                </form>

                <div class="modal-notifications">
                    <?php if (isset($erro_edicao)): ?>
                        <div class="alert alert-error" style="margin-top: 1rem;">
                            <?= htmlspecialchars($erro_edicao ?? '') ?>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
        </div>
    </div>

    <div class="theme-toggle" id="themeToggle" title="Alterar Tema">
        <i class="fas fa-moon"></i>
    </div>

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>

    <script>
        $(document).ready(function() {

            $('.tab-btn').on('click', function() {
                const tabId = $(this).data('tab');

                $('.tab-btn').removeClass('active');
                $(this).addClass('active');

                $('.tab-content').removeClass('active').hide();
                $('#' + tabId).addClass('active').fadeIn('fast');
            });

            $('.btn-edit').on('click', function() {
                const id = $(this).data('id');
                const nome = $(this).data('nome');
                const usuario = $(this).data('usuario');
                const tipo = $(this).data('tipo');

                $('#edit-id').val(id);
                $('#edit-nome-completo').val(nome);
                $('#edit-usuario').val(usuario);
                $('#edit-tipo-conta').val(tipo);
                $('#edit-senha').val('');

                $('#editFuncionarioModal .modal-notifications').empty();
                $('#editFuncionarioModal').fadeIn();
            });

            $('.modal-close').on('click', function() {
                $(this).closest('.modal').fadeOut();
            });

            $('.modal').on('click', function(e) {
                if ($(e.target).is('.modal')) {
                    $(this).fadeOut();
                }
            });

            $(document).on('keydown', function(e) {
                if (e.key === 'Escape') {
                    $('.modal').fadeOut();
                }
            });

            <?php if (isset($erro_edicao)): ?>
                const failedId = <?= (int)($_POST['id'] ?? 0) ?>;

                if (failedId > 0) {
                    $(`.btn-edit[data-id="${failedId}"]`).click();

                    $('#editFuncionarioModal .modal-notifications').html(
                        '<div class="alert alert-error" style="margin-top: 1rem;"><?= htmlspecialchars($erro_edicao ?? '') ?></div>'
                    );
                }
            <?php elseif (isset($sucesso_edicao)): ?>
                mostrarNotificacao('<?= htmlspecialchars($sucesso_edicao ?? '') ?>', 'success');
            <?php endif; ?>

            function aplicarFiltrosUsuarios() {
                const busca = ($('#search-input').val() || '').toLowerCase();
                const status = $('#status-filter').val();

                $('.user-table tbody tr').each(function() {
                    const texto = $(this).text().toLowerCase();
                    const statusLinha = String($(this).data('status') ?? '');

                    let mostrar = true;

                    if (busca && !texto.includes(busca)) {
                        mostrar = false;
                    }

                    if (status !== '' && statusLinha !== status) {
                        mostrar = false;
                    }

                    $(this).toggle(mostrar);
                });
            }

            $('#search-input').on('keyup', aplicarFiltrosUsuarios);
            $('#status-filter').on('change', aplicarFiltrosUsuarios);

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
                            notificacao.remove();
                        });
                    }, 3000);
                });
            }
        });
    </script>

    <script src="scripts_globais.js"></script>
</body>

</html>