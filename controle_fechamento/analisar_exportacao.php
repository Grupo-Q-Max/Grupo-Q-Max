<?php
session_start();
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once 'assets/backend/config.php';

header('Content-Type: application/json');

if (!isset($_SESSION['usuario_id']) || !in_array($_SESSION['tipo_conta'], ['admin', 'lider_contabil', 'lider_fiscal'])) {
    echo json_encode(['success' => false, 'message' => 'Acesso negado.']);
    exit();
}

$mes_id = $_GET['mes_id'] ?? null;
if (!$mes_id) {
    echo json_encode(['success' => false, 'message' => 'Mês não selecionado.']);
    exit();
}

try {

    $sql_validas = "
        SELECT cf.id, cf.codigo, cf.empresa, cf.setores_permitidos
        FROM controle_fechamento cf
        JOIN controle_meses cm ON cf.id_mes = cm.id
        WHERE cf.id_mes = ?
        AND (
            cf.setores_permitidos IS NULL 
            OR cf.setores_permitidos = ''
            OR FIND_IN_SET('fiscal', REPLACE(cf.setores_permitidos, ' ', '')) > 0
        )
        GROUP BY cf.id
    ";

    $stmt_validas = $conexao->prepare($sql_validas);
    if ($stmt_validas === false) {
        throw new Exception("A consulta SQL manual para 'validas' falhou: " . $conexao->error);
    }

    $stmt_validas->bind_param('i', $mes_id);
    $stmt_validas->execute();
    $resultado_validas = $stmt_validas->get_result();

    if ($resultado_validas === false) {
        throw new Exception("A execução da consulta 'validas' falhou: " . $stmt_validas->error);
    }

    $empresas_validas = $resultado_validas->fetch_all(MYSQLI_ASSOC);
    $ids_validos = array_column($empresas_validas, 'id');
    $stmt_validas->close();


    $sql_total = "SELECT id, codigo, empresa, setores_permitidos FROM controle_fechamento WHERE id_mes = ?";

    $stmt_total = $conexao->prepare($sql_total);
    if ($stmt_total === false) {
        throw new Exception("Falha ao preparar a consulta de 'todas_empresas': " . $conexao->error);
    }

    $stmt_total->bind_param('i', $mes_id);
    $stmt_total->execute();
    $resultado_total = $stmt_total->get_result();
    $todas_empresas = $resultado_total->fetch_all(MYSQLI_ASSOC);
    $stmt_total->close();

    $falhas = [];
    $total_empresas = count($todas_empresas);

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
                    'motivo' => $motivo
                ];
            }
        }
    }

    echo json_encode([
        'success' => true,
        'total' => $total_empresas,
        'validas' => count($empresas_validas),
        'falhas' => $falhas
    ]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Erro capturado: ' . $e->getMessage()]);
}
