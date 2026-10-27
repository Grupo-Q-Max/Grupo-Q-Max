<?php
session_start();
ob_start(); // Previne corrompimento do arquivo

require 'vendor/autoload.php'; // Ajuste o caminho se necessário
require_once 'assets/backend/config.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;

// 1. Permissões
if (!isset($_SESSION['usuario_id'])) {
    die('Acesso negado.');
}

// 2. Query GLOBAL (Mesma lógica do painel visual)
// Pega o último registro de cada CNPJ, independente de setor ou status
$query = "
    SELECT 
        empresa,
        cnpj,
        data_vencimento_certificado
    FROM controle_fechamento
    WHERE id IN (
        SELECT MAX(id)
        FROM controle_fechamento
        WHERE cnpj IS NOT NULL AND cnpj != ''
        GROUP BY cnpj
    )
    AND (data_vencimento_certificado IS NOT NULL AND data_vencimento_certificado <> '0000-00-00')
    ORDER BY data_vencimento_certificado ASC
";

$result = $conexao->query($query);

// 3. Criar Excel
$spreadsheet = new Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();
$sheet->setTitle('Certificados Digitais');

// Cabeçalhos
$headers = ['Empresa', 'CNPJ', 'Vencimento', 'Dias Restantes', 'Status'];
$col = 'A';
foreach ($headers as $h) {
    $sheet->setCellValue($col . '1', $h);
    $sheet->getColumnDimension($col)->setAutoSize(true);
    // Estilo
    $sheet->getStyle($col . '1')->applyFromArray([
        'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'b08d05']], // Cor mostarda
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
    ]);
    $col++;
}

// 4. Preencher Dados
$row = 2;
$hoje = new DateTime('today');

if ($result) {
    while ($dados = $result->fetch_assoc()) {
        $dataVenc = new DateTime($dados['data_vencimento_certificado']);
        $intervalo = $hoje->diff($dataVenc);

        $dias = (int)$intervalo->days;
        $statusTexto = "";

        if ($intervalo->invert) {
            // Vencido
            $dias = $dias * -1;
            $statusTexto = "VENCIDO";
            $corTexto = 'dc3545'; // Vermelho
        } else {
            // A Vencer
            $statusTexto = "A Vencer";
            $corTexto = '198754'; // Verde
            if ($dias <= 30) $corTexto = 'fd7e14'; // Laranja (Alerta)
        }

        $sheet->setCellValue('A' . $row, $dados['empresa']);
        $sheet->setCellValue('B' . $row, $dados['cnpj']);
        $sheet->setCellValue('C' . $row, date('d/m/Y', strtotime($dados['data_vencimento_certificado'])));
        $sheet->setCellValue('D' . $row, $dias);
        $sheet->setCellValue('E' . $row, $statusTexto);

        // Alinha Centro as datas e dias
        $sheet->getStyle('C' . $row . ':E' . $row)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        // Colore o status
        $sheet->getStyle('E' . $row)->getFont()->getColor()->setARGB($corTexto);
        $sheet->getStyle('E' . $row)->getFont()->setBold(true);

        $row++;
    }
}

// 5. Download
$filename = "Relatorio_Certificados_" . date('d-m-Y_Hi') . ".xlsx";

ob_end_clean();
header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment;filename="' . $filename . '"');
header('Cache-Control: max-age=0');

$writer = new Xlsx($spreadsheet);
$writer->save('php://output');
exit;
