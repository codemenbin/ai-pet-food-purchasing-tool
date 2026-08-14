# read .b64 file then decode to target .ts
$e = [System.Text.Encoding]::UTF8
[System.IO.File]::WriteAllText($args[0], $e.GetString([Convert]::FromBase64String([System.IO.File]::ReadAllText($args[1]))), $e)
Write-Host ("OK len=" + (Get-Item $args[0]).Length)

