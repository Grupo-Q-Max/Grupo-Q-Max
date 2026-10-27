<?php
// buscar_empresas.php
require 'assets/backend/config.php';
session_start();

if (!isset($_SESSION['tipo_conta']) || $_SESSION['tipo_conta'] !== 'admin') {
    http_response_code(403); // Acesso negado
    echo json_encode(['erro' => 'Acesso não autorizado.']);
    exit();
}

// Lógica de busca e filtragem (copiada do seu arquivo principal)
$tipos_tarefa = ['dp', 'fiscal', 'contabil'];

$mes_selecionado = $_GET['mes'] ?? null;
$filtro_status = $_GET['filtro_status'] ?? 'todas';
$busca = $_GET['busca'] ?? '';
$pagina = isset($_GET['pagina']) ? max(1, intval($_GET['pagina'])) : 1;

$por_pagina = 10;
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

// Consulta principal
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

// Lógica para obter delegações e status (também copiada)
$sql_delegacoes = "SELECT re.id_empresa, re.tipo_tarefa, re.id_mes, u.nome as funcionario_nome FROM responsaveis_empresa re JOIN usuarios u ON re.id_usuario = u.id";
$result_delegacoes = $conexao->query($sql_delegacoes);
$todas_delegacoes = [];
if ($result_delegacoes) {
    while ($row = $result_delegacoes->fetch_assoc()) {
        $chave = $row['id_empresa'] . '_' . $row['id_mes'];
        $todas_delegacoes[$chave][$row['tipo_tarefa']] = $row['funcionario_nome'];
    }
}
foreach ($empresas as &$empresa) {
    $empresa['tarefas_delegadas'] = [];
    $empresa['responsaveis'] = [];
    $chave = $empresa['id'] . '_' . $empresa['id_mes'];
    foreach ($tipos_tarefa as $tipo) {
        $empresa['tarefas_delegadas'][$tipo] = isset($todas_delegacoes[$chave][$tipo]);
        $empresa['responsaveis'][$tipo] = $todas_delegacoes[$chave][$tipo] ?? null;
    }
    $empresa['todas_tarefas_delegadas'] = !in_array(false, $empresa['tarefas_delegadas']);
    $empresa['nenhuma_tarefa_delegada'] = !in_array(true, $empresa['tarefas_delegadas']);
}
unset($empresa);

if ($filtro_status !== 'todas') {
    $empresas = array_filter($empresas, function ($empresa) use ($filtro_status) {
        return ($filtro_status === 'completas') ? $empresa['todas_tarefas_delegadas'] : !$empresa['todas_tarefas_delegadas'];
    });
}

// Geração dos parâmetros para a paginação AJAX
$parametros_url = [];
if ($mes_selecionado) $parametros_url['mes'] = $mes_selecionado;
if ($filtro_status !== 'todas') $parametros_url['filtro_status'] = $filtro_status;
if ($busca) $parametros_url['busca'] = $busca;
$query_string = !empty($parametros_url) ? '&' . http_build_query($parametros_url) : '';


// Inicia a captura do HTML que será enviado de volta
ob_start();
?>

<?php if (empty($empresas)): ?>
    <tr>
        <td colspan="8" style="text-align: center;">Nenhuma empresa encontrada com os filtros aplicados</td>
    </tr>
<?php else: ?>
    <?php foreach ($empresas as $empresa): ?>
        <tr>
            <td> <input type="checkbox" class="checkbox-empresa" name="empresas_selecionadas[]" value="<?= $empresa['id'] ?>"></td>
            <td><?= htmlspecialchars($empresa['codigo'] ?? 'não informado') ?></td>
            <td><?= htmlspecialchars($empresa['empresa'] ?? 'não informado') ?></td>
            <td>
                <?php
                $tributacao = strtolower($empresa['tributacao']);
                $badge_class = ''; $tributacao_label = '';
                if (strpos($tributacao, 'simples') !== false) { $badge_class = 'badge-sn'; $tributacao_label = 'SN'; }
                elseif (strpos($tributacao, 'presumido') !== false) { $badge_class = 'badge-lp'; $tributacao_label = 'LP'; }
                elseif (strpos($tributacao, 'real') !== false) { $badge_class = 'badge-lr'; $tributacao_label = 'LR'; }
                elseif (strpos($tributacao, 'imune') !== false) { $badge_class = 'badge-imune'; $tributacao_label = 'Imune'; }
                elseif (strpos($tributacao, 'mei') !== false) { $badge_class = 'badge-mei'; $tributacao_label = 'MEI'; }
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
                                <span class="tarefa-responsavel" title="<?= htmlspecialchars($empresa['responsaveis'][$tipo]) ?>"><i class="fas fa-user"></i></span>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                </div>
            </td>
            <td>
                <button type="button" class="btn btn-small btn-outline delegar-btn" data-empresa-id="<?= $empresa['id'] ?>" data-empresa-nome="<?= htmlspecialchars($empresa['empresa']) ?>">
                    <i class="fas fa-user-plus"></i> Delegar
                </button>
            </td>
        </tr>
    <?php endforeach; ?>
<?php endif; ?>
<?php
$tabela_html = ob_get_clean(); 

ob_start();
?>
<?php if ($total_paginas > 1): ?>
    <?php if ($pagina > 1): ?>
        <a href="#" class="page-link" data-pagina="1"><i class="fas fa-angle-double-left"></i></a>
        <a href="#" class="page-link" data-pagina="<?= $pagina - 1 ?>"><i class="fas fa-angle-left"></i></a>
    <?php else: ?>
        <span class="desabilitada"><i class="fas fa-angle-double-left"></i></span>
        <span class="desabilitada"><i class="fas fa-angle-left"></i></span>
    <?php endif; ?>
    <?php
    $inicio = max(1, $pagina - 2);
    $fim = min($total_paginas, $pagina + 2);
    if ($inicio > 1) echo '<span>...</span>';
    for ($i = $inicio; $i <= $fim; $i++): ?>
        <a href="#" class="page-link <?= $i == $pagina ? 'ativa' : '' ?>" data-pagina="<?= $i ?>"><?= $i ?></a>
    <?php endfor;
    if ($fim < $total_paginas) echo '<span>...</span>';
    ?>
    <?php if ($pagina < $total_paginas): ?>
        <a href="#" class="page-link" data-pagina="<?= $pagina + 1 ?>"><i class="fas fa-angle-right"></i></a>
        <a href="#" class="page-link" data-pagina="<?= $total_paginas ?>"><i class="fas fa-angle-double-right"></i></a>
    <?php else: ?>
        <span class="desabilitada"><i class="fas fa-angle-right"></i></span>
        <span class="desabilitada"><i class="fas fa-angle-double-right"></i></span>
    <?php endif; ?>
<?php endif; ?>
<?php
$paginacao_html = ob_get_clean(); 

header('Content-Type: application/json');
echo json_encode([
    'tabela_html' => $tabela_html,
    'paginacao_html' => $paginacao_html
]);
?>