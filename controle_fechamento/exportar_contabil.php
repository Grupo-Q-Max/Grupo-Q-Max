<?php
session_start();

require 'vendor/autoload.php';
require_once 'assets/backend/config.php';
require_once 'funcoes_contabil_admin.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Cell\DataType;

// Verificação de acesso
if (
    !isset($_SESSION['usuario_id']) ||
    !in_array($_SESSION['tipo_conta'], ['admin', 'lider_contabil','contabil'], true)
) {
    die('Acesso negado.');
}

// Ano selecionado
$ano_selecionado = isset($_GET['ano'])
    ? (int) $_GET['ano']
    : (int) date('Y');

// O mes_id é obrigatório
$mes_selecionado_id = filter_input(INPUT_GET, 'mes_id', FILTER_VALIDATE_INT);

if (!$mes_selecionado_id) {
    die('Mês ID não selecionado.');
}

// Exporta todas as empresas
$filtros = [
    'status'         => 'todas',
    'busca'          => '',
    'responsavel_id' => '',
    'tributacao'     => '',
    'grupo'          => '',
];

// Busca as empresas
$resultado = obterEmpresasContabeisAdmin(
    $conexao,
    $ano_selecionado,
    $mes_selecionado_id,
    $filtros
);

// Busca o mês e ano selecionados
$stmt_mes = $conexao->prepare(
    "SELECT mes, ano
     FROM controle_meses
     WHERE id = ?"
);

if (!$stmt_mes) {
    die('Erro ao preparar consulta do mês.');
}

$stmt_mes->bind_param('i', $mes_selecionado_id);
$stmt_mes->execute();

$mes_info = $stmt_mes->get_result()->fetch_assoc();
$stmt_mes->close();

$mes_ano_str = $mes_info
    ? str_pad((string) $mes_info['mes'], 2, '0', STR_PAD_LEFT) . "-{$mes_info['ano']}"
    : (string) $ano_selecionado;

// Cria a planilha
$spreadsheet = new Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();

$sheet->setTitle("Contabil {$ano_selecionado}");

// Cabeçalho
$cabecalho = [
    'Código',
    'Empresa',
    'CNPJ',
    'Situação',
    'Responsável',
    'Grupo',
    'Tributação',
    'Observações',
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
    'Dezembro',
    'Balancete',
    'Distribuição DIRF',
    'DEFS',
    'DASN',
    'ECD',
    'ECF'
];

$sheet->fromArray($cabecalho, null, 'A1');

// Estilo do cabeçalho
$sheet->getStyle('A1:Z1')->getFont()->setBold(true);
$sheet->freezePane('A2');
$sheet->setAutoFilter('A1:Z1');

// Meses e respectivas colunas do Excel
$meses_colunas = [
    'janeiro',
    'fevereiro',
    'marco',
    'abril',
    'maio',
    'junho',
    'julho',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'dezembro'
];

$colunas_excel_meses = range('I', 'T');

$linhaAtual = 2;

