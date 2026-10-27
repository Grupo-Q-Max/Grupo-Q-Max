<?php
require 'assets/backend/config.php';
session_start();

header('Content-Type: application/json');

// --- Validações Iniciais ---
if (!isset($_SESSION['tipo_conta']) || $_SESSION['tipo_conta'] !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'Acesso não autorizado']);
    exit();
}

if (!isset($_GET['mes_id']) || !is_numeric($_GET['mes_id'])) {
    echo json_encode(['success' => false, 'message' => 'ID do mês não fornecido']);
    exit();
}

$mes_id = (int)$_GET['mes_id'];

// --- Arrays de Configuração e Função de Cálculo (Lógica unificada) ---
$lista_tributacoes = [
    'mei'                     => ['label' => 'MEI'],
    'simples_nacional'        => ['label' => 'Simples Nacional'],
    'lucro_presumido'         => ['label' => 'Lucro Presumido'],
    'lucro_real/trimestral'   => ['label' => 'Lucro Real/Trimestral'],
    'lucro_real/estimativa'   => ['label' => 'Lucro Real/Estimativa'],
    'lucro_real/anual'        => ['label' => 'Lucro Real/Anual'],
    'imune_irpj'              => ['label' => 'Imune IRPJ'],
    'condominios'             => ['label' => 'Condomínios'],
    'domestica'               => ['label' => 'Doméstica'],
    'associacoes'             => ['label' => 'Associações'],
    'pessoa_fisica'           => ['label' => 'Pessoa Física']
];
$campos_obrigatorios_dp = ['adto', 'folha_pagamento', 'data_pagamento', 'qtde_funcionarios', 'guias_sindicato', 'fgts_digital', 'e_social', 'dctf_web_mes', 'sd_login', 'sd_senha'];
$campos_obrigatorios_fiscal = ['reinf', 'impostos', 'iss', 'mit', 'sped_fiscal', 'sped_contribuicao', 'destda', 'gia'];
$campos_obrigatorios_contabil = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro', 'balancete', 'distribuicao_dirf', 'defs', 'dasn', 'ecd', 'ecf'];
$campos_obrigatorios_cushman = ['iss_cushman', 'devec_cushman', 'sped_fiscal_cushman', 'reinf_cushman', 'esocial_cushman']; 

function calcularProgressoGeral($conexao, $id_mes, $campos_obrigatórios, $nome_setor)
{
    $sql_base = "SELECT * FROM controle_fechamento WHERE id_mes = ? AND (data_saida IS NULL OR data_saida > CURDATE())";
    $sql_permissao = ($nome_setor === 'cushman') ? " AND FIND_IN_SET(?, setores_permitidos) > 0" : " AND (setores_permitidos IS NULL OR setores_permitidos = '' OR FIND_IN_SET(?, setores_permitidos) > 0)";

    $stmt_empresas = $conexao->prepare($sql_base . $sql_permissao);
    $stmt_empresas->bind_param('is', $id_mes, $nome_setor);
    $stmt_empresas->execute();
    $empresas = $stmt_empresas->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt_empresas->close();

    $total_empresas = count($empresas);
    $empresas_completas = 0;
    $total_campos_possiveis = 0;
    $campos_preenchidos = 0;
    foreach ($empresas as $empresa) {
        $empresa_completa = true;
        foreach ($campos_obrigatórios as $campo) {
            $total_campos_possiveis++;
            if (!empty(trim($empresa[$campo] ?? ''))) {
                $campos_preenchidos++;
            } else {
                $empresa_completa = false;
            }
        }
        if ($empresa_completa) {
            $empresas_completas++;
        }
    }

    $progresso_por_campo = ($total_campos_possiveis > 0) ? round(($campos_preenchidos / $total_campos_possiveis) * 100) : 0;
    $progresso_por_empresa = ($total_empresas > 0) ? round(($empresas_completas / $total_empresas) * 100) : 0;

    return [
        'progresso_por_campo' => $progresso_por_campo,
        'campos_preenchidos' => $campos_preenchidos,
        'total_campos' => $total_campos_possiveis,
        'progresso_por_empresa' => $progresso_por_empresa,
        'empresas_completas' => $empresas_completas,
        'total_empresas' => $total_empresas,
    ];
}


