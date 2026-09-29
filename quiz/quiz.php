<?php require_once __DIR__.'/includes/auth.php'; require_login(); $id=filter_input(INPUT_GET,'id',FILTER_VALIDATE_INT); if(!$id) redirect('index.php');
$stmt=db()->prepare("SELECT * FROM quizzes WHERE id=? AND status='published'");$stmt->execute([$id]);$quiz=$stmt->fetch();if(!$quiz)exit('Quiz indisponível.');
$stmt=db()->prepare('SELECT * FROM attempts WHERE quiz_id=? AND user_id=?');$stmt->execute([$id,user()['id']]);$attempt=$stmt->fetch();
if($attempt&&$attempt['submitted_at'])redirect('result.php?id='.$attempt['id']);
if(!$attempt){db()->prepare('INSERT INTO attempts(quiz_id,user_id,ip_address,user_agent) VALUES(?,?,?,?)')->execute([$id,user()['id'],$_SERVER['REMOTE_ADDR']??null,substr($_SERVER['HTTP_USER_AGENT']??'',0,500)]);$attempt=['id'=>db()->lastInsertId(),'started_at'=>date('Y-m-d H:i:s')];}
$stmt=db()->prepare('SELECT * FROM questions WHERE quiz_id=? ORDER BY position');$stmt->execute([$id]);$questions=$stmt->fetchAll();
foreach($questions as &$q){$o=db()->prepare('SELECT id,option_text FROM question_options WHERE question_id=? ORDER BY position');$o->execute([$q['id']]);$q['options']=$o->fetchAll();}unset($q);
$pageTitle=$quiz['title'];require __DIR__.'/includes/header.php'; ?>
<section class="quiz-stage" data-limit="<?= (int)($quiz['time_limit_minutes']??0) ?>" data-started="<?= e($attempt['started_at']) ?>"><div class="quiz-progress"><div><span>DESAFIO QMAX</span><strong><?= e($quiz['title']) ?></strong></div><div class="timer" id="timer">◷ --:--</div></div><div class="progress-track"><i id="progressBar"></i></div>
<form action="<?= e(url('submit.php')) ?>" method="post" id="quizForm"><input type="hidden" name="csrf" value="<?= e(csrf_token()) ?>"><input type="hidden" name="attempt_id" value="<?= (int)$attempt['id'] ?>">
<?php foreach($questions as $i=>$q): ?><fieldset class="question-panel <?= $i===0?'active':'' ?>" data-question><legend><span>Pergunta <?= $i+1 ?> de <?= count($questions) ?></span><?= e($q['question_text']) ?></legend>
<?php if($q['type']==='single'): ?><div class="options"><?php foreach($q['options'] as $letter=>$o): ?><label><input type="radio" name="answers[<?= (int)$q['id'] ?>]" value="<?= (int)$o['id'] ?>" required><b><?= chr(65+$letter) ?></b><span><?= e($o['option_text']) ?></span><i>✓</i></label><?php endforeach; ?></div><?php else: ?><textarea name="answers[<?= (int)$q['id'] ?>]" rows="5" required placeholder="Digite sua resposta..."></textarea><?php endif; ?>
<div class="quiz-actions"><button type="button" class="button secondary prev" <?= $i===0?'disabled':'' ?>>← Anterior</button><?php if($i<count($questions)-1): ?><button type="button" class="button next">Próxima →</button><?php else: ?><button type="submit" class="button">Enviar respostas ✓</button><?php endif; ?></div></fieldset><?php endforeach; ?></form></section>
<?php require __DIR__.'/includes/footer.php'; ?>

