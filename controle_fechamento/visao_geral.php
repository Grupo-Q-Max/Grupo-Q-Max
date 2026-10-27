<?php
session_start();
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once 'assets/backend/config.php';
require_once 'assets/backend/functions/funcoes_gerais.php';

if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['tipo_conta'], ['admin','lider_fiscal', 'cs', 'cadastro'])) {
    $_SESSION['mensagem'] = 'Acesso restrito.';
    header('Location: index.php');
    exit();
}

$lista_completa_tributacoes = [
    'MEI',
    'Simples Nacional',
    'Lucro Presumido',
    'Lucro Real/Trimestral',
    'Lucro Real/Estimativa',
    'Lucro Real/Anual',
    'Imune IRPJ',
    'Condomínios',
    'Doméstica',
    'Associações'
];

$filtros = [
    'busca'      => $_GET['busca'] ?? '',
    'tributacao' => $_GET['tributacao'] ?? '',
    'grupo'      => $_GET['grupo'] ?? '',
    'status'     => $_GET['status'] ?? 'ativas',
    'setor'      => $_GET['setor'] ?? '',
    'sort'       => $_GET['sort'] ?? 'empresa',
    'dir'        => $_GET['dir'] ?? 'ASC'
];

$tributacoes_disponiveis = obterValoresDistintos($conexao, 'tributacao');
$grupos_disponiveis      = obterValoresDistintos($conexao, 'grupo');

$empresas = obterEmpresasUnicas($conexao, $filtros);

function criarLinkOrdenacao($coluna, $filtros)
{
    $direcao_atual = $filtros['dir'] ?? 'ASC';
    $coluna_atual = $filtros['sort'] ?? 'empresa';
    $nova_direcao = ($coluna_atual === $coluna && $direcao_atual === 'ASC') ? 'DESC' : 'ASC';
    $icone = 'fa-sort';
    if ($coluna_atual === $coluna) {
        $icone = ($direcao_atual === 'ASC') ? 'fa-sort-up' : 'fa-sort-down';
    }
    $parametros_url = http_build_query(array_merge($filtros, ['sort' => $coluna, 'dir' => $nova_direcao]));
    return "<a href=\"?{$parametros_url}\" class=\"sort-link\"> <i class=\"fas {$icone}\"></i></a>";
}

$url_voltar = 'dashboard.php';
if (isset($_SESSION['tipo_conta']) && in_array($_SESSION['tipo_conta'], ['cs', 'cadastro'])) {
    $url_voltar = 'cadastrar.php';
}
?>
<!DOCTYPE html>
<html lang="pt-br">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cadastro de Empresas - Admin</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/visao_geral.css">
</head>

