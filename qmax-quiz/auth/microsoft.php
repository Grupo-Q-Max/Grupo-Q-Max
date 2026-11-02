<?php
require_once dirname(__DIR__) . '/includes/bootstrap.php';
$state = bin2hex(random_bytes(24)); $_SESSION['oauth_state']=$state;
$params = [
 'client_id'=>env('MS_CLIENT_ID'), 'response_type'=>'code', 'redirect_uri'=>url('auth/callback.php', true),
 'response_mode'=>'query', 'scope'=>'openid profile email User.Read', 'state'=>$state, 'prompt'=>'select_account'
];
$tenant=rawurlencode((string)env('MS_TENANT_ID','organizations'));
header('Location: https://login.microsoftonline.com/'.$tenant.'/oauth2/v2.0/authorize?'.http_build_query($params)); exit;
