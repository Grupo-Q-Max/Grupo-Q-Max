<?php
// exportar_parcelamentos_csv.php
session_start();
require_once 'assets/backend/config.php';

// 1. Verificação de Segurança
$tipos_permitidos = ['admin', 'lider_fiscal', 'fiscal'];
if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['tipo_conta'], $tipos_permitidos)) {
    die("Acesso negado.");
}

$usuario_id_logado = $_SESSION['usuario_id'];
$tipo_conta_logado = $_SESSION['tipo_conta'];

// 2. Captura os Filtros (Mesma lógica da tabela)
// 2. Captura os Filtros (Sincronizado com a tela principal)
$ano_padrao = date('Y');
$busca = trim($_GET['busca'] ?? '');
$status_filtro = $_GET['status'] ?? '';
$ano_selecionado = (int)($_GET['ano'] ?? $ano_padrao);

// Captura o mês enviado pelo formulário (padrão é o mês atual se não vier nada)
$mes_selecionado = (int)($_GET['mes'] ?? date('n'));

// Mapa para converter número em nome da coluna no banco
$mapa_meses = [
    1 => 'janeiro', 2 => 'fevereiro', 3 => 'marco', 4 => 'abril',
    5 => 'maio', 6 => 'junho', 7 => 'julho', 8 => 'agosto',
    9 => 'setembro', 10 => 'outubro', 11 => 'novembro', 12 => 'dezembro'
];

// Define a coluna. Se o mês for inválido, usa o mês atual.
$coluna_mes = $mapa_meses[$mes_selecionado] ?? $mapa_meses[(int)date('n')];

// Filtro SQL (Apenas Ano, liberado para Fiscal)
$sql_where_clausula = 'WHERE cm.ano = ?';
$params = [$ano_selecionado];
$types = 'i';

if (!empty($busca)) {
    $sql_where_clausula .= ' AND (p.nome_empresa LIKE ? OR p.codigo_empresa LIKE ? OR p.cnpj_empresa LIKE ?)';
    $busca_param = "%{$busca}%";
    array_push($params, $busca_param, $busca_param, $busca_param);
    $types .= 'sss';
}

if (!empty($status_filtro)) {
    $sql_where_clausula .= ' AND p.status = ?';
    $params[] = $status_filtro;
    $types .= 's';
}

// SQL corrigida (Note a variável $coluna_mes dentro do MAX)
$sql = "
    SELECT
        p.codigo_empresa,
        MAX(p.nome_empresa) AS nome_empresa,
        MAX(p.cnpj_empresa) AS cnpj_empresa,
        TRIM(p.parcelamento) AS parcelamento,
        p.valor,
        MAX(p.qtde_parcelas) AS qtde_parcelas,
        p.data_efetivacao AS data_inicio,
        MAX(p.data_final) AS data_final,
        MAX(p.status) AS status,
        MAX(p.$coluna_mes) AS valor_mes
    FROM parcelamentos p
    INNER JOIN controle_meses cm ON p.id_mes = cm.id
    $sql_where_clausula
    GROUP BY p.codigo_empresa, TRIM(p.parcelamento), p.data_efetivacao, p.valor, cm.ano
    ORDER BY p.codigo_empresa ASC
";

$stmt = $conexao->prepare($sql);
$stmt->bind_param($types, ...$params);
$stmt->execute();
$result = $stmt->get_result();

// 4. Configura os Headers para Download do Excel (CSV)
$filename = "Parcelamentos_" . $ano_selecionado . ".csv";
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');

// Cria o arquivo na saída do PHP
$output = fopen('php://output', 'w');

// Adiciona o BOM para o Excel reconhecer acentos (UTF-8)
fprintf($output, chr(0xEF) . chr(0xBB) . chr(0xBF));

// 5. Cabeçalhos das Colunas
fputcsv($output, [
    'Código',
    'Empresa',
    'CNPJ',
    'Parcelamento',
    'Valor (R$)',
    'Qtde',
    'Início',
    'Fim',
    'Status',
ucfirst($mapa_meses[$mes_selecionado])

], ';', '"', "\\");

// 6. Dados
while ($row = $result->fetch_assoc()) {
    // Formata datas e valores
    $inicio = $row['data_inicio'] ? date('d/m/Y', strtotime($row['data_inicio'])) : '';
    $fim = $row['data_final'] ? date('d/m/Y', strtotime($row['data_final'])) : '';
    $valor = number_format($row['valor'], 2, ',', '.');

    $linha = [
        $row['codigo_empresa'],
        $row['nome_empresa'],
        $row['cnpj_empresa'],
        $row['parcelamento'],
        $valor,
        $row['qtde_parcelas'],
        $inicio,
        $fim,
        ucfirst($row['status']),
$row['valor_mes']

    ];

    fputcsv($output, $linha, ';', '"', "\\");
}

fclose($output);
$stmt->close();
exit();
