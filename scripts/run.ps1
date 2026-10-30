param([Parameter(ValueFromRemainingArguments=$true)][string[]]$NpmArguments)
$ErrorActionPreference='Stop'
$taskNode=(Get-Command node).Source
$taskVersion=& $taskNode -p 'process.versions.node'
if([version]$taskVersion -lt [version]'22.12.0'){
  $taskBundled=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
  if(Test-Path -LiteralPath $taskBundled){$taskNode=$taskBundled}else{throw 'Install Node.js >=22.12.0 (Node 24 LTS recommended).'}
}
$taskNpmCommand=(Get-Command npm.cmd).Source
$taskNpm=Join-Path (Split-Path $taskNpmCommand) 'node_modules\npm\bin\npm-cli.js'
$env:PATH=(Split-Path $taskNode)+';'+$env:PATH
& $taskNode $taskNpm @NpmArguments
exit $LASTEXITCODE
