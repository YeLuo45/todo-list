param(
  [string]$Distro = "Ubuntu",
  [string]$ProjectPath = "/home/hermes/projects/todolist",
  [string]$WslUser = "hermes",
  [int]$Port = 5173
)

$ErrorActionPreference = "Stop"

$wslCommand = @"
export PATH="/home/$WslUser/.n/bin:/home/$WslUser/.npm-global/bin:/usr/bin:/bin"
export PORT=$Port
cd '$ProjectPath' && bash scripts/dev.sh
"@

Write-Host "启动 todolist 开发环境 (WSL/$Distro)..." -ForegroundColor Cyan
Write-Host "首选: http://127.0.0.1:$Port/ （占用时 Vite 自动换端口，请看终端 Local 行）" -ForegroundColor Green

wsl -d $Distro -- env "HOME=/home/$WslUser" bash --noprofile --norc -c $wslCommand
