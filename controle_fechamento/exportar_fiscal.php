<?php
session_start();

// Limpa o buffer de saída para evitar arquivos corrompidos
ob_start();

require 'vendor/autoload.php';
require_once 'assets/backend/config.php';
require_once 'funcoes_fiscal_admin.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;

// 1. Verificação de Permissões
if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['tipo_conta'], ['admin', 'lider_fiscal', 'lider_contabil', 'lider_dp'])) {
    ob_end_clean();
    die('Acesso negado.');
}

// 2. Validação do Mês
$mes_selecionado_id = $_GET['mes_id'] ?? null;
if (!$mes_selecionado_id) {
    ob_end_clean();
    die('Mês não selecionado.');
}

// 3. Obter Nome do Mês
$stmt_mes = $conexao->prepare("SELECT mes, ano FROM controle_meses WHERE id = ?");
$stmt_mes->bind_param('i', $mes_selecionado_id);
$stmt_mes->execute();
$mes_info = $stmt_mes->get_result()->fetch_assoc();
$mes_ano_str = $mes_info ? str_pad($mes_info['mes'], 2, '0', STR_PAD_LEFT) . "-{$mes_info['ano']}" : date('m-Y');

// 4. Filtros
$filtros = [
    'busca'          => $_GET['busca'] ?? '',
    'responsavel_id' => $_GET['responsavel_id'] ?? '',
    'sort'           => 'empresa',
    'dir'            => 'ASC'
];

// 5. Busca os dados (SELECT cf.* garante que traga os detalhes de REINF e Impostos)
$resultado = obterEmpresasFiscalAdmin($conexao, $mes_selecionado_id, $filtros);

// 6. Configuração do Excel
$spreadsheet = new Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();
$sheet->setTitle("Fiscal Detalhado {$mes_ano_str}");

// --- DEFINIÇÃO DAS COLUNAS ---
// Vamos usar um array associativo para mapear o Título da Coluna -> Nome do Campo no Banco
$colunas = [
    // Dados Cadastrais
    ['titulo' => 'Código',          'campo' => 'codigo',             'width' => 10, 'cor' => '0d6efd'], // Azul
    ['titulo' => 'Empresa',         'campo' => 'empresa',            'width' => 30, 'cor' => '0d6efd'],
    ['titulo' => 'Status',          'campo' => 'status_fiscal',      'width' => 15, 'cor' => '0d6efd'],
    ['titulo' => 'Responsável',     'campo' => 'responsavel_nome',   'width' => 20, 'cor' => '0d6efd'],
    ['titulo' => 'CNPJ',            'campo' => 'cnpj',               'width' => 18, 'cor' => '0d6efd', 'tipo' => 'texto'],
    ['titulo' => 'Observações',     'campo' => 'observacoes_fiscal', 'width' => 25, 'cor' => '0d6efd'],
    ['titulo' => 'Grupo',           'campo' => 'grupo',              'width' => 12, 'cor' => '0d6efd'],
    ['titulo' => 'Tributação',      'campo' => 'tributacao',         'width' => 15, 'cor' => '0d6efd'],
    ['titulo' => 'Município',       'campo' => 'municipio',          'width' => 15, 'cor' => '0d6efd'],
    ['titulo' => 'Insc. Est.',      'campo' => 'insc_estadual',      'width' => 15, 'cor' => '0d6efd', 'tipo' => 'texto'],
    ['titulo' => 'Insc. Mun.',      'campo' => 'insc_municipal',     'width' => 15, 'cor' => '0d6efd', 'tipo' => 'texto'],
    ['titulo' => 'Login Pref.',     'campo' => 'login_prefeitura',   'width' => 15, 'cor' => '0d6efd'],
    ['titulo' => 'Senha Pref.',     'campo' => 'senha_prefeitura_ginfess', 'width' => 15, 'cor' => '0d6efd'],
    ['titulo' => 'Senha GISS',      'campo' => 'senha_giss_online',  'width' => 15, 'cor' => '0d6efd'],
    ['titulo' => 'Link Pref.',      'campo' => 'link_prefeitura',    'width' => 20, 'cor' => '0d6efd'],
    ['titulo' => 'Tipo',            'campo' => 'tipo',               'width' => 10, 'cor' => '0d6efd'],
    ['titulo' => 'Envio',           'campo' => 'envio',              'width' => 10, 'cor' => '0d6efd'],

    // Detalhes REINF (Cor Verde Escuro)
    ['titulo' => 'REINF (Status)',  'campo' => 'reinf',              'width' => 15, 'cor' => '198754'],
    ['titulo' => 'R-IRRF 1708',     'campo' => 'irrf_1708',          'width' => 12, 'cor' => '198754'],
    ['titulo' => 'R-CRF 5952',      'campo' => 'crf_5952',           'width' => 12, 'cor' => '198754'],
    ['titulo' => 'R-INSS Prest.',   'campo' => 'inss_prestados',     'width' => 12, 'cor' => '198754'],
    ['titulo' => 'R-INSS Tom.',     'campo' => 'inss_tomados',       'width' => 12, 'cor' => '198754'],
    ['titulo' => 'R-Desoneração',   'campo' => 'desoneracao',        'width' => 12, 'cor' => '198754'],
    ['titulo' => 'R-IRRF 3208',     'campo' => 'irrf_3208',          'width' => 12, 'cor' => '198754'],
    ['titulo' => 'R-Outros',        'campo' => 'outros',             'width' => 15, 'cor' => '198754'], // Ajuste se o nome da coluna no banco for diferente (ex: reinf_outros)

    // Detalhes IMPOSTOS (Cor Laranja/Amarelo Escuro)
    ['titulo' => 'Impostos (Status)', 'campo' => 'impostos',         'width' => 15, 'cor' => 'fd7e14'],
    ['titulo' => 'I-Faturamento',   'campo' => 'faturamento',        'width' => 15, 'cor' => 'fd7e14'],
    ['titulo' => 'I-ISS Prest.',    'campo' => 'iss_prestados',      'width' => 12, 'cor' => 'fd7e14'], // Atenção para não conflitar nomes se as colunas forem iguais no banco
    ['titulo' => 'I-ISS Tom.',      'campo' => 'iss_tomados',        'width' => 12, 'cor' => 'fd7e14'],
    ['titulo' => 'I-DAS',           'campo' => 'das',                'width' => 12, 'cor' => 'fd7e14'],
    ['titulo' => 'I-PIS/COFINS',    'campo' => 'darf_pis_cofins',    'width' => 12, 'cor' => 'fd7e14'],
    ['titulo' => 'I-IRPJ/CSLL',     'campo' => 'darf_irpj_csll',     'width' => 12, 'cor' => 'fd7e14'],
    ['titulo' => 'I-ICMS',          'campo' => 'icms',               'width' => 12, 'cor' => 'fd7e14'],
    ['titulo' => 'I-Outros',        'campo' => 'outros',             'width' => 15, 'cor' => 'fd7e14'], // Se houver conflito de nome 'outros', o SQL deve usar alias.

    // Colunas Finais
    ['titulo' => 'ISS',             'campo' => 'iss',                'width' => 15, 'cor' => '0d6efd'],
    ['titulo' => 'MIT',             'campo' => 'mit',                'width' => 15, 'cor' => '0d6efd'],
    ['titulo' => 'Sped Fiscal',     'campo' => 'sped_fiscal',        'width' => 15, 'cor' => '0d6efd'],
    ['titulo' => 'Sped Contrib.',   'campo' => 'sped_contribuicao',  'width' => 15, 'cor' => '0d6efd'],
    ['titulo' => 'Destda',          'campo' => 'destda',             'width' => 15, 'cor' => '0d6efd'],
    ['titulo' => 'GIA',             'campo' => 'gia',                'width' => 15, 'cor' => '0d6efd']
];

