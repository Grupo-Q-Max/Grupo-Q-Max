<?php
// partes/paginacao.php
if ($total_paginas > 1): ?>
    <?php if ($pagina > 1): ?>
        <a href="#" class="page-link" data-pagina="1"><i class="fas fa-angle-double-left"></i></a>
        <a href="#" class="page-link" data-pagina="<?= $pagina - 1 ?>"><i class="fas fa-angle-left"></i></a>
    <?php endif; ?>
    <?php for ($i = max(1, $pagina - 2); $i <= min($total_paginas, $pagina + 2); $i++): ?>
        <a href="#" class="page-link <?= $i == $pagina ? 'ativa' : '' ?>" data-pagina="<?= $i ?>"><?= $i ?></a>
    <?php endfor; ?>
    <?php if ($pagina < $total_paginas): ?>
        <a href="#" class="page-link" data-pagina="<?= $pagina + 1 ?>"><i class="fas fa-angle-right"></i></a>
        <a href="#" class="page-link" data-pagina="<?= $total_paginas ?>"><i class="fas fa-angle-double-right"></i></a>
    <?php endif; ?>
<?php endif; ?>