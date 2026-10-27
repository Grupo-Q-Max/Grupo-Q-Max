	<?php
@error_reporting(0);
@ini_set('display_errors', 0);

require_once 'assets/backend/config.php';
require_once 'vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Alignment;

session_start();

if (!isset($_SESSION['usuario_id'])) {
    exit('Acesso não autorizado.');
}

$tipo_conta_logado = $_SESSION['tipo_conta'] ?? '';

if (!in_array($tipo_conta_logado, ['admin', 'cadastro'])) {
    exit('Acesso não autorizado.');
}

$mes_id = isset($_GET['mes_id']) ? (int)$_GET['mes_id'] : 0;

if ($mes_id <= 0) {
    exit('Mês inválido.');
}

$queryMes = "SELECT mes, ano FROM controle_meses WHERE id = ?";
$stmtMes = $conexao->prepare($queryMes);
$stmtMes->bind_param('i', $mes_id);
$stmtMes->execute();
$mesInfo = $stmtMes->get_result()->fetch_assoc();
$stmtMes->close();

$nomeMes = $mesInfo
    ? str_pad($mesInfo['mes'], 2, '0', STR_PAD_LEFT) . '_' . $mesInfo['ano']
    : 'mes_' . $mes_id;

$query = "SELECT 
            codigo,
            empresa,
            cnpj,
            status_cushman,
            municipio,
            certificado_cliente,
            tipo_certificado,
            senha_certificado,
            data_emissao_certificado,
            data_vencimento_certificado,
            data_procuracao_target,
            data_contrato,
            data_obrigacao,
            data_saida,
            insc_municipal,
            login_prefeitura,
            senha_prefeitura_ginfes,
            link_prefeitura,
            senha_giss_online,
            insc_estadual,
            observacoes,
            iss_cushman,
            devec_cushman,
            sped_fiscal_cushman,
            reinf_cushman,
            esocial_cushman
        FROM controle_fechamento
        WHERE id_mes = ?
          AND setores_permitidos LIKE ?
        ORDER BY empresa ASC";

$stmt = $conexao->prepare($query);
$searchTerm = '%cushman%';
$stmt->bind_param('is', $mes_id, $searchTerm);
$stmt->execute();
$resultado = $stmt->get_result();

function formatarDataExcel($data)
{
    if (empty($data) || $data === '0000-00-00') {
        return '';
    }

    try {
        return (new DateTime($data))->format('d/m/Y');
    } catch (Exception $e) {
        return $data;
    }
}

$spreadsheet = new Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();
$sheet->setTitle('Cushman');

$headers = [
    'Código',
    'Empresa',
    'CNPJ',
    'Status',
    'Município',
    'Cert. Cliente',
    'Tipo Cert.',
    'Senha Cert.',
    'Emissão Cert.',
    'Venc. Cert.',
    'Proc. Target',
    'Data Contrato',
    'Data Obrigação',
    'Data Saída',
    'Insc. Municipal',
    'Login Pref.',
    'Senha GINFES',
    'Link Prefeitura',
    'Senha GISS',
    'Insc. Estadual',
    'Observações',
    'ISS Cushman',
    'DEVEC Cushman',
    'SPED Fiscal Cushman',
    'REINF Cushman',
    'e-Social Cushman'
];

$sheet->fromArray($headers, null, 'A1');

$linha = 2;

while ($row = $resultado->fetch_assoc()) {
    $sheet->fromArray([
        $row['codigo'] ?? '',
        $row['empresa'] ?? '',
        $row['cnpj'] ?? '',
        $row['status_cushman'] ?? 'pendente',
        $row['municipio'] ?? '',
        $row['certificado_cliente'] ?? '',
        $row['tipo_certificado'] ?? '',
        $row['senha_certificado'] ?? '',
        formatarDataExcel($row['data_emissao_certificado'] ?? ''),
        formatarDataExcel($row['data_vencimento_certificado'] ?? ''),
        formatarDataExcel($row['data_procuracao_target'] ?? ''),
        formatarDataExcel($row['data_contrato'] ?? ''),
        formatarDataExcel($row['data_obrigacao'] ?? ''),
        formatarDataExcel($row['data_saida'] ?? ''),
        $row['insc_municipal'] ?? '',
        $row['login_prefeitura'] ?? '',
        $row['senha_prefeitura_ginfes'] ?? '',
        $row['link_prefeitura'] ?? '',
        $row['senha_giss_online'] ?? '',
        $row['insc_estadual'] ?? '',
        $row['observacoes'] ?? '',
        $row['iss_cushman'] ?? 'pendente',
        $row['devec_cushman'] ?? 'pendente',
        $row['sped_fiscal_cushman'] ?? 'pendente',
        $row['reinf_cushman'] ?? 'pendente',
        $row['esocial_cushman'] ?? 'pendente'
    ], null, 'A' . $linha);

    $linha++;
}

$stmt->close();

$ultimaColuna = 'Z';
$ultimaLinha = max($linha - 1, 1);

$sheet->getStyle("A1:{$ultimaColuna}1")->getFont()->setBold(true);
$sheet->getStyle("A1:{$ultimaColuna}1")->getFont()->getColor()->setARGB('FFFFFFFF');
$sheet->getStyle("A1:{$ultimaColuna}1")->getFill()
    ->setFillType(Fill::FILL_SOLID)
    ->getStartColor()->setARGB('FF198754');

$sheet->getStyle("A1:{$ultimaColuna}{$ultimaLinha}")
    ->getAlignment()
    ->setVertical(Alignment::VERTICAL_CENTER);

$sheet->setAutoFilter("A1:{$ultimaColuna}{$ultimaLinha}");
$sheet->freezePane('A2');

foreach (range('A', $ultimaColuna) as $coluna) {
    $sheet->getColumnDimension($coluna)->setAutoSize(true);
}

$sheet->getStyle("A1:{$ultimaColuna}{$ultimaLinha}")
    ->getBorders()
    ->getAllBorders()
    ->getColor()
    ->setARGB('FFD9D9D9');

$filename = "cushman_{$nomeMes}.xlsx";

while (ob_get_level()) {
    ob_end_clean();
}

header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header("Content-Disposition: attachment; filename=\"{$filename}\"");
header('Cache-Control: max-age=0');

$writer = new Xlsx($spreadsheet);
$writer->save('php://output');
exit;