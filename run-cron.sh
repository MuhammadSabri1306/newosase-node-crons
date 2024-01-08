# run opnimus-alerting-port
echo "sudo nohup node ./src/opnimus-alerting-port-v2 > ./src/opnimus-alerting-port-v2/logs/cron.log 2>&1 &"
sudo nohup node ./src/opnimus-alerting-port-v2 > ./src/opnimus-alerting-port-v2/logs/cron.log 2>&1 &

# run osase-collect-kwh
echo "sudo nohup node ./src/osase-collect-kwh > ./src/osase-collect-kwh/logs/cron.log 2>&1 &"
sudo nohup node ./src/osase-collect-kwh > ./src/osase-collect-kwh/logs/cron.log 2>&1 &

# run opnimus-trial-kwhcounter
echo "sudo nohup node ./src/opnimus-trial-kwhcounter > ./src/opnimus-trial-kwhcounter/logs/cron.log 2>&1 &"
sudo nohup node ./src/opnimus-trial-kwhcounter > ./src/opnimus-trial-kwhcounter/logs/cron.log 2>&1 &

# run opnimus-conversation-checker
echo "sudo nohup node ./src/opnimus-conversation-checker > ./src/opnimus-conversation-checker/logs/cron.log 2>&1 &"
sudo nohup node ./src/opnimus-conversation-checker > ./src/opnimus-conversation-checker/logs/cron.log 2>&1 &

# run osase-collect-pue
echo "sudo nohup node ./src/osase-collect-pue cron > ./src/osase-collect-pue/logs/cron.log 2>&1 &"
sudo nohup node ./src/osase-collect-pue cron > ./src/osase-collect-pue/logs/cron.log 2>&1 &

# run all => ./run-cron.sh
# run all => /var/www/html/crons/node-crons/run-cron.sh
# list process in background => pgrep -a node