if ($resultado && $resultado->num_rows > 0) {
    while ($empresa = $resultado->fetch_assoc()) {
        // Dados principais
        $sheet->setCellValue(
            'A' . $linhaAtual,
            $empresa['codigo'] ?? ''
        );

        $sheet->setCellValue(
            'B' . $linhaAtual,
            $empresa['empresa'] ?? ''
        );

        // Mantém CNPJ como texto
        $sheet->getCell('C' . $linhaAtual)->setValueExplicit(
            $empresa['cnpj'] ?? '',
            DataType::TYPE_STRING
        );

        /*
         * Situação da empresa:
         * - Sem data de saída: Ativa
         * - Com data de saída: Saiu em 2026, por exemplo
         */
        $data_saida_original = $empresa['data_saida'] ?? null;

        $data_saida_valida = !empty($data_saida_original)
            && $data_saida_original !== '0000-00-00'
            && strtotime($data_saida_original) !== false;

        $situacao = $data_saida_valida
            ? 'Saiu em ' . date('Y', strtotime($data_saida_original))
            : 'Ativa';

        $sheet->setCellValue(
            'D' . $linhaAtual,
            $situacao
        );

        $sheet->setCellValue(
            'E' . $linhaAtual,
            $empresa['responsavel_nome'] ?? 'Nenhum'
        );

        $sheet->setCellValue(
            'F' . $linhaAtual,
            $empresa['grupo'] ?? ''
        );

        $sheet->setCellValue(
            'G' . $linhaAtual,
            $empresa['tributacao'] ?? ''
        );

        $sheet->setCellValue(
            'H' . $linhaAtual,
            $empresa['observacoes_contabil']
                ?? $empresa['observacoes']
                ?? ''
        );

        // Data de obrigação
        $data_obrigacao_original = $empresa['data_obrigacao'] ?? null;

        $data_obrigacao_valida = !empty($data_obrigacao_original)
            && $data_obrigacao_original !== '0000-00-00'
            && strtotime($data_obrigacao_original) !== false;

        $ano_obrigacao = $data_obrigacao_valida
            ? (int) date('Y', strtotime($data_obrigacao_original))
            : null;

        $mes_obrigacao = $data_obrigacao_valida
            ? (int) date('m', strtotime($data_obrigacao_original))
            : null;

        // Data de saída
        $data_saida = $data_saida_valida
            ? $data_saida_original
            : null;

        $ano_saida = $data_saida
            ? (int) date('Y', strtotime($data_saida))
            : null;

        $mes_saida = $data_saida
            ? (int) date('m', strtotime($data_saida))
            : null;

        // Preenche Janeiro até Dezembro
        foreach ($meses_colunas as $index => $mes) {
            $mes_numero = $index + 1;
            $coluna_excel_atual = $colunas_excel_meses[$index];

            $antes_da_obrigacao = $data_obrigacao_valida
                && (
                    $ano_selecionado < $ano_obrigacao
                    || (
                        $ano_selecionado === $ano_obrigacao
                        && $mes_numero < $mes_obrigacao
                    )
                );

            $depois_da_saida = $data_saida
                && (
                    $ano_selecionado > $ano_saida
                    || (
                        $ano_selecionado === $ano_saida
                        && $mes_numero > $mes_saida
                    )
                );

            $is_cliente_no_periodo = !(
                $antes_da_obrigacao ||
                $depois_da_saida
            );

            $valor_a_exportar = $is_cliente_no_periodo
                ? ($empresa[$mes] ?? '')
                : 'N/A';

            $sheet->setCellValue(
                $coluna_excel_atual . $linhaAtual,
                $valor_a_exportar
            );
        }

        // Demais campos
        $sheet->setCellValue(
            'U' . $linhaAtual,
            $empresa['balancete'] ?? ''
        );

        $sheet->setCellValue(
            'V' . $linhaAtual,
            $empresa['distribuicao_dirf'] ?? ''
        );

        $sheet->setCellValue(
            'W' . $linhaAtual,
            $empresa['defs'] ?? ''
        );

        $sheet->setCellValue(
            'X' . $linhaAtual,
            $empresa['dasn'] ?? ''
        );

        $sheet->setCellValue(
            'Y' . $linhaAtual,
            $empresa['ecd'] ?? ''
        );

        $sheet->setCellValue(
            'Z' . $linhaAtual,
            $empresa['ecf'] ?? ''
        );

        $linhaAtual++;
    }
}

// Ajusta automaticamente a largura das colunas
foreach (range('A', 'Z') as $colunaID) {
    $sheet->getColumnDimension($colunaID)->setAutoSize(true);
}

// Nome do arquivo
$nome_arquivo = sprintf(
    'relatorio_contabil_%s_%s_%s.xlsx',
    $ano_selecionado,
    $mes_ano_str,
    date('Y-m-d')
);

// Evita qualquer saída anterior corromper o arquivo
while (ob_get_level() > 0) {
    ob_end_clean();
}

// Cabeçalhos de download
header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment; filename="' . $nome_arquivo . '"');
header('Cache-Control: max-age=0');
header('Pragma: public');

// Gera o Excel
$writer = new Xlsx($spreadsheet);
$writer->save('php://output');

exit();