<body>
    <header class="header">
        <h1><i class="fas fa-building"></i> Cadastro de Empresas</h1>
        <a href="<?= htmlspecialchars($url_voltar) ?>" class="btn-voltar"><i class="fas fa-arrow-left"></i> Voltar</a>
    </header>

    <div class="main-content">
        <div class="filter-panel">
            <form method="GET" id="form-filtros-select">
                <div class="row g-3">
                    <div class="col-md-6">
                        <label for="busca" class="form-label"><i class="fas fa-search"></i> Pesquisar</label>
                        <input type="text" name="busca" class="form-control" placeholder="Nome, CNPJ, Código..." value="<?= htmlspecialchars($filtros['busca']) ?>">
                    </div>
                    <div class="col-md-3">
                        <label for="filtro-tributacao" class="form-label"><i class="fas fa-tag"></i> Tributação</label>
                        <select id="filtro-tributacao" name="tributacao" class="form-select">
                            <option value="">Todas</option>
                            <?php foreach ($tributacoes_disponiveis as $item): ?>
                                <option value="<?= htmlspecialchars($item) ?>" <?= ($filtros['tributacao'] == $item) ? 'selected' : '' ?>><?= htmlspecialchars(ucwords(str_replace('_', ' ', $item))) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label for="filtro-setor" class="form-label"><i class="fas fa-sitemap"></i> Setor Permitido</label>
                        <select id="filtro-setor" name="setor" class="form-select">
                            <option value="">Todos</option>
                            <option value="dp" <?= ($filtros['setor'] == 'dp') ? 'selected' : '' ?>>DP</option>
                            <option value="fiscal" <?= ($filtros['setor'] == 'fiscal') ? 'selected' : '' ?>>Fiscal</option>
                            <option value="contabil" <?= ($filtros['setor'] == 'contabil') ? 'selected' : '' ?>>Contábil</option>
                            <option value="cushman" <?= ($filtros['setor'] == 'cushman') ? 'selected' : '' ?>>Cushman</option>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label for="filtro-grupo" class="form-label"><i class="fas fa-users"></i> Grupo</label>
                        <select id="filtro-grupo" name="grupo" class="form-select">
                            <option value="">Todos</option>
                            <?php foreach ($grupos_disponiveis as $item): ?>
                                <option value="<?= htmlspecialchars($item) ?>" <?= ($filtros['grupo'] == $item) ? 'selected' : '' ?>><?= htmlspecialchars($item) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="col-md-3">
                        <label for="filtro-status" class="form-label"><i class="fas fa-power-off"></i> Status</label>
                        <select id="filtro-status" name="status" class="form-select">
                            <option value="ativas" <?= ($filtros['status'] == 'ativas') ? 'selected' : '' ?>>Apenas Ativas</option>
                            <option value="inativas" <?= ($filtros['status'] == 'inativas') ? 'selected' : '' ?>>Apenas Inativas</option>
                            <option value="todas" <?= ($filtros['status'] == 'todas') ? 'selected' : '' ?>>Todas (Ativas e Inativas)</option>
                        </select>
                    </div>

                    <div class="col-md-3">
                        <label class="form-label">&nbsp;</label> <button type="submit" class="btn btn-primary w-100"><i class="fas fa-filter"></i> Filtrar</button>
                    </div>
                    <div class="col-md-3">
                        <label class="form-label">&nbsp;</label>
                        <div class="d-flex gap-2">
                            <a href="visao_geral.php" class="btn btn-secondary flex-grow-1">Limpar</a>
                            <button type="button" class="btn btn-success flex-grow-1" id="btn-exportar-csv">
                                <i class="fas fa-file-csv"></i> Exportar
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
        <div class="row mt-3">
            <div class="col-12">
                <label for="busca-geral" class="form-label"><i class="fas fa-search"></i> Pesquisa Rápida na Tabela</label>
                <input type="text" id="busca-geral" class="form-control" placeholder="Digite nome, CNPJ ou código para filtrar a lista abaixo instantaneamente...">
            </div>
        </div>
    </div>
    <div class="table-container">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Ações</th>
                    <th>Setores Perm.</th>
                    <th>Código <?= criarLinkOrdenacao('codigo', $filtros); ?></th>
                    <th>Empresa <?= criarLinkOrdenacao('empresa', $filtros); ?></th>
                    <th>CNPJ</th>
                    <th>Grupo</th>
                    <th>Tributação <?= criarLinkOrdenacao('tributacao', $filtros); ?></th>
                    <th>Data Contrato</th>
                    <th>Data Saída</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($empresas)): ?>
                    <tr>
                        <td colspan="9" class="text-center">Nenhuma empresa encontrada.</td>
                    </tr>
                <?php else: ?>
                    <?php foreach ($empresas as $empresa): ?>
                        <tr>
                            <td>
                                <button class="btn btn-sm btn-warning editar-empresa-btn" data-id="<?= $empresa['id'] ?>">
                                    <i class="fas fa-edit"></i> Editar
                                </button>
                            </td>
                            <td>
                                <?= htmlspecialchars(empty($empresa['setores_permitidos']) ? 'Todos' : $empresa['setores_permitidos']) ?>
                            </td>
                            <td><?= htmlspecialchars($empresa['codigo']) ?></td>
                            <td><?= htmlspecialchars($empresa['empresa']) ?></td>
                            <td><?= htmlspecialchars($empresa['cnpj']) ?></td>
                            <td><?= htmlspecialchars($empresa['grupo'] ?? '') ?></td>
                            <td><?= htmlspecialchars($empresa['tributacao'] ?? '') ?></td>
                            <td><?= !empty($empresa['data_contrato']) ? date('d/m/Y', strtotime($empresa['data_contrato'])) : '' ?></td>
                            <td><?= !empty($empresa['data_saida']) ? date('d/m/Y', strtotime($empresa['data_saida'])) : 'N/A' ?></td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
    </div>

    <div id="editarEmpresaModal" class="modal-overlay">
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-edit"></i> Editar Empresa</h3>
                <button class="modal-close">&times;</button>
            </div>
            <form id="formEditarEmpresa">
                <div class="modal-body">
                    <input type="hidden" name="id" id="edit-id">

                    <h4>Dados da Empresa</h4>
                    <div class="row g-3">
                        <div class="col-md-4">
                            <label for="edit-codigo" class="form-label">Código</label>
                            <input type="text" name="codigo" id="edit-codigo" class="form-control">
                        </div>
                        <div class="col-md-8">
                            <label for="edit-empresa" class="form-label">Empresa</label>
                            <input type="text" name="empresa" id="edit-empresa" class="form-control">
                        </div>
                        <div class="col-md-6">
                            <label for="edit-cnpj" class="form-label">CNPJ</label>
                            <input type="text" name="cnpj" id="edit-cnpj" class="form-control">
                        </div>
                        <div class="col-md-6">
                            <label for="edit-grupo" class="form-label">Grupo</label>
                            <input type="text" name="grupo" id="edit-grupo" class="form-control">
                        </div>
                    </div>

                    <hr class="my-4">
                    <h4>Dados Cadastrais</h4>
                    <div class="row g-3">
                        <div class="col-md-6">
                            <label for="edit-insc_municipal" class="form-label">Inscrição Municipal</label>
                            <input type="text" name="insc_municipal" id="edit-insc_municipal" class="form-control">
                        </div>
                        <div class="col-md-6">
                            <label for="edit-insc_estadual" class="form-label">Inscrição Estadual</label>
                            <input type="text" name="insc_estadual" id="edit-insc_estadual" class="form-control">
                        </div>
                        <div class="col-md-6">
                            <label for="edit-municipio" class="form-label">Município</label>
                            <input type="text" name="municipio" id="edit-municipio" class="form-control">
                        </div>
                        <div class="col-md-6">
                            <label for="edit-tributacao" class="form-label">Tributação</label>
                            <select name="tributacao" id="edit-tributacao" class="form-select">
                                <option value="">Selecione...</option>
                                <?php foreach ($lista_completa_tributacoes as $tributacao_opcao): ?>
                                    <?php $valor_padronizado = str_replace(' ', '_', strtolower($tributacao_opcao)); ?>
                                    <option value="<?= htmlspecialchars($valor_padronizado) ?>"><?= htmlspecialchars($tributacao_opcao) ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>
                    <hr class="my-4">
                    <h4>Certificado Digital e Procuração</h4>
                    <div class="row g-3">
                        <div class="col-md-4">
                            <label for="edit-certificado_cliente" class="form-label">Cert. Cliente</label>
                            <select name="certificado_cliente" id="edit-certificado_cliente" class="form-select">
                                <option value="">Selecione...</option>
                                <option value="Sim">Sim</option>
                                <option value="Não">Não</option>
                            </select>
                        </div>
                        <div class="col-md-4">
                            <label for="edit-tipo_certificado" class="form-label">Tipo Certificado</label>
                            <input type="text" name="tipo_certificado" id="edit-tipo_certificado" class="form-control">
                        </div>
                        <div class="col-md-4">
                            <label for="edit-senha_certificado" class="form-label">Senha Certificado</label>
                            <input type="text" name="senha_certificado" id="edit-senha_certificado" class="form-control">
                        </div>
                        <div class="col-md-4">
                            <label for="edit-data_emissao_certificado" class="form-label">Emissão Cert.</label>
                            <input type="date" name="data_emissao_certificado" id="edit-data_emissao_certificado" class="form-control">
                        </div>
                        <div class="col-md-4">
                            <label for="edit-data_vencimento_certificado" class="form-label">Vencimento Cert.</label>
                            <input type="date" name="data_vencimento_certificado" id="edit-data_vencimento_certificado" class="form-control">
                        </div>
                        <div class="col-md-4">
                            <label for="edit-data_procuracao_target" class="form-label">Procuração Target</label>
                            <input type="date" name="data_procuracao_target" id="edit-data_procuracao_target" class="form-control">
                        </div>
                    </div>
                    <hr class="my-4">
                    <h4>Acessos e Senhas</h4>
                    <div class="row g-3">
                        <div class="col-md-4">
                            <label for="edit-login_prefeitura" class="form-label">Login Prefeitura</label>
                            <input type="text" name="login_prefeitura" id="edit-login_prefeitura" class="form-control">
                        </div>
                        <div class="col-md-4">
                            <label for="edit-senha_prefeitura_ginfes" class="form-label">Senha GINFES</label>
                            <input type="text" name="senha_prefeitura_ginfes" id="edit-senha_prefeitura_ginfes" class="form-control">
                        </div>
                        <div class="col-md-4">
                            <label for="edit-senha_giss_online" class="form-label">Senha GISS</label>
                            <input type="text" name="senha_giss_online" id="edit-senha_giss_online" class="form-control">
                        </div>
                    </div>

                    <hr class="my-4">
                    <h4>Datas Importantes</h4>
                    <div class="row g-3">
                        <div class="col-md-4">
                            <label for="edit-data_contrato">Data Contrato</label>
                            <input type="date" name="data_contrato" id="edit-data_contrato" class="form-control">
                        </div>
                        <div class="col-md-4">
                            <label for="edit-data_obrigacao">Data Obrigação</label>
                            <input type="date" name="data_obrigacao" id="edit-data_obrigacao" class="form-control">
                        </div>
                        <div class="col-md-4">
                            <label for="edit-data_saida">Data Saída</label>
                            <input type="date" name="data_saida" id="edit-data_saida" class="form-control">
                        </div>
                    </div>

                    <hr class="my-4">
                    <h4>Configurações e Observações</h4>
                    <div class="row g-3">
                        <div class="col-md-4">
                            <label for="edit-observacao-setor" class="form-label">Setor da Observação</label>
                            <select name="observacao_setor" id="edit-observacao-setor" class="form-select">
                                <option value="fiscal" selected>Fiscal</option>
                                <option value="dp">DP</option>
                                <option value="contabil">Contábil</option>
                                <option value="cushman">Cushman</option>
                            </select>
                        </div>
                        <div class="col-md-8">
                            <label for="edit-observacoes" class="form-label">Texto da Observação</label>
                            <textarea name="observacao_texto" id="edit-observacoes" class="form-control" rows="3"></textarea>
                        </div>
                        <div class="col-md-12">
                            <label class="form-label">Setores Permitidos (Apenas os selecionados terão acesso)</label>
                            <div id="edit-setores_permitidos_checkboxes" class="d-flex flex-wrap gap-3 mt-1 p-2 border rounded">
                                <?php $setores_disponiveis = ['fiscal', 'dp', 'contabil', 'cushman'];
                                foreach ($setores_disponiveis as $setor): ?>
                                    <div class="form-check">
                                        <input class="form-check-input setor-checkbox" type="checkbox" value="<?= htmlspecialchars($setor) ?>" id="edit-setor-<?= htmlspecialchars($setor) ?>" name="setores_permitidos_array[]">
                                        <label class="form-check-label" for="edit-setor-<?= htmlspecialchars($setor) ?>"><?= ucfirst($setor) ?></label>
                                    </div>
                                <?php endforeach; ?>
                                <p class="form-text w-100 mt-1 mb-0">Se <strong>nenhum</strong> setor for marcado, o acesso será liberado para Todos.</p>
                            </div>
                            <input type="hidden" name="setores_permitidos" id="edit-setores_permitidos_hidden">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Salvar Alterações</button>
                    <button type="button" class="btn btn-danger" id="btn-replicar-empresa">
                        <i class="fas fa-copy"></i> Alterar Tributação e Replicar
                    </button>
                </div>
            </form>
        </div>
    </div>

    <div id="replicarEmpresaModal" class="modal-overlay">
        <div class="modal-container" style="max-width: 600px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-copy text-danger"></i> Replicar Empresa por Mudança de Tributação</h3>
                <button class="modal-close" id="closeReplicarModal">&times;</button>
            </div>
            <form id="formReplicarEmpresa">
                <div class="modal-body">
                    <input type="hidden" name="id_antigo" id="replicar-id-antigo">
                    <p class="alert alert-warning"><b>Atenção:</b> Esta ação é irreversível. Ela irá definir uma data de saída para a empresa atual e criar uma nova entrada com a nova tributação.</p>

                    <div class="mb-3">
                        <label>Empresa</label>
                        <input type="text" id="replicar-nome-empresa" class="form-control" readonly>
                    </div>

                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label for="replicar-novo-codigo" class="form-label required">Novo Código</label>
                            <input type="text" name="novo_codigo" id="replicar-novo-codigo" class="form-control" required>
                        </div>
                        <div class="col-md-6 mb-3">
                            <label for="replicar-data-inicio" class="form-label required">Data de Início da Nova Tributação</label>
                            <input type="date" name="data_inicio" id="replicar-data-inicio" class="form-control" required>
                        </div>
                    </div>

                    <div class="mb-3">
                        <label for="replicar-nova-tributacao" class="form-label required">Nova Tributação</label>
                        <select name="nova_tributacao" id="replicar-nova-tributacao" class="form-select" required>
                            <option value="">Selecione a nova tributação...</option>
                            <?php foreach ($lista_completa_tributacoes as $tributacao_opcao): ?>
                                <?php $valor_padronizado = str_replace(' ', '_', strtolower($tributacao_opcao)); ?>
                                <option value="<?= htmlspecialchars($valor_padronizado) ?>"><?= htmlspecialchars($tributacao_opcao) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="submit" class="btn btn-danger"><i class="fas fa-check"></i> Confirmar Replicação</button>
                </div>
            </form>
        </div>
    </div>

    <div id="modalOpcoesExportacao" class="modal-overlay">
        <div class="modal-container" style="max-width: 450px;">
            <div class="modal-header">
                <h3 class="modal-title"><i class="fas fa-file-export"></i> Opções de Exportação</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p>Selecione como deseja ordenar os dados no arquivo Excel:</p>

                <div class="mb-3">
                    <label for="export-sort" class="form-label">Ordenar Por:</label>
                    <select id="export-sort" class="form-select">
                        <option value="empresa" selected>Nome da Empresa</option>
                        <option value="codigo">Código</option>
                        <option value="tributacao">Tributação</option>
                        <option value="grupo">Grupo</option>
                        <option value="data_contrato">Data de Contrato</option>
                    </select>
                </div>

                <div class="mb-3">
                    <label for="export-dir" class="form-label">Ordem:</label>
                    <select id="export-dir" class="form-select">
                        <option value="ASC" selected>Crescente (A-Z / 0-9)</option>
                        <option value="DESC">Decrescente (Z-A / 9-0)</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary modal-close">Cancelar</button>
                <button type="button" class="btn btn-success" id="btn-confirmar-download">
                    <i class="fas fa-download"></i> Baixar Relatório
                </button>
            </div>
        </div>
    </div>

    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        function loadCheckboxes(setoresString) {
            $('.setor-checkbox').prop('checked', false);
            if (setoresString) {
                const setoresArray = setoresString.split(',').map(s => s.trim());
                setoresArray.forEach(setor => {
                    $(`#edit-setor-${setor}`).prop('checked', true);
                });
            }
        }

        function updateHiddenSetores() {
            const setoresSelecionados = $('.setor-checkbox:checked').map(function() {
                return this.value;
            }).get();
            $('#edit-setores_permitidos_hidden').val(setoresSelecionados.join(','));
        }

        $(document).ready(function() {

            $('#busca-geral').on('keyup', function() {
                const searchTerm = $(this).val().toLowerCase();
                $('.data-table tbody tr').each(function() {
                    const rowText = $(this).text().toLowerCase();
                    $(this).toggle(rowText.includes(searchTerm));
                });
            });

            // 1. Ao clicar em "Exportar" na tela principal, ABRE O MODAL
            $('#btn-exportar-csv').click(function(e) {
                e.preventDefault();
                $('#modalOpcoesExportacao').addClass('active');
            });

            // 2. Ao clicar em "Baixar Relatório" DENTRO do modal
            $('#btn-confirmar-download').click(function() {
                // Pega os filtros que já estão na tela (busca, setor, etc)
                const filtrosAtuais = $('#form-filtros-select').serialize();

                // Pega as opções de ordenação escolhidas no modal
                const ordenacao = $('#export-sort').val();
                const direcao = $('#export-dir').val();

                // Monta a URL final
                const urlFinal = `exportar_empresas_csv.php?${filtrosAtuais}&sort=${ordenacao}&dir=${direcao}`;

                // Redireciona para baixar
                window.location.href = urlFinal;

                // Fecha o modal após o clique
                $('#modalOpcoesExportacao').removeClass('active');
            });

            let empresaAtual = {};

            $(document).on('click', '.editar-empresa-btn', function() {
                const empresaId = $(this).data('id');

                $.ajax({
                    url: 'obter_dados_empresa_completo.php',
                    method: 'GET',
                    data: {
                        id: empresaId
                    },
                    dataType: 'json',
                    success: function(response) {
                        if (response.success) {
                            empresaAtual = response.empresa;

                            $('#edit-id').val(empresaAtual.id);
                            $('#edit-codigo').val(empresaAtual.codigo);
                            $('#edit-empresa').val(empresaAtual.empresa);
                            $('#edit-cnpj').val(empresaAtual.cnpj);
                            $('#edit-grupo').val(empresaAtual.grupo);
                            $('#edit-insc_municipal').val(empresaAtual.insc_municipal);
                            $('#edit-insc_estadual').val(empresaAtual.insc_estadual);
                            $('#edit-login_prefeitura').val(empresaAtual.login_prefeitura);
                            $('#edit-senha_prefeitura_ginfes').val(empresaAtual.senha_prefeitura_ginfes);
                            $('#edit-senha_giss_online').val(empresaAtual.senha_giss_online);
                            $('#edit-tributacao').val(empresaAtual.tributacao);
                            $('#edit-municipio').val(empresaAtual.municipio);

                            $('#edit-certificado_cliente').val(empresaAtual.certificado_cliente);
                            $('#edit-tipo_certificado').val(empresaAtual.tipo_certificado);
                            $('#edit-senha_certificado').val(empresaAtual.senha_certificado);
                            $('#edit-data_emissao_certificado').val(empresaAtual.data_emissao_certificado);
                            $('#edit-data_vencimento_certificado').val(empresaAtual.data_vencimento_certificado);
                            $('#edit-data_procuracao_target').val(empresaAtual.data_procuracao_target);

                            $('#edit-data_contrato').val(empresaAtual.data_contrato);
                            $('#edit-data_obrigacao').val(empresaAtual.data_obrigacao);
                            $('#edit-data_saida').val(empresaAtual.data_saida);

                            $('#edit-observacao-setor').val('fiscal');
                            $('#edit-observacoes').val(empresaAtual.observacoes_fiscal || '');

                            loadCheckboxes(empresaAtual.setores_permitidos);
                            $('#editarEmpresaModal').addClass('active');
                        } else {
                            alert('Erro ao carregar dados da empresa: ' + response.message);
                        }
                    },
                    error: function() {
                        alert('Erro de comunicação com o servidor ao carregar dados.');
                    }
                });
            });

            $('#edit-observacao-setor').on('change', function() {
                const setorSelecionado = $(this).val();
                const nomeColuna = 'observacoes_' + setorSelecionado;
                const textoObservacao = empresaAtual[nomeColuna] || '';
                $('#edit-observacoes').val(textoObservacao);
            });

            $('#formEditarEmpresa').on('submit', function(e) {
                e.preventDefault();
                updateHiddenSetores();
                const formData = $(this).serialize();

                $.ajax({
                    url: 'atualizar_empresa_completo.php',
                    method: 'POST',
                    data: formData,
                    dataType: 'json',
                    success: function(response) {
                        if (response.success) {
                            alert('Dados da empresa atualizados com sucesso!');
                            location.reload();
                        } else {
                            alert('Erro ao salvar: ' + (response.message || 'Erro desconhecido.'));
                        }
                    },
                    error: function() {
                        alert('Erro de comunicação ao salvar os dados.');
                    }
                });
            });

            $(document).on('click', '#btn-replicar-empresa', function() {
                const idAntigo = $('#edit-id').val();
                const nomeEmpresa = $('#edit-empresa').val();
                const codigoAntigo = $('#edit-codigo').val();
                $('#replicar-id-antigo').val(idAntigo);
                $('#replicar-nome-empresa').val(nomeEmpresa);
                $('#replicar-novo-codigo').val(codigoAntigo + '-B');
                $('#replicarEmpresaModal').addClass('active');
            });

            $(document).on('click', '#closeReplicarModal', function() {
                $('#replicarEmpresaModal').removeClass('active');
            });

            $('#formReplicarEmpresa').on('submit', function(e) {
                e.preventDefault();
                if (!confirm('Tem certeza que deseja replicar esta empresa? Esta ação não pode ser desfeita.')) {
                    return;
                }
                const formData = $(this).serialize();
                $.ajax({
                    url: 'replicar_empresa.php',
                    method: 'POST',
                    data: formData,
                    dataType: 'json',
                    success: function(response) {
                        if (response.success) {
                            alert('Empresa replicada com sucesso!');
                            location.reload();
                        } else {
                            alert('Erro: ' + response.message);
                        }
                    },
                    error: function() {
                        alert('Erro de comunicação. Não foi possível replicar a empresa.');
                    }
                });
            });

            // 3. Fechar modal (X ou botão cancelar)
            $(document).on('click', '.modal-close', function() {
                $('.modal-overlay').removeClass('active');
            });

            // Fechar clicando fora
            $(document).on('click', function(e) {
                if ($(e.target).is('.modal-overlay')) {
                    $(e.target).removeClass('active');
                }
            });
        });
    </script>
</body>

</html>