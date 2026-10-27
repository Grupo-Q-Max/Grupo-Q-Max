<?php

ini_set('display_errors', 1);
error_reporting(E_ALL);

session_start();
require_once 'assets/backend/config.php';
require_once 'assets/backend/functions/funcoes_gerais.php';

header('Content-Type: application/json');

if (!isset($_SESSION['usuario_id']) || $_SESSION['tipo_conta'] !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'Acesso não autorizado.']);
    exit();
}

if (
    !isset($_POST['id_antigo'], $_POST['nova_tributacao'], $_POST['novo_codigo'], $_POST['data_inicio']) ||
    empty($_POST['id_antigo']) || empty($_POST['nova_tributacao']) || empty($_POST['novo_codigo']) || empty($_POST['data_inicio'])
) {
    echo json_encode(['success' => false, 'message' => 'Dados incompletos para a replicação.']);
    exit();
}

$id_antigo = filter_input(INPUT_POST, 'id_antigo', FILTER_VALIDATE_INT);
$nova_tributacao = trim($_POST['nova_tributacao']);
$novo_codigo = trim($_POST['novo_codigo']);
$data_inicio_novo_regime = trim($_POST['data_inicio']);

$conexao->begin_transaction();

try {
    $stmt_buscar = $conexao->prepare("SELECT * FROM controle_fechamento WHERE id = ?");
    $stmt_buscar->bind_param('i', $id_antigo);
    $stmt_buscar->execute();
    $dados_antigos = $stmt_buscar->get_result()->fetch_assoc();

    if (!$dados_antigos) {
        throw new Exception("Empresa original não encontrada para replicação.");
    }

    $data_saida_antigo = date('Y-m-d', strtotime($data_inicio_novo_regime . ' -1 day'));
    $stmt_aposentar = $conexao->prepare("UPDATE controle_fechamento SET data_saida = ? WHERE id = ?");
    $stmt_aposentar->bind_param('si', $data_saida_antigo, $id_antigo);
    $stmt_aposentar->execute();

    $id_novo_mes = obterMesAtualAberto($conexao);
    if (!$id_novo_mes) {
        throw new Exception("Não há um mês aberto no sistema para inserir a nova empresa.");
    }

    $dados_novos = $dados_antigos;
    unset($dados_novos['id']); 

    $dados_novos['codigo'] = $novo_codigo;
    $dados_novos['tributacao'] = $nova_tributacao;
    $dados_novos['data_contrato'] = $data_inicio_novo_regime;
    $dados_novos['data_obrigacao'] = $data_inicio_novo_regime;
    $dados_novos['data_saida'] = null;
    $dados_novos['id_mes'] = $id_novo_mes;
    $dados_novos['id_matriz'] = $id_antigo;

    $campos_a_zerar = [
        'status',
        'adto',
        'folha_pagamento',
        'data_pagamento',
        'guias_sindicato',
        'fgts_digital',
        'e_social',
        'dctf_web_mes',
        'reinf',
        'iss',
        'mit',
        'dec_estadual',
        'sped_fiscal',
        'sped_contribuicao',
        'destda',
        'gia',
        'dctf',
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
        'dezembro',
        'balancete',
        'distribuicao_dirf',
        'defs',
        'dasn',
        'ecd',
        'ecf',
        'iss_cushman',
        'devec_cushman',
        'sped_fiscal_cushman',
        'reinf_cushman',
        'esocial_cushman'
    ];
    foreach ($campos_a_zerar as $campo) {
        if (array_key_exists($campo, $dados_novos)) {
            $dados_novos[$campo] = ($campo === 'status') ? 'Pendente' : null;
        }
    }

    $colunas = array_keys($dados_novos);
    $placeholders = implode(', ', array_fill(0, count($colunas), '?'));
    $sql_insert = "INSERT INTO controle_fechamento (`" . implode('`, `', $colunas) . "`) VALUES ($placeholders)";

    $stmt_inserir = $conexao->prepare($sql_insert);

    $valores = array_values($dados_novos);
    $tipos = '';
    foreach ($valores as $valor) {
        if (is_int($valor)) $tipos .= 'i';
        elseif (is_float($valor)) $tipos .= 'd';
        else $tipos .= 's';
    }

    if (count($valores) > 0) {
        $stmt_inserir->bind_param($tipos, ...$valores);
    }

    if (!$stmt_inserir->execute()) {
        throw new Exception("Erro ao inserir a nova empresa: " . $stmt_inserir->error);
    }

    $conexao->commit();
    echo json_encode(['success' => true, 'message' => 'Empresa replicada com sucesso! Um novo registro foi criado com o código ' . $novo_codigo]);
} catch (Exception $e) {
    $conexao->rollback();
    echo json_encode(['success' => false, 'message' => 'Erro ao replicar: ' . $e->getMessage()]);
}

$conexao->close();
