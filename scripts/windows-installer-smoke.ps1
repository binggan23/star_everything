param(
  [Parameter(Mandatory = $true)]
  [string]$InstallerPath,
  [Parameter(Mandatory = $true)]
  [string]$InstallDirectory,
  [Parameter(Mandatory = $true)]
  [string]$LogPath
)

$ErrorActionPreference = 'Stop'
$databasePath = Join-Path $env:APPDATA 'com.stareverything.desktop\star_everything.db'
$appProcess = $null
$transcriptStarted = $false

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $LogPath) | Out-Null
Start-Transcript -Path $LogPath -Force | Out-Null
$transcriptStarted = $true

try {
  if (-not (Test-Path -LiteralPath $InstallerPath -PathType Leaf)) {
    throw "Installer not found: $InstallerPath"
  }

  Remove-Item -LiteralPath $InstallDirectory -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Split-Path -Parent $databasePath) -Recurse -Force -ErrorAction SilentlyContinue

  Write-Host "Installing $InstallerPath to $InstallDirectory"
  $installer = Start-Process -FilePath $InstallerPath -ArgumentList @('/S', "/D=$InstallDirectory") -Wait -PassThru
  if ($installer.ExitCode -ne 0) {
    throw "NSIS installer exited with code $($installer.ExitCode)"
  }

  $application = Get-ChildItem -LiteralPath $InstallDirectory -Filter '*.exe' -File -Recurse |
    Where-Object { $_.Name -notmatch '(?i)uninstall|setup' } |
    Select-Object -First 1
  if ($null -eq $application) {
    throw "No application executable found under $InstallDirectory"
  }

  Write-Host "Launching installed application: $($application.FullName)"
  $appProcess = Start-Process -FilePath $application.FullName -WorkingDirectory $InstallDirectory -PassThru

  $startupDeadline = (Get-Date).AddSeconds(60)
  $windowReady = $false
  while ((Get-Date) -lt $startupDeadline) {
    $appProcess.Refresh()
    if ($appProcess.HasExited) {
      throw "Application exited during startup with code $($appProcess.ExitCode)"
    }
    if ($appProcess.MainWindowTitle -eq 'Star Everything') {
      $windowReady = $true
      break
    }
    Start-Sleep -Seconds 1
  }
  if (-not $windowReady) {
    throw "Application did not create the expected main window within 60 seconds; title was '$($appProcess.MainWindowTitle)'"
  }
  Write-Host "Application window started: $($appProcess.MainWindowTitle)"

  $databaseVerifier = Join-Path $PSScriptRoot 'verify-windows-smoke-db.mjs'
  $databaseDeadline = (Get-Date).AddSeconds(60)
  $databaseReady = $false
  $lastDatabaseCheck = @()
  while ((Get-Date) -lt $databaseDeadline) {
    $appProcess.Refresh()
    if ($appProcess.HasExited) {
      throw "Application exited before database initialization completed with code $($appProcess.ExitCode)"
    }
    if (Test-Path -LiteralPath $databasePath -PathType Leaf) {
      $lastDatabaseCheck = @(& node $databaseVerifier $databasePath 2>&1)
      if ($LASTEXITCODE -eq 0) {
        $databaseReady = $true
        break
      }
    }
    Start-Sleep -Seconds 1
  }
  if (-not $databaseReady) {
    Write-Host "Last database verification output: $($lastDatabaseCheck -join ' ')"
    throw "The installed application did not initialize its SQLite schema at $databasePath within 60 seconds"
  }
  Write-Host "SQLite initialization verified: $($lastDatabaseCheck -join ' ')"
}
finally {
  if ($null -ne $appProcess) {
    $appProcess.Refresh()
    if (-not $appProcess.HasExited) {
      $null = $appProcess.CloseMainWindow()
      if (-not $appProcess.WaitForExit(10000)) {
        Stop-Process -Id $appProcess.Id -Force -ErrorAction SilentlyContinue
      }
    }
  }

  if (Test-Path -LiteralPath $InstallDirectory) {
    $uninstaller = Get-ChildItem -LiteralPath $InstallDirectory -Filter '*uninstall*.exe' -File -Recurse |
      Select-Object -First 1
    if ($null -ne $uninstaller) {
      try {
        Write-Host "Uninstalling from $InstallDirectory"
        $uninstallProcess = Start-Process -FilePath $uninstaller.FullName -ArgumentList '/S' -Wait -PassThru
        if ($uninstallProcess.ExitCode -ne 0) {
          Write-Warning "Uninstaller exited with code $($uninstallProcess.ExitCode)"
        }
      }
      catch {
        Write-Warning "Could not run the uninstaller: $_"
      }
    }
    Remove-Item -LiteralPath $InstallDirectory -Recurse -Force -ErrorAction SilentlyContinue
  }

  Remove-Item -LiteralPath (Split-Path -Parent $databasePath) -Recurse -Force -ErrorAction SilentlyContinue
  if ($transcriptStarted) {
    Stop-Transcript | Out-Null
  }
}
