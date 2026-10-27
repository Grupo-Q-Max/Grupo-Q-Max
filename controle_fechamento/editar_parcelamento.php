<?php
// editar_parcelamento.php

session_start();

ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once 'assets/backend/config.php';

// =========================================================
// PERMISSÃO
// =========================================================

$tipos_permitidos = ['admin', 'lider_fiscal', 'fiscal'];

if (
    !isset($_SESSION['usuario_id']) ||
    !isset($_SESSION['tipo_conta']) ||
    !in_array($_SESSION['tipo_conta'], $tipos_permitidos, true)
) {
    $_SESSION['mensagem'] = 'Você não tem permissão para editar parcelamentos.';
    header('Location: tabela_parcelamento.php');
    exit();
}

// =========================================================
// ID DO PARCELAMENTO
// =========================================================

$parcelamento_id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);

if (!$parcelamento_id) {
    header('Location: tabela_parcelamento.php');
    exit();
}

// =========================================================
// FUNÇÃO PARA NORMALIZAR VALOR MONETÁRIO
// Exemplos:
// 1500        -> 1500.00
// 1500,50     -> 1500.50
// 1.500,50    -> 1500.50
// R$ 1.500,50 -> 1500.50
// =========================================================

function normalizarValorMonetario($valor)
{
    $valor = trim((string) $valor);

    if ($valor === '') {
        return null;
    }

    // Remove R$ e espaços
    $valor = str_replace(['R$', ' ', "\xc2\xa0"], '', $valor);

    /*
     * Se possui vírgula, consideramos formato brasileiro.
     * Exemplo:
     * 1.234,56 -> 1234.56
     */
    if (strpos($valor, ',') !== false) {
        $valor = str_replace('.', '', $valor);
        $valor = str_replace(',', '.', $valor);
    }

    // Remove qualquer caractere que não seja número, ponto ou sinal negativo
    $valor = preg_replace('/[^0-9.\-]/', '', $valor);

    if ($valor === '' || !is_numeric($valor)) {
        return false;
    }

    return (float) $valor;
}

// =========================================================
// SALVAR ALTERAÇÕES
// =========================================================

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    $parcelamento_nome = trim($_POST['parcelamento'] ?? '');

    $qtde_parcelas = isset($_POST['qtde_parcelas']) && $_POST['qtde_parcelas'] !== ''
        ? (int) $_POST['qtde_parcelas']
        : null;

    $data_efetivacao = trim($_POST['data_efetivacao'] ?? '');

    if ($data_efetivacao === '') {
        $data_efetivacao = null;
    }

    $data_final = trim($_POST['data_final'] ?? '');

    if ($data_final === '') {
        $data_final = null;
    }

    $valor_recebido = $_POST['valor'] ?? '';

    $valor = normalizarValorMonetario($valor_recebido);

    if ($valor === false) {
        $_SESSION['erro'] =
            'Valor inválido. Utilize um formato como 1500,00 ou 1.500,00.';

        header(
            'Location: editar_parcelamento.php?id=' .
            $parcelamento_id
        );

        exit();
    }

    /*
     * DECIMAL(10,2) suporta no máximo:
     * 99.999.999,99
     */
    if ($valor !== null && abs($valor) > 99999999.99) {
        $_SESSION['erro'] =
            'O valor informado é maior que o limite permitido de R$ 99.999.999,99.';

        header(
            'Location: editar_parcelamento.php?id=' .
            $parcelamento_id
        );

        exit();
    }

    $envio = trim($_POST['envio'] ?? '');

    $observacoes = trim($_POST['observacoes'] ?? '');

    $id_usuario = isset($_POST['id_usuario']) && $_POST['id_usuario'] !== ''
        ? (int) $_POST['id_usuario']
        : null;

    $status = trim($_POST['status'] ?? 'ativo');

    // =====================================================
    // VALIDAÇÕES
    // =====================================================

    $status_permitidos = [
        'ativo',
        'inativo',
        'quitado'
    ];

    if (!in_array($status, $status_permitidos, true)) {
        $status = 'ativo';
    }

    if ($qtde_parcelas !== null && $qtde_parcelas < 0) {
        $_SESSION['erro'] =
            'A quantidade de parcelas não pode ser negativa.';

        header(
            'Location: editar_parcelamento.php?id=' .
            $parcelamento_id
        );

        exit();
    }

    // =====================================================
    // UPDATE
    // =====================================================

    $sql_update = "
        UPDATE parcelamentos
        SET
            parcelamento = ?,
            qtde_parcelas = ?,
            data_efetivacao = ?,
            data_final = ?,
            valor = ?,
            envio = ?,
            observacoes = ?,
            id_usuario = ?,
            status = ?
        WHERE id = ?
    ";

    $stmt_update = $conexao->prepare($sql_update);

    if (!$stmt_update) {
        $_SESSION['erro'] =
            'Erro ao preparar atualização: ' .
            $conexao->error;

        header(
            'Location: editar_parcelamento.php?id=' .
            $parcelamento_id
        );

        exit();
    }

    /*
     * Tipos:
     *
     * s = parcelamento
     * i = qtde_parcelas
     * s = data_efetivacao
     * s = data_final
     * d = valor
     * s = envio
     * s = observacoes
     * i = id_usuario
     * s = status
     * i = parcelamento_id
     */
    $stmt_update->bind_param(
        'sissdssisi',
        $parcelamento_nome,
        $qtde_parcelas,
        $data_efetivacao,
        $data_final,
        $valor,
        $envio,
        $observacoes,
        $id_usuario,
        $status,
        $parcelamento_id
    );

    try {

        if ($stmt_update->execute()) {

            $_SESSION['sucesso'] =
                'Parcelamento atualizado com sucesso!';

        } else {

            $_SESSION['erro'] =
                'Erro ao atualizar o parcelamento: ' .
                $stmt_update->error;
        }

    } catch (mysqli_sql_exception $e) {

        $_SESSION['erro'] =
            'Erro ao atualizar o parcelamento: ' .
            $e->getMessage();
    }

    $stmt_update->close();

    header(
        'Location: editar_parcelamento.php?id=' .
        $parcelamento_id
    );

    exit();
}

