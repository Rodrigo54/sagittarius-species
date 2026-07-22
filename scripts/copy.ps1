# Obter o caminho do último diretório mod modificado em ../mod/
$ultimoDiretorioMod = Get-ChildItem "$(Join-Path (Get-Item $PSScriptRoot).Parent.FullName mod)" | Sort-Object -Property LastWriteTime | Select-Object -Last 1

# Apagar o conteúdo da localização padrão dos mods locais do Stellaris
Remove-Item -Path "$env:USERPROFILE\Documents\Paradox Interactive\Stellaris\mod\$($ultimoDiretorioMod.Name)" -Recurse -Force

# Copiar o conteúdo do último diretório modificado para a localização padrão dos mods locais do Stellaris,
# excluindo o cache de regras do cwtools (.cwtools/), que não faz parte do mod publicado
robocopy $ultimoDiretorioMod.FullName "$env:USERPROFILE\Documents\Paradox Interactive\Stellaris\mod\$($ultimoDiretorioMod.Name)" /E /XD .cwtools | Out-Null

Write-Host "$($ultimoDiretorioMod.Name) copiado para ""$env:USERPROFILE\Documents\Paradox Interactive\Stellaris\mod"""
