# Tino Feria: levantar, frenar y reiniciar el entorno local con Docker.
#
#   .\feria.ps1            levanta todo y abre http://localhost:3000
#   .\feria.ps1 reset-demo rehace la empresa demo desde cero
#   .\feria.ps1 logs       muestra los logs del backend y el frontend
#   .\feria.ps1 stop       frena los contenedores (los datos quedan)
#   .\feria.ps1 clean      frena y borra la base (vuelve a cargarse al levantar)
#
# Si Windows bloquea el script: powershell -ExecutionPolicy Bypass -File .\feria.ps1
param([ValidateSet('up', 'reset-demo', 'logs', 'stop', 'clean')][string]$Action = 'up')

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$compose = @('compose', '-f', 'docker-compose.feria.yml')

# Comprueba que el motor de Docker responda; si no, intenta abrir Docker Desktop y espera.
function Wait-Docker {
    docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { return }
    $desktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
    if (Test-Path $desktop) { Start-Process $desktop }
    Write-Host 'Esperando a Docker Desktop (si muestra un cartel, aceptalo)...'
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 5
        docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { return }
    }
    throw 'Docker no arrancó. Abrí Docker Desktop y esperá a que diga "Engine running".'
}

# Crea .env.feria a partir del ejemplo con secretos al azar, solo si no existe.
function New-EnvFile {
    if (Test-Path '.env.feria') { return }
    $random = { param($bytes) [Convert]::ToBase64String((1..$bytes | ForEach-Object { Get-Random -Maximum 256 })) -replace '[+/=]', '' }
    $content = Get-Content '.env.feria.example' -Raw
    $content = $content -replace 'JWT_SECRET=.*', ('JWT_SECRET=' + (& $random 48))
    $content = $content -replace 'DEMO_USER_PASSWORD=.*', ('DEMO_USER_PASSWORD=' + (& $random 12))
    [IO.File]::WriteAllText((Join-Path $PSScriptRoot '.env.feria'), $content)
    Write-Host 'Se creó .env.feria (ahí están el usuario y la clave demo).'
}

# Espera a que el frontend responda en el puerto 3000.
function Wait-Frontend {
    Write-Host 'Esperando a que Tino responda en http://localhost:3000 ...'
    for ($i = 0; $i -lt 120; $i++) {
        try {
            $response = Invoke-WebRequest 'http://localhost:3000/login' -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) { return }
        } catch { }
        Start-Sleep -Seconds 3
    }
    throw 'El frontend no respondió. Revisá: .\feria.ps1 logs'
}

switch ($Action) {
    'up' {
        Wait-Docker
        New-EnvFile
        & docker @compose up -d --build
        if ($LASTEXITCODE -ne 0) { throw 'docker compose up falló.' }
        Wait-Frontend
        Write-Host 'Tino Feria listo: http://localhost:3000 (usuario y clave en .env.feria)'
        Start-Process 'http://localhost:3000/login'
    }
    'reset-demo' {
        & docker exec tino-feria-backend npm run seed:feria -- --force
    }
    'logs' {
        & docker @compose logs -f --tail 100 backend frontend
    }
    'stop' {
        & docker @compose stop
    }
    'clean' {
        & docker @compose down -v
    }
}
