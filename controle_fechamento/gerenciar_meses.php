<?php
// gerenciar_meses.php (VERSÃO FINAL E COMPLETA)
require_once 'assets/backend/config.php';
session_start();

if (!isset($_SESSION['usuario_id']) || $_SESSION['tipo_conta'] !== 'admin') {
    $_SESSION['mensagem'] = 'Acesso não autorizado.';
    header('Location: dashboard.php');
    exit();
}

function obterTodosMeses($conexao)
{
    $query = "SELECT id, mes, ano FROM controle_meses ORDER BY ano DESC, mes DESC";
    $resultado = $conexao->query($query);
    return $resultado ? $resultado->fetch_all(MYSQLI_ASSOC) : [];
}

$todos_meses = obterTodosMeses($conexao);
?>
<!DOCTYPE html>
<html lang="pt-br" data-theme="light">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Central de Replicação de Meses</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link rel="stylesheet" href="assets/css/dashboard.css">

    <style>
        /* Estilos específicos para esta página, usando as variáveis globais */
        .page-header {
            background: var(--card-bg);
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 10px var(--shadow-color);
            border-bottom: 1px solid var(--border-color);
            backdrop-filter: blur(10px);
        }

        .page-header h1 {
            color: var(--primary-color);
            font-size: 1.5rem;
        }

        .main-container {
            padding: 2rem;
        }

        .card-container {
            max-width: 900px;
            margin: auto;
            background: var(--card-bg);
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 5px 25px var(--shadow-color);
            border: 1px solid var(--border-color);
            backdrop-filter: blur(10px);
        }

        .card-container h2 {
            font-size: 1.8rem;
            margin-bottom: 0.5rem;
            background: var(--primary-gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .card-container p {
            color: var(--text-muted);
            margin-bottom: 2rem;
        }

        .form-group {
            margin-bottom: 1.5rem;
        }

        .form-group label {
            font-weight: 600;
            color: var(--text-color);
            margin-bottom: 0.5rem;
            display: block;
        }

        select,
        input[type="number"],
        input[type="text"] {
            width: 100%;
            padding: 0.75rem 1rem;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            background: var(--input-bg);
            color: var(--text-color);
            font-size: 1rem;
            transition: all 0.3s ease;
        }

        select:focus,
        input:focus {
            outline: none;
            border-color: var(--primary-color);
            box-shadow: 0 0 0 3px rgba(106, 17, 203, 0.2);
        }

        .filters {
            display: grid;
            grid-template-columns: 1fr 1.5fr;
            gap: 1rem;
            margin-bottom: 1rem;
            align-items: end;
        }

        #filtro-pesquisa-container {
            position: relative;
        }

        #filtro-pesquisa-container .fa-search {
            position: absolute;
            top: 50%;
            left: 1rem;
            transform: translateY(-50%);
            color: var(--text-muted);
        }

        #filtro-pesquisa {
            padding-left: 2.5rem;
        }

        #filtro-setores {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
        }

        #filtro-setores button {
            padding: 0.5rem 1rem;
            border: 1px solid var(--border-color);
            background: var(--input-bg);
            color: var(--text-color);
            cursor: pointer;
            border-radius: 20px;
            font-size: 0.85rem;
            transition: all 0.3s ease;
        }

        #filtro-setores button:hover {
            background: var(--input-focus-bg);
        }

        #filtro-setores button.active {
            background: var(--primary-gradient);
            color: white;
            border-color: transparent;
            font-weight: 600;
        }

        #lista-empresas {
            border: 1px solid var(--border-color);
            padding: 1rem;
            max-height: 350px;
            overflow-y: auto;
            border-radius: 8px;
            background: var(--input-bg);
        }

        .empresa-item {
            display: block;
            padding: 0.75rem;
            border-radius: 6px;
            cursor: pointer;
            transition: background-color 0.2s ease;
        }

        .empresa-item:hover {
            background-color: var(--input-focus-bg);
        }

        .empresa-item input[type="checkbox"] {
            margin-right: 0.75rem;
            accent-color: var(--primary-color);
        }

        #contador-selecionados {
            margin-top: 1rem;
            font-weight: 500;
            color: var(--primary-color);
        }

        button[type="submit"] {
            width: 100%;
            font-size: 1.1rem;
        }

        #feedback {
            text-align: center;
            padding: 1rem;
            font-weight: bold;
            border-radius: 8px;
            margin-top: 1rem;
        }

        .hidden {
            display: none;
        }
    </style>
</head>

