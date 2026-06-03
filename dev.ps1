# 项目根目录启动入口（避免在 UNC 路径下 scripts\dev.ps1 无法解析）
& "$PSScriptRoot\scripts\dev.ps1" @args
