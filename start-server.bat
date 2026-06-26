@echo off
start /B node "C:\Users\hueid\Desktop\workspace\dosomething\raft-core\dist\server\index.js" > "%TEMP%\raft-server.log" 2>&1
echo PID=%ERRORLEVEL%
