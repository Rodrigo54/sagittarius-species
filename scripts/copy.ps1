# Sincroniza mod/sagittarius-species com a pasta local de mods do Stellaris.
# Apaga o destino e recopia do zero, reportando quanto o mod cresceu ou
# encolheu desde a última sincronização.

$ErrorActionPreference = 'Stop'

# O robocopy usa o exit code como bitmask e devolve 1 quando copia arquivos
# com sucesso. Sem isto, um PowerShell configurado para tratar exit code de
# executável nativo como erro abortaria o script justamente quando dá certo.
$PSNativeCommandUseErrorActionPreference = $false

if (-not $IsWindows) {
    Write-Host '✗ este script requer Windows (robocopy).' -ForegroundColor Red
    exit 1
}

$nomeMod = 'sagittarius-species'
$origem = Join-Path (Get-Item $PSScriptRoot).Parent.FullName "mod/$nomeMod"
$pastaMods = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Paradox Interactive\Stellaris\mod'
$destino = Join-Path $pastaMods $nomeMod

if (-not (Test-Path $origem)) {
    Write-Host "✗ pasta de origem não encontrada: $origem" -ForegroundColor Red
    exit 1
}

# Mede uma pasta numa passada só. Devolve $null se ela não existe — é o que
# distingue "instalação nova" de "nada mudou" na linha final.
function Measure-Pasta([string]$caminho) {
    if (-not (Test-Path $caminho)) { return $null }
    $medida = Get-ChildItem -Path $caminho -Recurse -File -Force |
        Measure-Object -Property Length -Sum
    return [pscustomobject]@{
        Arquivos = [int]$medida.Count
        Bytes    = [long]($medida.Sum ?? 0)
    }
}

function Format-MB([double]$bytes) {
    return ('{0:N1} MB' -f ($bytes / 1MB))
}

Write-Host "→ sincronizando $nomeMod → $pastaMods"

# Precisa medir antes do Remove-Item: depois de apagar, não há mais com o que comparar.
$antes = Measure-Pasta $destino

if ($null -ne $antes) {
    Remove-Item -Path $destino -Recurse -Force
}

# /E copia subpastas, inclusive vazias. As demais flags silenciam o log por
# arquivo, o cabeçalho e o sumário — sem elas o robocopy despeja centenas de
# linhas por execução.
robocopy $origem $destino /E /NFL /NDL /NJH /NJS /NP | Out-Null

# 0-7 é sucesso (com ou sem cópia), 8 ou mais é falha real.
if ($LASTEXITCODE -ge 8) {
    Write-Host "✗ robocopy falhou (exit code $LASTEXITCODE) — o mod local pode estar incompleto." -ForegroundColor Red
    exit $LASTEXITCODE
}

$depois = Measure-Pasta $destino

if ($null -eq $antes) {
    $variacao = 'instalação nova'
} elseif ($antes.Bytes -eq $depois.Bytes) {
    $variacao = 'sem variação desde a última sincronização'
} else {
    $delta = $depois.Bytes - $antes.Bytes
    $sinal = if ($delta -gt 0) { '+' } else { '-' }
    $variacao = "$sinal$(Format-MB ([Math]::Abs($delta))) desde a última sincronização"
}

Write-Host "✓ $nomeMod sincronizado — $($depois.Arquivos) arquivos, $(Format-MB $depois.Bytes) ($variacao)."
