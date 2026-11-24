# Fala um texto com a voz pt-BR do Windows (System.Speech) e grava um WAV de 16 kHz mono,
# com o início de cada palavra em milissegundos. Usado só para as fixtures sintéticas de
# voz (tests/fixtures/voz/sintetica/), que não substituem as gravações reais da equipe.
param(
  [Parameter(Mandatory = $true)][string]$TextoArquivo,
  [Parameter(Mandatory = $true)][string]$Saida,
  [Parameter(Mandatory = $true)][string]$Marcas,
  [int]$Velocidade = 0
)
Add-Type -AssemblyName System.Speech
$texto = [System.IO.File]::ReadAllText($TextoArquivo, [System.Text.Encoding]::UTF8)
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voz = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq 'pt-BR' } | Select-Object -First 1
if (-not $voz) { Write-Error 'Nenhuma voz pt-BR instalada'; exit 1 }
$s.SelectVoice($voz.VoiceInfo.Name)
$s.Rate = $Velocidade
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$s.SetOutputToWaveFile($Saida, $fmt)
$lista = New-Object System.Collections.ArrayList
$null = Register-ObjectEvent -InputObject $s -EventName SpeakProgress -SourceIdentifier progresso
$s.Speak($texto)
$s.SetOutputToNull()
foreach ($e in (Get-Event -SourceIdentifier progresso)) {
  $a = $e.SourceEventArgs
  $null = $lista.Add([ordered]@{ texto = $a.Text; caractere = $a.CharacterPosition; inicioMs = [int]$a.AudioPosition.TotalMilliseconds })
}
Unregister-Event -SourceIdentifier progresso
$json = ConvertTo-Json -InputObject @{ voz = $voz.VoiceInfo.Name; palavras = $lista } -Depth 4
[System.IO.File]::WriteAllText($Marcas, $json, (New-Object System.Text.UTF8Encoding($false)))
