<?php

function getRequestHeader(string $key) {
    // $headerKey = str_replace([' ', '-'], '_');
    $headerKey = 'HTTP_' . strtoupper($key);
    return isset($_SERVER[$headerKey]) ? $_SERVER[$headerKey] : null;
}

class AuthException extends \Exception {}

$serviceKey = 'opnimus-bot-v2-service-client-2024';
$responseData = [
    'success' => true,
    'code' => 200,
    'message' => 'Request was successfully processed and returned'
];

try {

    $headerToken = getRequestHeader('token');
    if(!$headerToken || !password_verify($serviceKey, $headerToken)) {
        throw new AuthException();
    }

    $cmd = 'pgrep -a node';
    $output = shell_exec($cmd);
    $outputs = explode(PHP_EOL, $output);
    $outputs = array_values( array_filter($outputs) );
    
    $isNewosaseWatcherExists = false;
    $isAlertWatcherExists = false;

    for($i=0; $i<count($outputs); $i++) {

        if(!$isNewosaseWatcherExists) {
            $isNewosaseWatcherExists = strpos($outputs[$i], 'opnimus-alerting-port-v5 watch-newosase-alarm') !== false;
        }

        if(!$isAlertWatcherExists) {
            $isAlertWatcherExists = strpos($outputs[$i], 'opnimus-alerting-port-v5 watch-alert') !== false;
        }
        
        if($isNewosaseWatcherExists && $isAlertWatcherExists) {
            $i = count($outputs);
        }

    }

    $responseData['result'] = [
        'watch-newosase-alarm' => $isNewosaseWatcherExists,
        'watch-alert' => $isAlertWatcherExists,
    ];

} catch(AuthException $err) {

    $responseData['success'] = false;
    $responseData['code'] = 401;
    $responseData['message'] = 'Not Authenticated';

} catch(\Throwable $err) {

    $responseData['success'] = false;
    $responseData['code'] = 400;
    $responseData['message'] = isset($_GET['debug']) ? $err->getMessage() : 'Bad Request';

} finally {

    http_response_code($responseData['code']);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($responseData);

}