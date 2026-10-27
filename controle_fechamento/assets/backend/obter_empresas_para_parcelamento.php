<?php
// assets/backend/obter_empresas_para_parcelamento.php
session_start();
ini_set('display_errors', 1);
error_reporting(E_ALL);
require_once 'config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['tipo_conta'], ['admin', 'lider_fiscal', 'fiscal'])) {
    echo json_encode(['success' => false, 'message' => 'Acesso não autorizado.']);
    exit();
}

try {
    // 1. Busca a lista de TODAS as empresas (a entrada mais recente de cada)
    // Usamos uma subquery para encontrar o ID mais recente (último mês) para cada empresa (agrupada por código).
    // Isso garante que peguemos empresas ativas e inativas (que já saíram).
    $sql_empresas = "
        SELECT 
            cf.id, 
            cf.codigo, 
            cf.empresa, 
            cf.cnpj,
            cf.data_saida -- Precisamos disto para o filtro de status
        FROM controle_fechamento cf
        INNER JOIN (
            -- Subquery para encontrar o ID mais recente
            SELECT codigo, MAX(id) AS max_id
            FROM controle_fechamento
            WHERE codigo IS NOT NULL AND codigo != ''
            GROUP BY codigo
        ) AS t_max ON cf.id = t_max.max_id
        ORDER BY cf.empresa ASC
    ";

    $stmt_empresas = $conexao->prepare($sql_empresas);

    if (!$stmt_empresas) {
        throw new Exception("Falha ao preparar a consulta de empresas: " . $conexao->error);
    }

    $stmt_empresas->execute();
    $result_empresas = $stmt_empresas->get_result();
    $empresas = $result_empresas->fetch_all(MYSQLI_ASSOC);
    $stmt_empresas->close();


    // 2. Busca a lista de responsáveis do setor fiscal (lógica inalterada).
    $stmt_responsaveis = $conexao->prepare(
        "SELECT id, nome FROM usuarios
         WHERE tipo_conta IN ('fiscal', 'lider_fiscal', 'admin')
         ORDER BY nome ASC"
    );
    if (!$stmt_responsaveis) {
        throw new Exception("Falha ao preparar a consulta de responsáveis: " . $conexao->error);
    }
    $stmt_responsaveis->execute();
    $result_responsaveis = $stmt_responsaveis->get_result();
    $responsaveis = $result_responsaveis->fetch_all(MYSQLI_ASSOC);
    $stmt_responsaveis->close();

    // Envia a resposta em formato JSON
    echo json_encode([
        'success' => true,
        'empresas' => $empresas,
        'responsaveis' => $responsaveis
    ]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Erro ao buscar dados: ' . $e->getMessage()]);
}

$conexao->close();