// --- Execução das Consultas ---

// Busca o Mês e Ano para as consultas seguintes
$stmt_mes = $conexao->prepare("SELECT mes, ano FROM controle_meses WHERE id = ?");
$stmt_mes->bind_param('i', $mes_id);
$stmt_mes->execute();
$result_mes = $stmt_mes->get_result();
if ($result_mes->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'Mês não encontrado']);
    exit();
}
$mes_info = $result_mes->fetch_assoc();
$mes_numero = $mes_info['mes'];
$ano = $mes_info['ano'];

// 1. Consulta para os Contadores de Empresa
$sql_cases = "";
foreach ($lista_tributacoes as $nome_db => $dados) {
    $chave_segura = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $dados['label']));
    $sql_cases .= "SUM(CASE WHEN tributacao = '{$nome_db}' THEN 1 ELSE 0 END) as {$chave_segura}, ";
}
$sql_contadores = "SELECT {$sql_cases} COUNT(*) as total, COALESCE(SUM(qtde_funcionarios), 0) as total_funcionarios FROM controle_fechamento WHERE id_mes = ? AND (data_saida IS NULL OR data_saida > CURDATE())";
$stmt_contadores = $conexao->prepare($sql_contadores);
$stmt_contadores->bind_param('i', $mes_id);
$stmt_contadores->execute();
$contadores = $stmt_contadores->get_result()->fetch_assoc();

// 2. Consulta para Novos Contratos
$sql_novos = "SELECT empresa, tributacao, DATE_FORMAT(MIN(data_contrato), '%d/%m/%Y') as data_contrato_formatada, DATE_FORMAT(MIN(data_obrigacao), '%d/%m/%Y') as data_obrigacao_formatada, IF(MIN(data_saida) IS NULL, 'N/A', DATE_FORMAT(MIN(data_saida), '%d/%m/%Y')) as data_saida_formatada FROM controle_fechamento WHERE id_mes = ? AND MONTH(data_contrato) = ? AND YEAR(data_contrato) = ? GROUP BY codigo";
$stmt_novos = $conexao->prepare($sql_novos);
$stmt_novos->bind_param('iii', $mes_id, $mes_numero, $ano);
$stmt_novos->execute();
$novos_contratos = $stmt_novos->get_result()->fetch_all(MYSQLI_ASSOC);

// 3. Consulta para Contratos Encerrados
$sql_sairam = "SELECT empresa, tributacao, DATE_FORMAT(MIN(data_contrato), '%d/%m/%Y') as data_contrato_formatada, IF(MIN(data_saida) IS NULL, 'N/A', DATE_FORMAT(MIN(data_saida), '%d/%m/%Y')) as data_saida_formatada FROM controle_fechamento WHERE data_saida IS NOT NULL AND MONTH(data_saida) = ? AND YEAR(data_saida) = ? GROUP BY codigo";
$stmt_sairam = $conexao->prepare($sql_sairam);
// Atenção: Esta consulta não depende de id_mes, apenas do mês e ano da data de saída.
$stmt_sairam->bind_param('ii', $mes_numero, $ano);
$stmt_sairam->execute();
$contratos_sairam = $stmt_sairam->get_result()->fetch_all(MYSQLI_ASSOC);


// --- Montagem da Resposta JSON Final ---
echo json_encode([
    'success' => true,
    'contadores' => $contadores, // Estrutura correta para o JavaScript
    'progresso_dp' => calcularProgressoGeral($conexao, $mes_id, $campos_obrigatorios_dp, 'dp'),
    'progresso_fiscal' => calcularProgressoGeral($conexao, $mes_id, $campos_obrigatorios_fiscal, 'fiscal'),
    'progresso_contabil' => calcularProgressoGeral($conexao, $mes_id, $campos_obrigatorios_contabil, 'contabil'),
    'progresso_cushman' => calcularProgressoGeral($conexao, $mes_id, $campos_obrigatorios_cushman, 'cushman'),
    'novos_contratos' => $novos_contratos,
    'contratos_sairam' => $contratos_sairam
]);
