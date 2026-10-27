<?php
session_start();
ob_start();

require 'vendor/autoload.php';
require_once 'assets/backend/config.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;

if (!isset($_SESSION['usuario_id'])) {
    die('Acesso negado.');
}

// Query GLOBAL para Procurações
$query = "
    SELECT 
        empresa,
        cnpj,
        data_procuracao_target
    FROM controle_fechamento
    WHERE id IN (
        SELECT MAX(id)
        FROM controle_fechamento
        WHERE cnpj IS NOT NULL AND cnpj != ''
        GROUP BY cnpj
    )
    AND (data_procuracao_target IS NOT NULL AND data_procuracao_target <> '0000-00-00')
    ORDER BY data_procuracao_target ASC
";

$result = $conexao->query($query);

$spreadsheet = new Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();
$sheet->setTitle('Procuracoes Target');

$headers = ['Empresa', 'CNPJ', 'Vencimento', 'Dias Restantes', 'Status'];
$col = 'A';
foreach ($headers as $h) {
    $sheet->setCellValue($col . '1', $h);
    $sheet->getColumnDimension($col)->setAutoSize(true);
    // Estilo Azul (diferente dos certificados)
    $sheet->getStyle($col . '1')->applyFromArray([
        'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '0dcaf0']],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
    ]);
    $col++;
}

$row = 2;
$hoje = new DateTime('today');

if ($result) {
    while ($dados = $result->fetch_assoc()) {
        $dataVenc = new DateTime($dados['data_procuracao_target']);
        $intervalo = $hoje->diff($dataVenc);

        $dias = (int)$intervalo->days;
        $statusTexto = "";

        if ($intervalo->invert) {
            $dias = $dias * -1;
            $statusTexto = "VENCIDO";
            $corTexto = 'dc3545';
        } else {
            $statusTexto = "A Vencer";
            $corTexto = '198754';
            if ($dias <= 30) $corTexto = 'fd7e14';
        }

        $sheet->setCellValue('A' . $row, $dados['empresa']);
        $sheet->setCellValue('B' . $row, $dados['cnpj']);
        $sheet->setCellValue('C' . $row, date('d/m/Y', strtotime($dados['data_procuracao_target'])));
        $sheet->setCellValue('D' . $row, $dias);
        $sheet->setCellValue('E' . $row, $statusTexto);

        $sheet->getStyle('C' . $row . ':E' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle('E' . $row)->getFont()->getColor()->setARGB($corTexto);
        $sheet->getStyle('E' . $row)->getFont()->setBold(true);

        $row++;
    }
}

$filename = "Relatorio_Procuracoes_" . date('d-m-Y_Hi') . ".xlsx";

ob_end_clean();
header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment;filename="' . $filename . '"');
header('Cache-Control: max-age=0');

$writer = new Xlsx($spreadsheet);
$writer->save('php://output');
exit;