// =========================================================
// CARREGAR PARCELAMENTO
// =========================================================

$sql_select = "
    SELECT *
    FROM parcelamentos
    WHERE id = ?
    LIMIT 1
";

$stmt_select = $conexao->prepare($sql_select);

if (!$stmt_select) {
    die(
        'Erro ao preparar consulta do parcelamento: ' .
        htmlspecialchars($conexao->error)
    );
}

$stmt_select->bind_param(
    'i',
    $parcelamento_id
);

$stmt_select->execute();

$resultado = $stmt_select->get_result();

$parcelamento = $resultado->fetch_assoc();

$stmt_select->close();

if (!$parcelamento) {
    echo 'Parcelamento não encontrado.';
    exit();
}

// =========================================================
// USUÁRIOS FISCAIS
// =========================================================

$sql_users = "
    SELECT
        id,
        nome
    FROM usuarios
    WHERE tipo_conta IN (
        'fiscal',
        'lider_fiscal'
    )
    ORDER BY nome ASC
";

$result_users = $conexao->query($sql_users);

$fiscais = [];

if ($result_users) {
    $fiscais = $result_users->fetch_all(MYSQLI_ASSOC);
}

// =========================================================
// VALOR PARA EXIBIÇÃO
// =========================================================

$valor_exibicao = '';

if (
    isset($parcelamento['valor']) &&
    $parcelamento['valor'] !== null &&
    $parcelamento['valor'] !== ''
) {
    $valor_exibicao = number_format(
        (float) $parcelamento['valor'],
        2,
        ',',
        '.'
    );
}

?>
<!DOCTYPE html>
<html lang="pt-br">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >

    <title>
        Editar Parcelamento
    </title>

    <link
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"
        rel="stylesheet"
    >

    <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"
    >

</head>

<body>

