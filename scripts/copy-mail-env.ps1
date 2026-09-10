# Copies the four mail variables from the tri-cities-board Vercel project to
# tcb-concepts, so this site sends through the same Resend configuration as
# tricitiesboard.org. Values are never printed. Run from anywhere:
#
#   powershell -ExecutionPolicy Bypass -File "F:\(3) TCB Concepts\Main\scripts\copy-mail-env.ps1"

$ErrorActionPreference = 'Stop'

$concepts = 'F:\(3) TCB Concepts\Main'
$source   = 'F:\(2) Tri Cities Board\Tricities Board'
$tmp      = Join-Path $env:TEMP 'tcb-mail.env'
$vars     = 'RESEND_API_KEY', 'EMAIL_FROM', 'EMAIL_REPLY_TO_ADMIN', 'EMAIL_REPLY_TO_OUTREACH'

Set-Location $concepts

Write-Host 'Pulling production env from tri-cities-board...'
& vercel env pull --environment=production --yes $tmp --cwd $source | Out-Null
if (-not (Test-Path $tmp)) { throw 'env pull did not produce a file. Is the source folder linked to Vercel?' }

$lines = Get-Content $tmp

foreach ($v in $vars) {
  $line = $lines | Where-Object { $_ -like "$v=*" } | Select-Object -First 1
  if (-not $line) { Write-Host "$v : not found in source, skipped"; continue }
  $val = $line.Substring($v.Length + 1).Trim('"')

  foreach ($env in 'production', 'preview') {
    & vercel env add $v $env --value $val --force --sensitive | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Host "$v -> $env ok" } else { Write-Host "$v -> $env FAILED (exit $LASTEXITCODE)" }
  }
}

Remove-Item $tmp -Force
Write-Host 'Temp file removed.'

Write-Host 'Redeploying tcb-concepts...'
& vercel --prod --yes | Out-Null
Write-Host 'Done. Test the form at https://tcb-concepts.vercel.app/#request'
