<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once 'config.php';
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['usuario_id'])) {
    echo json_encode(['success' => false, 'message' => 'Não autorizado']);
    exit;
}

$id_controle = isset($_POST['id_controle']) ? (int)$_POST['id_controle'] : 0;
$usuario_id = $_SESSION['usuario_id'] ?? null;

if (!$id_controle) {
    echo json_encode(['success' => false, 'message' => 'ID Inválido']);
    exit;
}

// Garante que a tabela carne_leao_detalhes exista
$conexao->query("CREATE TABLE IF NOT EXISTS carne_leao_detalhes (
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
    UNIQUE KEY (id_controle_fechamento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

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

// Garantir que as colunas sejam VARCHAR(255) para aceitar textos e strings vazias sem erro de STRICT SQL decimal
$conexao->query("ALTER TABLE carne_leao_detalhes MODIFY COLUMN recibo_saude VARCHAR(255) NULL DEFAULT NULL");
$conexao->query("ALTER TABLE carne_leao_detalhes MODIFY COLUMN receitas_diversas VARCHAR(255) NULL DEFAULT NULL");
$conexao->query("ALTER TABLE carne_leao_detalhes MODIFY COLUMN despesas_dedutiveis VARCHAR(255) NULL DEFAULT NULL");
$conexao->query("ALTER TABLE carne_leao_detalhes MODIFY COLUMN inss VARCHAR(255) NULL DEFAULT NULL");
$conexao->query("ALTER TABLE carne_leao_detalhes MODIFY COLUMN iss VARCHAR(255) NULL DEFAULT NULL");
$conexao->query("ALTER TABLE carne_leao_detalhes MODIFY COLUMN irrf VARCHAR(255) NULL DEFAULT NULL");

$status_forced = trim($_POST['status_forced'] ?? '');

$recibo_saude       = trim($_POST['recibo_saude'] ?? '');
$receitas_diversas  = trim($_POST['receitas_diversas'] ?? '');
$despesas_dedutiveis = trim($_POST['despesas_dedutiveis'] ?? '');
$inss               = trim($_POST['inss'] ?? '');
$iss                = trim($_POST['iss'] ?? '');
$irrf               = trim($_POST['irrf'] ?? '');

$check = $conexao->prepare("SELECT id FROM carne_leao_detalhes WHERE id_controle_fechamento = ?");
$check->bind_param('i', $id_controle);
$check->execute();
$res = $check->get_result();

if ($res->num_rows > 0) {
    $sql = "UPDATE carne_leao_detalhes SET recibo_saude=?, receitas_diversas=?, despesas_dedutiveis=?, inss=?, iss=?, irrf=?, usuario_atualizacao=?, data_atualizacao=NOW() WHERE id_controle_fechamento=?";
    $stmt = $conexao->prepare($sql);
    $stmt->bind_param('ssssssii', $recibo_saude, $receitas_diversas, $despesas_dedutiveis, $inss, $iss, $irrf, $usuario_id, $id_controle);
} else {
    $sql = "INSERT INTO carne_leao_detalhes (id_controle_fechamento, recibo_saude, receitas_diversas, despesas_dedutiveis, inss, iss, irrf, usuario_atualizacao, data_atualizacao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())";
    $stmt = $conexao->prepare($sql);
    $stmt->bind_param('issssssi', $id_controle, $recibo_saude, $receitas_diversas, $despesas_dedutiveis, $inss, $iss, $irrf, $usuario_id);
}

if ($stmt->execute()) {
    $status_texto = null;

    if (!empty($status_forced)) {
        $status_texto = $status_forced;
    } else {
        $campos = [
            $recibo_saude,
            $receitas_diversas,
            $despesas_dedutiveis,
            $inss,
            $iss,
            $irrf
        ];

        $preenchidos = 0;
        $total = count($campos);
        foreach ($campos as $valor) {
            if ($valor !== '' && $valor !== '...') {
                $preenchidos++;
            }
        }

        if ($preenchidos === $total) {
            $status_texto = "Preenchido";
        } elseif ($preenchidos > 0) {
            $status_texto = "Pendente ({$preenchidos}/{$total})";
        } else {
            $status_texto = "Pendente";
        }
    }

    $upd = $conexao->prepare("UPDATE controle_fechamento SET carne_leao = ? WHERE id = ?");
    $upd->bind_param('si', $status_texto, $id_controle);

    if ($upd->execute()) {
        echo json_encode(['success' => true, 'novo_status' => $status_texto]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Erro ao atualizar status: ' . $upd->error]);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Erro ao salvar detalhes: ' . $stmt->error]);
}
