<?php

$cmd = 'pgrep -a node';
$output = shell_exec($cmd);
$outputs = explode(PHP_EOL, $output);
?><pre><?php var_dump($outputs); ?></pre>