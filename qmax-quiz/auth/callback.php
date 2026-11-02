<?php
require_once dirname(__DIR__) . '/includes/bootstrap.php';
if (!isset($_GET['state']) || !hash_equals($_SESSION['oauth_state'] ?? '', (string)$_GET['state'])) exit('Falha de segurança no login.');
unset($_SESSION['oauth_state']);
if (!empty($_GET['error'])) exit('Login cancelado ou não autorizado.');
function post_form(string $url, array $data): array {
 $ch=curl_init($url); curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query($data),CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>20]);
 $body=curl_exec($ch); $status=curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
 if($status<200||$status>=300) throw new RuntimeException('Falha ao validar o acesso Microsoft.');
 return json_decode((string)$body,true,512,JSON_THROW_ON_ERROR);
}
function graph_me(string $token): array {
 $ch=curl_init('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName');
 curl_setopt_array($ch,[CURLOPT_HTTPHEADER=>['Authorization: Bearer '.$token],CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>20]);
 $body=curl_exec($ch); $status=curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
 if($status!==200) throw new RuntimeException('Não foi possível obter o perfil corporativo.');
 return json_decode((string)$body,true,512,JSON_THROW_ON_ERROR);
}
try {
 $tenant=rawurlencode((string)env('MS_TENANT_ID'));
 $tokens=post_form('https://login.microsoftonline.com/'.$tenant.'/oauth2/v2.0/token',[
  'client_id'=>env('MS_CLIENT_ID'),'client_secret'=>env('MS_CLIENT_SECRET'),'grant_type'=>'authorization_code',
  'code'=>$_GET['code']??'','redirect_uri'=>url('auth/callback.php'),'scope'=>'openid profile email User.Read'
 ]);
 $profile=graph_me($tokens['access_token']);
 $email=strtolower(trim((string)($profile['mail']??$profile['userPrincipalName']??'')));
 $admins=array_filter(array_map(fn($v)=>strtolower(trim($v)),explode(',',(string)env('ADMIN_EMAILS',''))));
 $role=in_array($email,$admins,true)?'admin':'participant';
 $sql="INSERT INTO users (microsoft_oid,name,email,role,last_login_at) VALUES (?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE name=VALUES(name),email=VALUES(email),role=VALUES(role),last_login_at=NOW()";
 db()->prepare($sql)->execute([$profile['id'],(string)$profile['displayName'],$email,$role]);
 $stmt=db()->prepare('SELECT id,name,email,role FROM users WHERE microsoft_oid=?'); $stmt->execute([$profile['id']]);
 session_regenerate_id(true); $_SESSION['user']=$stmt->fetch(); redirect('index.php');
} catch(Throwable $e) { http_response_code(500); exit('Não foi possível concluir o login. Revise as configurações do Microsoft Entra ID.'); }