// --- ESCRITA DO CABEÇALHO ---
$colLetter = 'A';
foreach ($colunas as $col) {
    $cell = $colLetter . '1';
    $sheet->setCellValue($cell, $col['titulo']);
    $sheet->getColumnDimension($colLetter)->setWidth($col['width']);

    // Estilo da Célula de Cabeçalho
    $sheet->getStyle($cell)->applyFromArray([
        'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $col['cor']]],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
        'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]]
    ]);

    $colLetter++;
}
$sheet->getRowDimension('1')->setRowHeight(30);


// --- PREENCHIMENTO DOS DADOS ---
$linha = 2;
if ($resultado && $resultado->num_rows > 0) {
    while ($empresa = $resultado->fetch_assoc()) {
        $colLetter = 'A';
        foreach ($colunas as $col) {
            $valor = $empresa[$col['campo']] ?? '';

            // Tratamento especial para valores nulos ou padrão
            if ($col['campo'] === 'responsavel_nome' && empty($valor)) $valor = 'Nenhum';
            if ($col['campo'] === 'status_fiscal' && empty($valor)) $valor = 'Pendente';

            // Escreve o valor na célula
            if (isset($col['tipo']) && $col['tipo'] === 'texto') {
                $sheet->setCellValueExplicit($colLetter . $linha, $valor, DataType::TYPE_STRING);
            } else {
                $sheet->setCellValue($colLetter . $linha, $valor);
            }

            // Centraliza se não for a primeira coluna ou observações
            if ($col['campo'] !== 'empresa' && $col['campo'] !== 'observacoes_fiscal') {
                $sheet->getStyle($colLetter . $linha)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
            }

            $colLetter++;
        }
        $linha++;
    }
}

// 7. Saída do Arquivo
$nome_arquivo = "Fiscal_Detalhado_{$mes_ano_str}_" . date('d-m-Y_Hi') . ".xlsx";

ob_end_clean(); // Limpa buffer

header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment;filename="' . $nome_arquivo . '"');
header('Cache-Control: max-age=0');
header('Expires: 0');

$writer = new Xlsx($spreadsheet);
$writer->save('php://output');
exit();
