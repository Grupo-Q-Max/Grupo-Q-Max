<?php
// exportar_empresas_csv.php

ob_start();

@error_reporting(0);
@ini_set('display_errors', 0);

require_once 'assets/backend/config.php';
require_once 'assets/backend/functions/funcoes_gerais.php';

session_start();

if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['tipo_conta'], ['admin', 'cs', 'cadastro', 'lider_fiscal'])) {
    exit('Acesso não autorizado.');
}

function safe($valor)
{
    return htmlspecialchars((string)($valor ?? ''), ENT_QUOTES, 'UTF-8');
}

function formatarDataExcel($data)
{
    if (empty($data) || $data === '0000-00-00') {
        return '-';
    }

    $timestamp = strtotime($data);

    if (!$timestamp) {
        return '-';
    }

    return date('d/m/Y', $timestamp);
}

$filtros = [
    'busca'      => $_GET['busca'] ?? '',
    'tributacao' => $_GET['tributacao'] ?? '',
    'grupo'      => $_GET['grupo'] ?? '',
    'status'     => $_GET['status'] ?? 'ativas',
    'setor'      => $_GET['setor'] ?? '',
    'sort'       => $_GET['sort'] ?? 'empresa',
    'dir'        => $_GET['dir'] ?? 'ASC'
];

$empresas = obterEmpresasUnicas($conexao, $filtros);

if (ob_get_length()) {
    ob_clean();
}

header("Content-Type: application/vnd.ms-excel; charset=UTF-8");
header("Content-Disposition: attachment; filename=\"relatorio_empresas_tributacao.xls\"");
header("Pragma: no-cache");
header("Expires: 0");

echo "<html xmlns:x=\"urn:schemas-microsoft-com:office:excel\">";
echo "<head><meta charset=\"UTF-8\">";
echo "<style>";
echo "th { background-color: #004A99; color: #ffffff; font-weight: bold; border: 1px solid #000000; }";
echo "td { border: 1px solid #cccccc; }";
echo ".cnpj { mso-number-format: \"\\@\"; }";
echo "</style>";
echo "</head><body>";
echo "<table>";

echo "<thead><tr>";
echo "<th>Código</th>";
echo "<th>Empresa</th>";
echo "<th>CNPJ</th>";
echo "<th>Grupo</th>";
echo "<th>Tributação</th>";
echo "<th>Setores Permitidos</th>";
echo "<th>Data Contrato</th>";
echo "<th>Data Saída</th>";
echo "<th>Status</th>";
echo "</tr></thead><tbody>";

foreach ($empresas as $empresa) {
    $dataContratoRaw = $empresa['data_contrato'] ?? null;
    $dataSaidaRaw = $empresa['data_saida'] ?? null;

    $data_contrato = formatarDataExcel($dataContratoRaw);
    $data_saida = formatarDataExcel($dataSaidaRaw);

    $temDataSaidaValida = !empty($dataSaidaRaw) && $dataSaidaRaw !== '0000-00-00';
    $status = (!$temDataSaidaValida || strtotime($dataSaidaRaw) >= strtotime(date('Y-m-d')))
        ? 'Ativa'
        : 'Inativa';

    $setores = empty($empresa['setores_permitidos'] ?? '') ? 'Todos' : $empresa['setores_permitidos'];

    $tributacaoRaw = $empresa['tributacao'] ?? 'N/A';
    $tributacao = ucwords(str_replace('_', ' ', (string)$tributacaoRaw));

    echo "<tr>";
    echo "<td>" . safe($empresa['codigo'] ?? '') . "</td>";
    echo "<td>" . safe($empresa['empresa'] ?? '') . "</td>";
    echo "<td class=\"cnpj\">" . safe($empresa['cnpj'] ?? '') . "</td>";
    echo "<td>" . safe($empresa['grupo'] ?? '') . "</td>";
    echo "<td>" . safe($tributacao) . "</td>";
    echo "<td>" . safe($setores) . "</td>";
    echo "<td>" . safe($data_contrato) . "</td>";
    echo "<td>" . safe($data_saida) . "</td>";
    echo "<td>" . safe($status) . "</td>";
    echo "</tr>";
}

echo "</tbody></table></body></html>";
exit;