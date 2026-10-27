<?php

require_once 'config.php';

header('Content-Type: application/json; charset=utf-8');

$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;

if ($id <= 0) {
    echo json_encode([
        'success' => false,
        'message' => 'ID inválido'
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

try {
    $sqlCriarTabela = "
        CREATE TABLE IF NOT EXISTS carne_leao_detalhes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            id_controle_fechamento INT NOT NULL,
            recibo_saude VARCHAR(255) DEFAULT NULL,
            receitas_diversas VARCHAR(255) DEFAULT NULL,
            despesas_dedutiveis VARCHAR(255) DEFAULT NULL,
            inss VARCHAR(255) DEFAULT NULL,
            iss VARCHAR(255) DEFAULT NULL,
            irrf VARCHAR(255) DEFAULT NULL,
            usuario_atualizacao INT DEFAULT NULL,
            data_atualizacao DATETIME DEFAULT NULL,
            UNIQUE KEY uk_carne_leao_controle (
                id_controle_fechamento
            )
        ) ENGINE=InnoDB
          DEFAULT CHARSET=utf8mb4
          COLLATE=utf8mb4_unicode_ci
    ";

    if (!$conexao->query($sqlCriarTabela)) {
        throw new Exception(
            'Erro ao criar tabela: ' . $conexao->error
        );
    }

    // Garantir que todas as colunas necessárias existam na tabela caso ela já existisse com estrutura antiga
    $colunasNecessarias = [
        'id_controle_fechamento' => 'INT DEFAULT NULL',
        'recibo_saude' => 'VARCHAR(255) DEFAULT NULL',
        'receitas_diversas' => 'VARCHAR(255) DEFAULT NULL',
        'despesas_dedutiveis' => 'VARCHAR(255) DEFAULT NULL',
        'inss' => 'VARCHAR(255) DEFAULT NULL',
        'iss' => 'VARCHAR(255) DEFAULT NULL',
        'irrf' => 'VARCHAR(255) DEFAULT NULL',
        'usuario_atualizacao' => 'INT DEFAULT NULL',
        'data_atualizacao' => 'DATETIME DEFAULT NULL'
    ];

    $resCols = $conexao->query("SHOW COLUMNS FROM carne_leao_detalhes");
    $colunasExistentes = [];
    if ($resCols) {
        while ($rowCol = $resCols->fetch_assoc()) {
            $colunasExistentes[] = strtolower($rowCol['Field']);
        }
    }

    foreach ($colunasNecessarias as $nomeCol => $defCol) {
        if (!in_array(strtolower($nomeCol), $colunasExistentes)) {
            $conexao->query("ALTER TABLE carne_leao_detalhes ADD COLUMN {$nomeCol} {$defCol}");
        }
    }

    $conexao->query("ALTER TABLE carne_leao_detalhes MODIFY COLUMN recibo_saude VARCHAR(255) NULL DEFAULT NULL");
    $conexao->query("ALTER TABLE carne_leao_detalhes MODIFY COLUMN receitas_diversas VARCHAR(255) NULL DEFAULT NULL");
    $conexao->query("ALTER TABLE carne_leao_detalhes MODIFY COLUMN despesas_dedutiveis VARCHAR(255) NULL DEFAULT NULL");
    $conexao->query("ALTER TABLE carne_leao_detalhes MODIFY COLUMN inss VARCHAR(255) NULL DEFAULT NULL");
    $conexao->query("ALTER TABLE carne_leao_detalhes MODIFY COLUMN iss VARCHAR(255) NULL DEFAULT NULL");
    $conexao->query("ALTER TABLE carne_leao_detalhes MODIFY COLUMN irrf VARCHAR(255) NULL DEFAULT NULL");

    $stmt = $conexao->prepare("
        SELECT
            recibo_saude,
            receitas_diversas,
            despesas_dedutiveis,
            inss,
            iss,
            irrf
        FROM carne_leao_detalhes
        WHERE id_controle_fechamento = ?
        LIMIT 1
    ");

    if (!$stmt) {
        throw new Exception(
            'Erro ao preparar detalhes: ' . $conexao->error
        );
    }

    $stmt->bind_param('i', $id);
    $stmt->execute();

    $resultado = $stmt->get_result();
    $dados = $resultado->fetch_assoc();

    $stmt->close();

    if (!$dados) {
        $dados = [
            'recibo_saude' => '',
            'receitas_diversas' => '',
            'despesas_dedutiveis' => '',
            'inss' => '',
            'iss' => '',
            'irrf' => ''
        ];
    }

    $stmtStatus = $conexao->prepare("
        SELECT carne_leao
        FROM controle_fechamento
        WHERE id = ?
        LIMIT 1
    ");

    if (!$stmtStatus) {
        throw new Exception(
            'Erro ao preparar status: ' . $conexao->error
        );
    }

    $stmtStatus->bind_param('i', $id);
    $stmtStatus->execute();

    $resultadoStatus = $stmtStatus->get_result();
    $registroStatus = $resultadoStatus->fetch_assoc();

    $stmtStatus->close();

    if (!$registroStatus) {
        echo json_encode([
            'success' => false,
            'message' => 'Empresa não encontrada'
        ], JSON_UNESCAPED_UNICODE);

        exit;
    }

    $dados['status_atual'] =
        $registroStatus['carne_leao'] ?? '';

    echo json_encode([
        'success' => true,
        'dados' => $dados
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $erro) {
    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => $erro->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}