<div class="container mt-4 mb-5">

    <div
        class="d-flex justify-content-between align-items-center mb-3"
    >

        <h3>

            <i class="fas fa-edit"></i>

            Editar Parcelamento:

            <?= htmlspecialchars(
                $parcelamento['nome_empresa'] ?? '',
                ENT_QUOTES,
                'UTF-8'
            ) ?>

        </h3>

        <a
            href="tabela_parcelamento.php"
            class="btn btn-secondary"
        >
            <i class="fas fa-arrow-left"></i>
            Voltar
        </a>

    </div>

    <?php if (isset($_SESSION['sucesso'])): ?>

        <div class="alert alert-success">

            <?= htmlspecialchars(
                $_SESSION['sucesso'],
                ENT_QUOTES,
                'UTF-8'
            ) ?>

        </div>

        <?php unset($_SESSION['sucesso']); ?>

    <?php endif; ?>


    <?php if (isset($_SESSION['erro'])): ?>

        <div class="alert alert-danger">

            <?= htmlspecialchars(
                $_SESSION['erro'],
                ENT_QUOTES,
                'UTF-8'
            ) ?>

        </div>

        <?php unset($_SESSION['erro']); ?>

    <?php endif; ?>


    <form method="POST">

        <div class="row">

            <div class="col-md-6">

                <div class="mb-3">

                    <label class="form-label">
                        Nome do Parcelamento
                    </label>

                    <input
                        type="text"
                        name="parcelamento"
                        class="form-control"
                        value="<?= htmlspecialchars(
                            $parcelamento['parcelamento'] ?? '',
                            ENT_QUOTES,
                            'UTF-8'
                        ) ?>"
                    >

                </div>


                <div class="mb-3">

                    <label class="form-label">
                        Quantidade de Parcelas
                    </label>

                    <input
                        type="number"
                        name="qtde_parcelas"
                        min="0"
                        class="form-control"
                        value="<?= htmlspecialchars(
                            $parcelamento['qtde_parcelas'] ?? '',
                            ENT_QUOTES,
                            'UTF-8'
                        ) ?>"
                    >

                </div>


                <div class="mb-3">

                    <label class="form-label">
                        Data de Início
                    </label>

                    <input
                        type="date"
                        name="data_efetivacao"
                        class="form-control"
                        value="<?= htmlspecialchars(
                            $parcelamento['data_efetivacao'] ?? '',
                            ENT_QUOTES,
                            'UTF-8'
                        ) ?>"
                    >

                </div>


                <div class="mb-3">

                    <label class="form-label">
                        Data Final
                    </label>

                    <input
                        type="date"
                        name="data_final"
                        class="form-control"
                        value="<?= htmlspecialchars(
                            $parcelamento['data_final'] ?? '',
                            ENT_QUOTES,
                            'UTF-8'
                        ) ?>"
                    >

                </div>

            </div>


            <div class="col-md-6">

                <div class="mb-3">

                    <label class="form-label">
                        Valor
                    </label>

                    <div class="input-group">

                        <span class="input-group-text">
                            R$
                        </span>

                        <input
                            type="text"
                            name="valor"
                            class="form-control"
                            inputmode="decimal"
                            placeholder="0,00"
                            value="<?= htmlspecialchars(
                                $valor_exibicao,
                                ENT_QUOTES,
                                'UTF-8'
                            ) ?>"
                        >

                    </div>

                    <div class="form-text">
                        Exemplo: 1.500,00
                    </div>

                </div>


                <div class="mb-3">

                    <label class="form-label">
                        Envio
                    </label>

                    <input
                        type="text"
                        name="envio"
                        class="form-control"
                        value="<?= htmlspecialchars(
                            $parcelamento['envio'] ?? '',
                            ENT_QUOTES,
                            'UTF-8'
                        ) ?>"
                    >

                </div>


                <div class="mb-3">

                    <label class="form-label">
                        Responsável
                    </label>

                    <select
                        name="id_usuario"
                        class="form-select"
                    >

                        <option value="">
                            Selecione...
                        </option>

                        <?php foreach ($fiscais as $fiscal): ?>

                            <option
                                value="<?= (int) $fiscal['id'] ?>"
                                <?= (
                                    (int) ($parcelamento['id_usuario'] ?? 0) ===
                                    (int) $fiscal['id']
                                )
                                    ? 'selected'
                                    : ''
                                ?>
                            >

                                <?= htmlspecialchars(
                                    $fiscal['nome'],
                                    ENT_QUOTES,
                                    'UTF-8'
                                ) ?>

                            </option>

                        <?php endforeach; ?>

                    </select>

                </div>


                <div class="mb-3">

                    <label class="form-label">
                        Status
                    </label>

                    <select
                        name="status"
                        class="form-select"
                    >

                        <option
                            value="ativo"
                            <?= (
                                ($parcelamento['status'] ?? '') === 'ativo'
                            )
                                ? 'selected'
                                : ''
                            ?>
                        >
                            Ativo
                        </option>

                        <option
                            value="inativo"
                            <?= (
                                ($parcelamento['status'] ?? '') === 'inativo'
                            )
                                ? 'selected'
                                : ''
                            ?>
                        >
                            Inativo
                        </option>

                        <option
                            value="quitado"
                            <?= (
                                ($parcelamento['status'] ?? '') === 'quitado'
                            )
                                ? 'selected'
                                : ''
                            ?>
                        >
                            Quitado
                        </option>

                    </select>

                </div>

            </div>

        </div>


        <div class="mb-3">

            <label class="form-label">
                Observações
            </label>

            <textarea
                name="observacoes"
                class="form-control"
                rows="4"
            ><?= htmlspecialchars(
                $parcelamento['observacoes'] ?? '',
                ENT_QUOTES,
                'UTF-8'
            ) ?></textarea>

        </div>


        <button
            type="submit"
            class="btn btn-primary"
        >

            <i class="fas fa-save"></i>

            Salvar Alterações

        </button>

    </form>

</div>

</body>

</html>