<body>

    <header class="page-header">
        <h1><i class="fas fa-cogs"></i> Central de Replicação</h1>
        <a href="dashboard.php" class="btn small-btn"><i class="fas fa-arrow-left"></i> Voltar ao Dashboard</a>
    </header>

    <main class="main-container">
        <div class="card-container">
            <h2>Replicar Dados</h2>
            <p>Use esta ferramenta para criar um novo mês ou adicionar empresas a um mês existente.</p>

            <form id="formReplicacao">
                <div class="form-group">
                    <label for="id_mes_base"><i class="fas fa-copy"></i> 1. Copiar dados DO Mês:</label>
                    <select id="id_mes_base" name="id_mes_base" required>
                        <option value="">-- Selecione um mês base --</option>
                        <?php foreach ($todos_meses as $mes): ?>
                            <option value="<?= $mes['id'] ?>"><?= str_pad($mes['mes'], 2, '0', STR_PAD_LEFT) . '/' . $mes['ano'] ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div class="form-group">
                    <label for="id_mes_destino"><i class="fas fa-file-import"></i> 2. Replicar PARA o Mês:</label>
                    <select id="id_mes_destino" name="id_mes_destino" required>
                        <option value="">-- Selecione um destino --</option>
                        <option value="criar_novo">--- CRIAR NOVO MÊS ---</option>
                        <?php foreach ($todos_meses as $mes): ?>
                            <option value="<?= $mes['id'] ?>"><?= str_pad($mes['mes'], 2, '0', STR_PAD_LEFT) . '/' . $mes['ano'] ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>

                <div id="campos-novo-mes" class="hidden" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label for="novo_mes">Mês de Destino:</label>
                        <input type="number" id="novo_mes" name="novo_mes" min="1" max="12" value="<?= date('n') ?>">
                    </div>
                    <div class="form-group">
                        <label for="novo_ano">Ano de Destino:</label>
                        <input type="number" id="novo_ano" name="novo_ano" min="2020" max="2050" value="<?= date('Y') ?>">
                    </div>
                </div>

                <div id="lista-empresas-container" class="form-group hidden">
                    <label><i class="fas fa-tasks"></i> 3. Empresas a Adicionar:</label>
                    <div class="filters">
                        <div id="filtro-pesquisa-container">
                            <label for="filtro-pesquisa">Pesquisar</label>
                            <i class="fas fa-search"></i>
                            <input type="text" id="filtro-pesquisa" placeholder="Código ou nome...">
                        </div>
                        <div>
                            <label>Filtrar por setor:</label>
                            <div id="filtro-setores"></div>
                        </div>
                    </div>

                    <div id="lista-empresas">
                        <p>Selecione um mês base e um destino.</p>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
                        <label style="margin: 0; font-weight: 500;"><input type="checkbox" id="selecionar-todas"> Selecionar Todas as Visíveis</label>
                        <div id="contador-selecionados"><strong>0</strong> empresas selecionadas</div>
                    </div>
                </div>

                <button type="submit" class="btn"><i class="fas fa-sync-alt"></i> Executar Replicação</button>
            </form>

            <div id="loading" class="hidden" style="text-align: center; padding: 1rem; font-weight: bold; color: var(--primary-color);">
                <i class="fas fa-spinner fa-spin"></i> Processando replicação... Por favor, aguarde.
            </div>
            <div id="feedback"></div>
        </div>
    </main>

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script>
        $(document).ready(function() {
            let todasAsEmpresas = [];

            // Funções auxiliares (atualizarContador, aplicarFiltros)
            function atualizarContador() {
                const count = $('#lista-empresas input[type="checkbox"]:checked').length;
                $('#contador-selecionados strong').text(count);
                $('#contador-selecionados').css('color', count > 0 ? 'var(--success-color)' : 'var(--primary-color)');
            }

            function aplicarFiltros() {
                const termoPesquisa = $('#filtro-pesquisa').val().toLowerCase();
                const setorAtivo = $('#filtro-setores button.active').data('setor') || 'todos';

                $('#lista-empresas .empresa-item').each(function() {
                    const label = $(this);
                    const empresa = label.data('empresa');

                    const matchSetor = (setorAtivo === 'todos') || (empresa.setores_permitidos && empresa.setores_permitidos.toLowerCase().includes(setorAtivo));
                    const matchPesquisa = (empresa.empresa.toLowerCase().includes(termoPesquisa) || empresa.codigo.toString().includes(termoPesquisa));

                    if (matchSetor && matchPesquisa) {
                        label.show();
                    } else {
                        label.hide();
                    }
                });
                $('#selecionar-todas').prop('checked', false);
            }

            // Função principal para carregar a lista de empresas disponíveis
            function carregarEmpresas() {
                const idMesBase = $('#id_mes_base').val();
                const idMesDestino = $('#id_mes_destino').val();
                const listaContainer = $('#lista-empresas-container');
                const listaEmpresasDiv = $('#lista-empresas');

                if (!idMesBase || !idMesDestino) {
                    listaContainer.addClass('hidden');
                    return;
                }

                listaContainer.removeClass('hidden');
                listaEmpresasDiv.html('<i class="fas fa-spinner fa-spin"></i> Carregando empresas disponíveis...');
                $('#filtro-setores').empty();
                $('#filtro-pesquisa').val('');

                const promessaBase = $.ajax({
                    url: 'obter_empresas_por_mes.php',
                    type: 'GET',
                    data: {
                        id_mes: idMesBase,
                        modo: 'completo'
                    },
                    dataType: 'json'
                });

                const promessaDestino = (idMesDestino !== 'criar_novo') ? $.ajax({
                    url: 'obter_empresas_por_mes.php',
                    type: 'GET',
                    data: {
                        id_mes: idMesDestino,
                        modo: 'apenas_cnpj'
                    },
                    dataType: 'json'
                }) : $.when({
                    success: true,
                    data: []
                });

                $.when(promessaBase, promessaDestino).done(function(resultadoBase, resultadoDestino) {
                    if (!resultadoBase[0].success || !resultadoDestino[0].success) {
                        listaEmpresasDiv.html('<p class="feedback-error">Erro ao carregar dados.</p>');
                        return;
                    }

                    const empresasBase = resultadoBase[0].data;
                    const cnpjsDestino = new Set(resultadoDestino[0].data);
                    const empresasParaMostrar = empresasBase.filter(emp => !cnpjsDestino.has(emp.cnpj));

                    todasAsEmpresas = empresasParaMostrar;

                    if (empresasParaMostrar.length === 0) {
                        listaEmpresasDiv.html('<p>Nenhuma nova empresa para adicionar. Todas as empresas do mês base já existem no mês de destino.</p>');
                        return;
                    }

                    let html = '';
                    let setores = new Set();
                    empresasParaMostrar.forEach(empresa => {
                        html += `<label class="empresa-item"><input type="checkbox" name="ids_empresas[]" value="${empresa.id}"> ${empresa.codigo} - ${empresa.empresa}</label>`;
                        if (empresa.setores_permitidos) {
                            empresa.setores_permitidos.split(',').forEach(setor => setores.add(setor.trim().toLowerCase()));
                        }
                    });
                    listaEmpresasDiv.html(html);

                    $('#lista-empresas .empresa-item').each(function(index) {
                        $(this).data('empresa', empresasParaMostrar[index]);
                    });

                    let setoresHtml = '<button type="button" class="active" data-setor="todos">Todos</button>';
                    Array.from(setores).sort().forEach(setor => {
                        if (setor) setoresHtml += `<button type="button" data-setor="${setor}">${setor.toUpperCase()}</button>`;
                    });
                    $('#filtro-setores').html(setoresHtml);

                    atualizarContador();
                });
            }

            // --- Gatilhos de Eventos ---
            $('#id_mes_destino, #id_mes_base').on('change', function() {
                if ($('#id_mes_destino').val() === 'criar_novo') {
                    $('#campos-novo-mes').slideDown();
                } else {
                    $('#campos-novo-mes').slideUp();
                }
                carregarEmpresas();
            });

            $('#filtro-pesquisa').on('keyup', aplicarFiltros);
            $(document).on('click', '#filtro-setores button', function() {
                $('#filtro-setores button').removeClass('active');
                $(this).addClass('active');
                aplicarFiltros();
            });

            $('#selecionar-todas').on('click', function() {
                const isChecked = $(this).prop('checked');
                $('#lista-empresas .empresa-item:visible input[type="checkbox"]').prop('checked', isChecked);
                atualizarContador();
            });

            $(document).on('click', '#lista-empresas input[type="checkbox"]', atualizarContador);

            $('#formReplicacao').on('submit', function(e) {
                e.preventDefault();
                if ($('#lista-empresas input[type="checkbox"]:checked').length === 0) {
                    alert('Por favor, selecione pelo menos uma empresa para replicar.');
                    return;
                }

                const feedbackDiv = $('#feedback');
                const loadingDiv = $('#loading');

                loadingDiv.show();
                feedbackDiv.text('').removeClass('alert alert-success alert-error');

                $.ajax({
                    url: 'replicar_mes_selecionado.php',
                    type: 'POST',
                    data: $(this).serialize(),
                    dataType: 'json',
                    success: function(response) {
                        if (response.success) {
                            feedbackDiv.addClass('alert alert-success').html(`<i class="fas fa-check-circle"></i> ${response.message}`);
                        } else {
                            feedbackDiv.addClass('alert alert-error').html(`<i class="fas fa-exclamation-triangle"></i> Erro: ${response.message}`);
                        }
                    },
                    error: function() {
                        feedbackDiv.addClass('alert alert-error').html('<i class="fas fa-exclamation-triangle"></i> Erro de comunicação com o servidor.');
                    },
                    complete: function() {
                        loadingDiv.hide();
                    }
                });
            });
        });
    </script>

</body>

</html>