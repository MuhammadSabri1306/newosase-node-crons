<?php

class AuthException extends \Exception {}
class NotFoundException extends \Exception {}

function getRequestHeader(string $key) {
    // $headerKey = str_replace([' ', '-'], '_');
    $headerKey = 'HTTP_' . strtoupper($key);
    return isset($_SERVER[$headerKey]) ? $_SERVER[$headerKey] : null;
}

function authenticate() {
    $serviceKey = 'opnimus-bot-v2-service-client-2024';
    $headerToken = getRequestHeader('token');
    if(!$headerToken || !password_verify($serviceKey, $headerToken)) {
        throw new AuthException('Not Authenticated');
    }
}

function toJsonResponse(array $data = [], int $code = 200, string $message = null) {
    $data['success'] = $code === 200;
    $data['code'] = $code;
    $data['message'] = $message ?? 'Request was successfully processed and returned';

    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
}

function getCronStatusData() {
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

    return [
        'result' => [
            'watch-newosase-alarm' => $isNewosaseWatcherExists,
            'watch-alert' => $isAlertWatcherExists,
        ]
    ];
}

function getCpuUsageData() {
    $cmd = 'ps -aux | grep node';
    $output = shell_exec($cmd);
    $outputs = explode(PHP_EOL, $output);
    $outputs = array_values( array_filter($outputs) );
    
    $processes = [];
    $cpuNode = null;
    $cpuNodeCron = null;
    foreach($outputs as $line) {
        $fields = preg_split('/\s+/', $line);
        if(count($fields) >= 11) {

            $pid = $fields[1];
            $user = $fields[0];
            $cpu = is_numeric($fields[2]) ? doubleval($fields[2]) : $fields[2];
            $mem = is_numeric($fields[3]) ? doubleval($fields[3]) : $fields[3];
            $command = implode(' ', array_slice($fields, 10));

            $isNewosaseWatcherCmd = strpos($command, 'opnimus-alerting-port-v5 watch-newosase-alarm') !== false;
            $isAlertWatcherCmd = !$isNewosaseWatcherCmd && strpos($command, 'opnimus-alerting-port-v5 watch-alert') !== false;
            $isExcCommand = !$isNewosaseWatcherCmd && !$isAlertWatcherCmd && in_array($command, ['sh -c ps -aux | grep node', 'grep node']);

            if(!$isExcCommand) {
                array_push($processes, compact('pid', 'user', 'cpu', 'mem', 'command'));
                if(is_numeric($cpu)) {
                    if($cpuNode === null) $cpuNode = 0;
                    $cpuNode += $cpu;
                    if($isNewosaseWatcherCmd || $isAlertWatcherCmd) {
                        if($cpuNodeCron === null) $cpuNodeCron = 0;
                        $cpuNodeCron += $cpu;
                    }
                }
            }
        }
    }

    return [
        'result' => [
            'cpu_usage' => [
                'node_all' => $cpuNode,
                'node_cron' => $cpuNodeCron,
            ],
            'processes' => $processes
        ]
    ];
}

try {

    authenticate();

    $view = isset($_GET['view']) ? $_GET['view'] : 'cronstatus';
    if($view == 'cronstatus') {
        $data = getCronStatusData();
    } elseif($view == 'cpuusage') {
        $data = getCpuUsageData();
    }

    if(!isset($data)) throw new NotFoundException('Not Found');
    toJsonResponse($data);

} catch(AuthException $err) {
    toJsonResponse([], 401, 'Not Authenticated');
} catch(NotFoundException $err) {
    toJsonResponse([], 404, 'Not Found');
} catch(\Throwable $err) {
    toJsonResponse([], 400, isset($_GET['debug']) ? $err->getMessage() : 'Bad Request');
}