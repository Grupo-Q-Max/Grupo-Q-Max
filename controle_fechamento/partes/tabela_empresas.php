<?php
// partes/tabela_empresas.php
if (empty($empresas)): ?>
    <tr>
        <td colspan="8" style="text-align: center;">Nenhuma empresa encontrada com os filtros aplicados</td>
    </tr>
<?php else: ?>
    <?php foreach ($empresas as $empresa): ?>
        <tr>
            <td><input type="checkbox" class="checkbox-empresa" value="<?= $empresa['id'] ?>"></td>
            <td><?= htmlspecialchars($empresa['codigo'] ?? '') ?></td>
            <td><?= htmlspecialchars($empresa['empresa'] ?? '') ?></td>
            <td>...</td>
            <td><?= htmlspecialchars($empresa['data_contrato_formatada'] ?? '') ?></td>
            <td><?= $empresa['mes'] ?>/<?= $empresa['ano'] ?></td>
            <td>
                <span class="status-badge <?= $empresa['todas_tarefas_delegadas'] ? 'status-completo' : ($empresa['nenhuma_tarefa_delegada'] ? 'status-incompleto' : 'status-pendente') ?>">
                    <?= $empresa['todas_tarefas_delegadas'] ? 'Completo' : ($empresa['nenhuma_tarefa_delegada'] ? 'Pendente' : 'Parcial') ?>
                </span>
                <div class="tarefa-status">
                    <?php foreach ($tipos_tarefa as $tipo): ?>
                        <div class="tarefa-item">
                            <i class="fas fa-<?= $empresa['tarefas_delegadas'][$tipo] ? 'check-circle tarefa-delegada' : 'times-circle tarefa-pendente' ?> tarefa-icon"></i>
                            <span><?= ucfirst($tipo) ?></span>
                            <?php if ($empresa['tarefas_delegadas'][$tipo]): ?>
                                <span class="tarefa-responsavel" title="<?= htmlspecialchars($empresa['responsaveis'][$tipo]) ?>"><i class="fas fa-user"></i></span>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                </div>
            </td>
            <td><button type="button" class="btn btn-small btn-outline delegar-btn" data-empresa-id="<?= $empresa['id'] ?>" data-empresa-nome="<?= htmlspecialchars($empresa['empresa']) ?>"><i class="fas fa-user-plus"></i> Delegar</button></td>
        </tr>
    <?php endforeach; ?>
<?php endif; ?>