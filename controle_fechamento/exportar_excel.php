<?php
ob_start(); 

require 'assets/backend/config.php';
require 'vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Font;
use PhpOffice\PhpSpreadsheet\Style\Alignment;

session_start();

if (!isset($_SESSION['usuario_id'])) {
    ob_end_flush(); 
    exit();
}

$mes_selecionado = isset($_GET['mes_id']) && !empty($_GET['mes_id']) ? intval($_GET['mes_id']) : null;
$filtro_tributacao = isset($_GET['tributacao']) && !empty($_GET['tributacao']) ? $conexao->real_escape_string($_GET['tributacao']) : null;
$filtro_municipio = isset($_GET['municipio']) && !empty($_GET['municipio']) ? $conexao->real_escape_string($_GET['municipio']) : null;
$filtro_status = isset($_GET['status']) && !empty($_GET['status']) ? $conexao->real_escape_string($_GET['status']) : null;
$filtro_tipo = isset($_GET['tipo']) && !empty($_GET['tipo']) ? $conexao->real_escape_string($_GET['tipo']) : null;

$sql_base = "SELECT * FROM controle_fechamento";
$where = [];
$params = [];
$types = "";

if ($mes_selecionado) {
    $where[] = "(id_mes = ? OR id_mes IS NULL)";
    $params[] = $mes_selecionado;
    $types .= "i";
}
if ($filtro_tributacao) {
    $where[] = "tributacao = ?";
    $params[] = $filtro_tributacao;
    $types .= "s";
}
if ($filtro_municipio) {
    $where[] = "municipio LIKE ?";
    $params[] = "%$filtro_municipio%";
    $types .= "s";
}
if ($filtro_status) {
    $where[] = "status = ?";
    $params[] = $filtro_status;
    $types .= "s";
}
if ($filtro_tipo) {
    $where[] = "tipo = ?";
    $params[] = $filtro_tipo;
    $types .= "s";
}

if (!empty($where)) {
    $sql_base .= " WHERE " . implode(" AND ", $where);
}
$sql_base .= " ORDER BY empresa ASC";

$stmt = $conexao->prepare($sql_base);
if (!empty($params)) {
    $stmt->bind_param($types, ...$params);
}
$stmt->execute();
$result = $stmt->get_result();
$empresas = $result->fetch_all(MYSQLI_ASSOC);

$spreadsheet = new Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();
$sheet->setTitle('Relatório de Empresas');

$headers = [
    'Código',
    'Empresa',
    'CNPJ',
    'Insc. Estadual',
    'Insc. Municipal',
    'Tributação',
    'Tipo',
    'Envio',
    'Município',
    'Data Contrato',
    'Data Obrigação',
    'Data Saída',
    'Status',
    'Observações',
    'Status DP',
    'Status Fiscal',
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro'
];
$sheet->fromArray($headers, null, 'A1');

$headerStyle = [
    'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
    'fill' => ['fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID, 'startColor' => ['rgb' => '4285F4']],
    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
];
$sheet->getStyle('A1:' . $sheet->getHighestColumn() . '1')->applyFromArray($headerStyle);

$rowIndex = 2;
foreach ($empresas as $empresa) {
    $rowData = [
        $empresa['codigo'],
        $empresa['empresa'],
        $empresa['cnpj'],
        $empresa['insc_estadual'],
        $empresa['insc_municipal'],
        ucfirst(str_replace('_', ' ', $empresa['tributacao'] ?? '')),
        $empresa['tipo'],
        $empresa['envio'],
        $empresa['municipio'],
        !empty($empresa['data_contrato']) ? date('d/m/Y', strtotime($empresa['data_contrato'])) : '',
        !empty($empresa['data_obrigacao']) ? date('d/m/Y', strtotime($empresa['data_obrigacao'])) : '',
        !empty($empresa['data_saida']) ? date('d/m/Y', strtotime($empresa['data_saida'])) : '',
        $empresa['status'],
        $empresa['observacoes'],
        $empresa['status_dp'],
        $empresa['status_fiscal'],
        $empresa['janeiro'] ? 'Sim' : 'Não',
        $empresa['fevereiro'] ? 'Sim' : 'Não',
        $empresa['marco'] ? 'Sim' : 'Não',
        $empresa['abril'] ? 'Sim' : 'Não',
        $empresa['maio'] ? 'Sim' : 'Não',
        $empresa['junho'] ? 'Sim' : 'Não',
        $empresa['julho'] ? 'Sim' : 'Não',
        $empresa['agosto'] ? 'Sim' : 'Não',
        $empresa['setembro'] ? 'Sim' : 'Não',
        $empresa['outubro'] ? 'Sim' : 'Não',
        $empresa['novembro'] ? 'Sim' : 'Não',
        $empresa['dezembro'] ? 'Sim' : 'Não',
    ];
    $sheet->fromArray($rowData, null, 'A' . $rowIndex);
    $rowIndex++;
}

foreach (range('A', $sheet->getHighestColumn()) as $columnID) {
    $sheet->getColumnDimension($columnID)->setAutoSize(true);
}

ob_end_clean();

$fileName = 'relatorio_empresas_' . date('Y-m-d') . '.xlsx';

header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment;filename="' . $fileName . '"');
header('Cache-Control: max-age=0');
header('Pragma: public'); 

$writer = new Xlsx($spreadsheet);
$writer->save('php://output');
exit(); 