<?php
require_once __DIR__ . '/assets/backend/config.php';

$mensagem = '';
$tiposPermitidos = [
  'admin','responsavel_dp','responsavel_fiscal','responsavel_contabil',
  'dp','fiscal','contabil','cadastro'
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $usuario     = trim($_POST['usuario'] ?? '');
    $nome        = trim($_POST['nome'] ?? '');
    $senha       = $_POST['senha'] ?? '';
    $senha2      = $_POST['senha2'] ?? '';
    $tipo_conta  = $_POST['tipo_conta'] ?? 'admin';
    $ativo       = isset($_POST['ativo']) ? 1 : 0;

    // validações rápidas
    if ($usuario === '' || $nome === '' || $senha === '' || $senha2 === '') {
        $mensagem = 'Preencha todos os campos.';
    } elseif ($senha !== $senha2) {
        $mensagem = 'As senhas não conferem.';
    } elseif (!in_array($tipo_conta, $tiposPermitidos, true)) {
        $mensagem = 'Tipo de conta inválido.';
    } else {
        try {
            $pdo = new PDO(
                "mysql:host=$dbHost;port=$dbPort;dbname=$dbName;charset=utf8mb4",
                $dbUsername, $dbPassword,
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
            );

            // gera hash seguro (bcrypt)
            $hash = password_hash($senha, PASSWORD_DEFAULT);

            $stmt = $pdo->prepare("
                INSERT INTO usuarios (usuario, senha, nome, tipo_conta, ativo)
                VALUES (:usuario, :senha, :nome, :tipo_conta, :ativo)
            ");
            $stmt->execute([
                ':usuario'    => $usuario,
                ':senha'      => $hash,
                ':nome'       => $nome,
                ':tipo_conta' => $tipo_conta,
                ':ativo'      => $ativo
            ]);

            $mensagem = '✅ Usuário criado com sucesso! Você já pode fazer login.';
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                $mensagem = '⚠️ Já existe um usuário com esse login.';
            } else {
                $mensagem = 'Erro ao criar usuário: ' . $e->getMessage();
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="utf-8">
  <title>Criar usuário</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
<div class="container py-5">
  <div class="row justify-content-center">
    <div class="col-lg-6">
      <div class="card shadow-sm">
        <div class="card-body">
          <h3 class="mb-3">Criar Usuário</h3>

          <?php if ($mensagem): ?>
            <div class="alert <?php echo str_starts_with($mensagem,'✅') ? 'alert-success':'alert-warning'; ?>">
              <?php echo htmlspecialchars($mensagem, ENT_QUOTES, 'UTF-8'); ?>
            </div>
          <?php endif; ?>

          <form method="post" autocomplete="off">
            <div class="mb-3">
              <label class="form-label">Usuário (login)</label>
              <input type="text" name="usuario" class="form-control" required value="<?php echo htmlspecialchars($_POST['usuario'] ?? 'admin', ENT_QUOTES, 'UTF-8'); ?>">
            </div>

            <div class="mb-3">
              <label class="form-label">Nome completo</label>
              <input type="text" name="nome" class="form-control" required value="<?php echo htmlspecialchars($_POST['nome'] ?? 'Administrador', ENT_QUOTES, 'UTF-8'); ?>">
            </div>

            <div class="mb-3">
              <label class="form-label">Senha</label>
              <input type="password" name="senha" class="form-control" required>
            </div>

            <div class="mb-3">
              <label class="form-label">Confirmar senha</label>
              <input type="password" name="senha2" class="form-control" required>
            </div>

            <div class="mb-3">
              <label class="form-label">Tipo de conta</label>
              <select name="tipo_conta" class="form-select">
                <?php
                  $sel = $_POST['tipo_conta'] ?? 'admin';
                  foreach ($tiposPermitidos as $t) {
                      $s = $t === $sel ? 'selected' : '';
                      echo "<option value=\"$t\" $s>$t</option>";
                  }
                ?>
              </select>
            </div>

            <div class="form-check mb-3">
              <input class="form-check-input" type="checkbox" name="ativo" id="ativo" <?php echo isset($_POST['ativo']) || !isset($_POST['ativo']) ? 'checked' : ''; ?>>
              <label class="form-check-label" for="ativo">Ativo</label>
            </div>

            <button class="btn btn-primary w-100" type="submit">Criar usuário</button>
          </form>

          <hr class="my-4">
          <p class="text-muted small">
            Dica: seu <code>autenticar.php</code> deve validar com <code>password_verify($senhaDigitada, $hashNoBanco)</code>.
          </p>
        </div>
      </div>
      <p class="text-center mt-3 small text-muted">Remova este arquivo após criar os usuários.</p>
    </div>
  </div>
</div>
</body>
</html>
