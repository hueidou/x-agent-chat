$log = Join-Path $env:TEMP "raft-server.log"
$proc = Start-Process -WindowStyle Hidden -PassThru -FilePath "node" -ArgumentList "dist/server/index.js" -WorkingDirectory "C:\Users\hueid\Desktop\workspace\dosomething\raft-core" -RedirectStandardOutput $log -RedirectStandardError $log
Write-Host "PID=$($proc.Id)"
