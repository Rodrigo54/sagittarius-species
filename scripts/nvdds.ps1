$process = Start-Process -FilePath "C:\Program Files\NVIDIA Corporation\NVIDIA Texture Tools\nvtt_export.exe" -ArgumentList '--batch-file="D:\dev\stellaris-mods\sagittarius-species\batch.nvdds"' -PassThru
$process | Wait-Process
