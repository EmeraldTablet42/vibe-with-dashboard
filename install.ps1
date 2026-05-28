param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $Args
)

$ErrorActionPreference = "Stop"
$cmdArgs = @("-y", "github:EmeraldTablet42/vibe-with-dashboard", "--") + $Args
& npx @cmdArgs
exit $LASTEXITCODE
