<?php
// partes/tabela_delegacoes.php
if (empty($responsaveis_empresa)): ?>
    <p>Nenhuma tarefa delegada encontrada com os filtros aplicados.</p>
<?php else: ?>
    <table>
        <thead>
            <tr>
                <th>Empresa</th>
                <th>Tipo de Tarefa</th>
                <th>Responsável</th>
                <th>Mês/Ano</th>
                <th>Ações</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($responsaveis_empresa as $delegacao): ?>
                <tr>
                    <td><?= htmlspecialchars($delegacao['empresa_nome']) ?></td>
                    <td><?= ucfirst(htmlspecialchars($delegacao['tipo_tarefa'] ?? '')) ?></td>
                    <td><?= htmlspecialchars($delegacao['funcionario_nome']) ?></td>
                    <td><?= $delegacao['mes'] ?>/<?= $delegacao['ano'] ?></td>
                    <td>
                        <button class="btn btn-small editar-delegacao-btn" data-delegacao-id="<?= $delegacao['id'] ?>" data-empresa-nome="<?= htmlspecialchars($delegacao['empresa_nome']) ?>" data-tipo-tarefa="<?= htmlspecialchars($delegacao['tipo_tarefa']) ?>" data-funcionario-id="<?= $delegacao['id_usuario'] ?>"><i class="fas fa-edit"></i> Editar</button>
                        <button class="btn btn-small btn-outline remover-delegacao-btn" data-delegacao-id="<?= $delegacao['id'] ?>"><i class="fas fa-trash"></i> Remover</button>
                    </td>
                </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
<?php endif; ?>