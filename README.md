WhisperLive : [Github](https://github.com/collabora/WhisperLive/tree/main)

Lancé avec la commande : `uv run run_server.py --port 9090 --backend faster_whisper --max_clients 4 --max_connection_time 600 --enable_rest --cors-origins="http://localhost:8080,http://127.0.0.1:8080"`, sous python 4.12.

Il faut ensuite autoriser l'accès par docker à l'app : `sudo ufw allow from 172.16.0.0/12 to any port 9090 proto tcp`
