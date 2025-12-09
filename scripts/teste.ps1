function ListarArquivosRecursivamente {
    param (
        [string]$pasta,
        [string]$arquivoDeSaida
    )

    # Obtém a lista de arquivos e subdiretórios na pasta atual
    $conteudo = Get-ChildItem -Path $pasta

    # Inicializa uma lista para armazenar os caminhos dos arquivos
    $listaDeArquivos = @()

    # Loop através dos itens na pasta atual
    foreach ($item in $conteudo) {
        if ($item.PSIsContainer) {
            # Se o item é um diretório, chama a função recursivamente
            ListarArquivosRecursivamente -pasta $item.FullName -arquivoDeSaida $arquivoDeSaida
        } else {
            # Se o item é um arquivo, adiciona o caminho à lista de arquivos

            $config = '--format bc3 --quality normal --no-mips --zcmp 5'
            $output = '--output ' + $item.FullName -replace '\.png$', '.dds'
            $listaDeArquivos += "$($item.FullName) $($config) $($output)"
        }
    }

    # Escreve os caminhos dos arquivos em um arquivo de saída
    $listaDeArquivos | Out-File -FilePath $arquivoDeSaida -Append
}

# Especifica o caminho da pasta e o arquivo de saída
$pastaInicial = "D:\dev\stellaris-mods\sagittarius-species\assets\astral"
$arquivoDeSaida = "lista_de_arquivos.txt"

Remove-Item -Path $arquivoDeSaida -Force

# Chama a função para listar os arquivos e escrever em um arquivo TXT
ListarArquivosRecursivamente -pasta $pastaInicial -arquivoDeSaida $arquivoDeSaida
