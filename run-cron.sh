# run opnimus-alerting-port
echo "sudo nohup node ./src/opnimus-alerting-port > ./src/opnimus-alerting-port/logs/cron.log 2>&1 &"
sudo nohup node ./src/opnimus-alerting-port > ./src/opnimus-alerting-port/logs/cron.log 2>&1 &

# run osase-collect-kwh
echo "sudo nohup node ./src/osase-collect-kwh > ./src/osase-collect-kwh/logs/cron.log 2>&1 &"
sudo nohup node ./src/osase-collect-kwh > ./src/osase-collect-kwh/logs/cron.log 2>&1 &

# run opnimus-trial-kwhcounter
echo "sudo nohup node ./src/opnimus-trial-kwhcounter > ./src/opnimus-trial-kwhcounter/logs/cron.log 2>&1 &"
sudo nohup node ./src/opnimus-trial-kwhcounter > ./src/opnimus-trial-kwhcounter/logs/cron.log 2>&1 &

# run all => ./run-cron.sh
# list process in background => pgrep -a node