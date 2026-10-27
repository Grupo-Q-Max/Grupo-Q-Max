<?php
session_start();
require 'vendor/autoload.php';
require_once 'assets/backend/config.php';
require_once 'funcoes_dp_admin.php'; // Inclui nosso novo arquivo de função

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Cell\DataType;

if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['tipo_conta'], ['admin', 'lider_dp', 'dp'])) {
    die('Acesso negado.');
}

$mes_selecionado_id = $_GET['mes_id'] ?? null;
if (!$mes_selecionado_id) die('Mês não selecionado.');

// Pega o nome do mês/ano para o título do arquivo
$stmt_mes = $conexao->prepare("SELECT mes, ano FROM controle_meses WHERE id = ?");
$stmt_mes->bind_param('i', $mes_selecionado_id);
$stmt_mes->execute();
$mes_info = $stmt_mes->get_result()->fetch_assoc();
$mes_ano_str = $mes_info ? str_pad($mes_info['mes'], 2, '0', STR_PAD_LEFT) . "-{$mes_info['ano']}" : date('m-Y');

/* --- [!] CORREÇÃO DE LÓGICA (Exportar Todos) --- */
// Ignora os filtros da URL para garantir que o relatório venha completo
$filtros = [
    'busca'          => '',
    'responsavel_id' => '',
    'grupo'          => '',
    'tributacao'     => ''
];
/* --- [!] FIM DA CORREÇÃO --- */

$resultado = obterEmpresasDPAdmin($conexao, $mes_selecionado_id, $filtros);

$spreadsheet = new Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();
$sheet->setTitle("Relatorio DP {$mes_ano_str}");

$cabecalho = [
    'Código', 'Empresa', 'CNPJ', 'Responsável', 'Status', 'Observações', 
    'ADTO', 'Folha Pagto', 'Tipo Folha', // Nova coluna inserida aqui
    'Data Pagamento', 'Qtde Func.', 'Guias Sindicato', 'FGTS Digital', 
    'E-Social', 'DCTF Web', 'Seg. Des. Login', 'Seg. Des. Senha', 
    'ADTO13', 'data_calculo_adto13', 'data_envio_adto13', 'folha13', 
    'data_calculo_folha13', 'data_envio_folha13', 'REINF'
];
// ... (O resto do seu script de Excel permanece igual) ...
$sheet->fromArray($cabecalho, NULL, 'A1');
$sheet->getStyle('A1:' . $sheet->getHighestColumn() . '1')->getFont()->setBold(true);

$linhaAtual = 2;
if ($resultado && $resultado->num_rows > 0) {
while ($empresa = $resultado->fetch_assoc()) {
    $sheet->setCellValue('A' . $linhaAtual, $empresa['codigo']);
    $sheet->setCellValue('B' . $linhaAtual, $empresa['empresa']);
    $sheet->getCell('C' . $linhaAtual)->setValueExplicit($empresa['cnpj'], DataType::TYPE_STRING);
    $sheet->setCellValue('D' . $linhaAtual, $empresa['responsavel_nome'] ?? 'Nenhum');
    $sheet->setCellValue('E' . $linhaAtual, $empresa['status_dp']);
    $sheet->setCellValue('F' . $linhaAtual, $empresa['observacoes_dp'] ?? $empresa['observacoes'] ?? '');
    
    $sheet->setCellValue('G' . $linhaAtual, $empresa['adto']);
    $sheet->setCellValue('H' . $linhaAtual, $empresa['folha_pagamento']);
    
    // Nova coluna Tipo Folha
    $sheet->setCellValue('I' . $linhaAtual, $empresa['tipo_folha'] ?? ''); 
    
    // Shift das demais colunas (incrementamos a letra da coluna)
    $sheet->setCellValue('J' . $linhaAtual, $empresa['data_pagamento']);
    $sheet->setCellValue('K' . $linhaAtual, $empresa['qtde_funcionarios']);
    $sheet->setCellValue('L' . $linhaAtual, $empresa['guias_sindicato']);
    $sheet->setCellValue('M' . $linhaAtual, $empresa['fgts_digital']);
    $sheet->setCellValue('N' . $linhaAtual, $empresa['dctf_web_mes']);
    $sheet->setCellValue('O' . $linhaAtual, $empresa['sd_login']);
    $sheet->setCellValue('P' . $linhaAtual, $empresa['sd_senha']);
    $sheet->setCellValue('Q' . $linhaAtual, $empresa['ADTO13']);
    $sheet->setCellValue('R' . $linhaAtual, $empresa['data_calculo_adto13']);
    $sheet->setCellValue('S' . $linhaAtual, $empresa['data_envio_adto13']);
    $sheet->setCellValue('T' . $linhaAtual, $empresa['folha13'] ?? '');
    $sheet->setCellValue('U' . $linhaAtual, $empresa['data_calculo_folha13']);
    $sheet->setCellValue('V' . $linhaAtual, $empresa['data_envio_folha13']);
    $sheet->setCellValue('W' . $linhaAtual, $empresa['reinf']);
    
    $linhaAtual++;
}
}

foreach (range('A', $sheet->getHighestDataColumn()) as $colunaID) {
    $sheet->getColumnDimension($colunaID)->setAutoSize(true);
}

$nome_arquivo = "relatorio_dp_{$mes_ano_str}_" . date('Y-m-d') . ".xlsx";
header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment;filename="' . $nome_arquivo . '"');
header('Cache-Control: max-age=0');
ob_end_clean();
$writer = new Xlsx($spreadsheet);
$writer->save('php://output');
exit();
