<?php
session_start();
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once 'assets/backend/config.php';
require_once 'funcoes_contabil_admin.php';

header('Content-Type: application/json');

// 1. VERIFICAÇÃO DE SEGURANÇA
if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['tipo_conta'], ['admin', 'lider_contabil'])) {
    echo json_encode(['success' => false, 'message' => 'Acesso negado.']);
    exit();
}

$ano_selecionado = $_GET['ano'] ?? null;
$mes_id = $_GET['mes_id'] ?? null;

if (!$ano_selecionado || !$mes_id) {
    echo json_encode(['success' => false, 'message' => 'Ano ou Mês não selecionado.']);
    exit();
}

try {

    // 2. BUSCA AS EMPRESAS VÁLIDAS
    // Força o status 'todas' para incluir ativas e inativas, ignorando filtros da tela
    $filtros_validos = [
        'status'         => 'todas', // <-- A CORREÇÃO PRINCIPAL
        'busca'          => '',
        'responsavel_id' => '',
        'tributacao'     => '',
        'grupo'          => ''
    ];

    // Chamamos a função com os filtros corretos
    $resultado_validas = obterEmpresasContabeisAdmin($conexao, $ano_selecionado, $mes_id, $filtros_validos);

    if ($resultado_validas === null) {
        throw new Exception("A função 'obterEmpresasContabeisAdmin' falhou. Verifique 'funcoes_contabil_admin.php' para erros de SQL.");
    }

    $empresas_validas = $resultado_validas->fetch_all(MYSQLI_ASSOC);
    $ids_validos = array_column($empresas_validas, 'id');


    // 3. BUSCA TODAS AS EMPRESAS DAQUELE MÊS (para comparar)
    // A lógica de "total" é todas as empresas do mês/ano que não são MEI e pertencem ao contábil
    $sql_total = "
        SELECT id, codigo, empresa, setores_permitidos 
        FROM controle_fechamento 
        WHERE id_mes = ? 
        AND tributacao != 'mei'
        AND (
            setores_permitidos IS NULL 
            OR setores_permitidos = '' 
            OR FIND_IN_SET('contabil', REPLACE(setores_permitidos, ' ', '')) > 0
        )
    ";

    $stmt_total = $conexao->prepare($sql_total);
    if ($stmt_total === false) {
        throw new Exception("Falha ao preparar a consulta de 'todas_empresas' (Contabil): " . $conexao->error);
    }

    $stmt_total->bind_param('i', $mes_id);
    $stmt_total->execute();
    $resultado_total = $stmt_total->get_result();
    $todas_empresas = $resultado_total->fetch_all(MYSQLI_ASSOC);
    $stmt_total->close();

    $falhas = [];
    $total_empresas = count($todas_empresas);

    // 4. COMPARA AS DUAS LISTAS
    if ($total_empresas > 0) {
        foreach ($todas_empresas as $empresa) {
            if (!in_array($empresa['id'], $ids_validos)) {

                $setor = $empresa['setores_permitidos'];

                if (empty($setor)) {
                    $motivo = "Setor/Permissão não definido (vazio ou nulo)";
                } else {
                    $motivo = "Setor/Permissão: '" . htmlspecialchars($setor) . "'";
                }

                $falhas[] = [
                    'codigo' => $empresa['codigo'],
                    'empresa' => $empresa['empresa'],
                    'motivo' => $motivo . " (ou status 'inativa' não sendo pego)"
                ];
            }
        }
    }

    // 5. RETORNA O RELATÓRIO JSON
    echo json_encode([
        'success' => true,
        'total' => $total_empresas,
        'validas' => count($empresas_validas),
        'falhas' => $falhas
    ]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Erro capturado: ' . $e->getMessage()]);
}
