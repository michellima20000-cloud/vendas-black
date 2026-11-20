<#
.SYNOPSIS
  Cria/atualiza o backend do Vendas Black no Render (Postgres + Web Service Docker)
  usando a API oficial do Render e dispara o deploy.

.DESCRIPTION
  Precisa de uma API Key do Render com permissao de deploy.
  Gere em: https://dashboard.render.com/u/settings#api-keys

  O script e idempotente: se o banco e o servico ja existirem (mesmo nome),
  ele reaproveita, atualiza as variaveis e dispara um novo deploy.

.EXAMPLE
  $env:RENDER_API_KEY = "rnd_xxxxxxxx"
  .\infra\deploy-render.ps1 -FrontendUrl "https://vendas-front.onrender.com"

.EXAMPLE
  .\infra\deploy-render.ps1 -ApiKey "rnd_xxx" -FrontendUrl "*" -Wait
#>
[CmdletBinding()]
param(
  [string]$ApiKey = $env:RENDER_API_KEY,
  [string]$OwnerId,
  [string]$ServiceName = 'vendas-black',
  [string]$DbName = 'vendas-black-db',
  [string]$Repo = 'https://github.com/michellima20000-cloud/vendas-black',
  [string]$Branch = 'main',
  [string]$Region = 'oregon',
  [string]$FrontendUrl = '*',
  [string]$JwtSecret = '',
  [switch]$SkipDatabase,
  [switch]$Wait
)

$ErrorActionPreference = 'Stop'
$BaseUrl = 'https://api.render.com/v1'

if (-not $ApiKey) {
  throw 'Informe a API Key do Render: -ApiKey "rnd_..." ou defina $env:RENDER_API_KEY.'
}
if ($ApiKey -notlike 'rnd_*') {
  Write-Warning 'A chave nao comeca com "rnd_". Confira se copiou a API Key correta.'
}

function Invoke-Render {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body
  )

  $params = @{
    Method      = $Method
    Uri         = "$BaseUrl$Path"
    Headers     = @{ Authorization = "Bearer $ApiKey"; Accept = 'application/json' }
    ContentType = 'application/json'
    TimeoutSec  = 60
  }
  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
  }

  $attempt = 0
  while ($true) {
    try {
      return Invoke-RestMethod @params
    }
    catch {
      $status = $null
      if ($_.Exception.Response) {
        try { $status = [int]$_.Exception.Response.StatusCode } catch { }
      }

      if (($status -eq 429 -or $status -ge 500) -and $attempt -lt 3) {
        $attempt++
        Write-Warning "Render respondeu $status. Tentando de novo em $($attempt * 5)s..."
        Start-Sleep -Seconds ($attempt * 5)
        continue
      }

      $detail = ''
      if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $detail = $_.ErrorDetails.Message }
      throw "Falha $Method $Path (HTTP $status): $detail $($_.Exception.Message)"
    }
  }
}

# A API lista recursos no formato { cursor, service } / { cursor, postgres }.
function Unwrap-List {
  param([object]$Items, [string]$Key)
  $out = @()
  foreach ($item in @($Items)) {
    if ($null -eq $item) { continue }
    if ($item.PSObject.Properties.Name -contains $Key) { $out += $item.$Key }
    else { $out += $item }
  }
  return $out
}

function New-Secret {
  $bytes = New-Object byte[] 48
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return [Convert]::ToBase64String($bytes)
}

Write-Host '== Vendas Black :: deploy no Render ==' -ForegroundColor Cyan

# 1. Valida a chave e resolve o owner (workspace).
$owners = Unwrap-List (Invoke-Render -Method GET -Path '/owners?limit=20') 'owner'
if (-not $owners -or $owners.Count -eq 0) { throw 'Nenhum workspace encontrado para esta API Key.' }

$owner = $null
if ($OwnerId) {
  $owner = $owners | Where-Object { $_.id -eq $OwnerId } | Select-Object -First 1
  if (-not $owner) { throw "OwnerId '$OwnerId' nao encontrado. Disponiveis: $($owners.id -join ', ')" }
}
else {
  $owner = $owners[0]
}
Write-Host "Workspace: $($owner.name) ($($owner.id))"

# 2. Reaproveita o banco existente ou cria um novo.
$connectionString = $null
if (-not $SkipDatabase) {
  $dbs = @(Unwrap-List (Invoke-Render -Method GET -Path '/postgres?limit=100') 'postgres' |
    Where-Object { $_.name -eq $DbName })

  if ($dbs.Count -gt 0) {
    $db = $dbs[0]
    Write-Host "Banco existente: $($db.name) ($($db.id)) - status $($db.status)"
  }
  else {
    Write-Host "Criando Postgres '$DbName' (plano free, regiao $Region)..."
    $db = Invoke-Render -Method POST -Path '/postgres' -Body @{
      name         = $DbName
      ownerId      = $owner.id
      plan         = 'free'
      region       = $Region
      version      = '16'
      databaseName = 'vendas_black'
      databaseUser = 'vendas'
    }
    if ($db.PSObject.Properties.Name -contains 'postgres') { $db = $db.postgres }
    Write-Host "Banco criado: $($db.id)"
  }

  # Espera o banco ficar disponivel.
  for ($i = 0; $i -lt 60; $i++) {
    $db = Invoke-Render -Method GET -Path "/postgres/$($db.id)"
    if ($db.PSObject.Properties.Name -contains 'postgres') { $db = $db.postgres }
    if ($db.status -eq 'available') { break }
    if ($db.status -in @('creation_failed', 'unavailable')) { throw "Banco em estado '$($db.status)'." }
    Write-Host "  aguardando banco... ($($db.status))"
    Start-Sleep -Seconds 10
  }
  if ($db.status -ne 'available') { throw 'Banco nao ficou disponivel a tempo. Veja o dashboard do Render.' }

  # A URL de conexao vem em um endpoint separado.
  $conn = Invoke-Render -Method GET -Path "/postgres/$($db.id)/connection-info"
  $connectionString = $conn.internalConnectionString
  if (-not $connectionString) { $connectionString = $conn.externalConnectionString }
  if (-not $connectionString) { throw 'Nao foi possivel obter a URL de conexao do banco.' }
  Write-Host 'Banco disponivel.' -ForegroundColor Green
  if ($db.expiresAt) {
    Write-Warning "Banco free do Render expira em $($db.expiresAt). Faca upgrade ou migre os dados antes disso."
  }
}

# 3. Localiza o Web Service (Docker) e le as variaveis atuais, se existir.
$services = @(Unwrap-List (Invoke-Render -Method GET -Path '/services?limit=100') 'service' |
  Where-Object { $_.name -eq $ServiceName })

$service = $null
$existing = @()
if ($services.Count -gt 0) {
  $service = $services[0]
  Write-Host "Servico existente: $($service.name) ($($service.id))"
  try {
    $rawExisting = Invoke-Render -Method GET -Path "/services/$($service.id)/env-vars"
    foreach ($item in @($rawExisting)) {
      if ($null -eq $item) { continue }
      if ($item.PSObject.Properties.Name -contains 'envVar') { $existing += $item.envVar }
      else { $existing += $item }
    }
  }
  catch {
    Write-Warning "Nao foi possivel ler as variaveis atuais: $($_.Exception.Message)"
  }
}

if (-not $JwtSecret) {
  $currentJwt = ($existing | Where-Object { $_.key -eq 'JWT_SECRET' } | Select-Object -First 1)
  if ($currentJwt -and $currentJwt.value) { $JwtSecret = $currentJwt.value } else { $JwtSecret = New-Secret }
}

$managed = [ordered]@{
  NODE_ENV      = 'production'
  JWT_SECRET    = $JwtSecret
  FRONTEND_URL  = $FrontendUrl
}
if ($connectionString) { $managed['DATABASE_URL'] = $connectionString }

$minioKeys = @('MINIO_ENDPOINT', 'MINIO_PORT', 'MINIO_USE_SSL', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY', 'MINIO_BUCKET', 'MINIO_PUBLIC_URL')
foreach ($key in $minioKeys) {
  $value = [Environment]::GetEnvironmentVariable($key)
  if ($value) { $managed[$key] = $value }
}

$merged = @{}
foreach ($item in $existing) {
  if ($item.key -and $item.key -notin $managed.Keys) { $merged[$item.key] = [string]$item.value }
}
foreach ($key in $managed.Keys) { $merged[$key] = [string]$managed[$key] }

$envBody = @()
foreach ($key in $merged.Keys | Sort-Object) {
  $envBody += @{ key = $key; value = $merged[$key] }
}

# 4. Cria o servico ja com as variaveis, ou atualiza as variaveis de um existente.
$deployId = $null
if (-not $service) {
  Write-Host "Criando Web Service '$ServiceName' (Docker, plano free)..."
  $created = Invoke-Render -Method POST -Path '/services' -Body @{
    type              = 'web_service'
    name              = $ServiceName
    ownerId           = $owner.id
    repo              = $Repo
    branch            = $Branch
    autoDeployTrigger = 'commit'
    envVars           = $envBody
    serviceDetails    = @{
      runtime            = 'docker'
      plan               = 'free'
      region             = $Region
      healthCheckPath    = '/api/v1/health/live'
      envSpecificDetails = @{ dockerfilePath = './Dockerfile' }
    }
  }
  $service = $created
  if ($service.PSObject.Properties.Name -contains 'service') { $service = $service.service }
  if ($created.deployId) { $deployId = $created.deployId }
  Write-Host "Servico criado: $($service.id)"
}
else {
  Write-Host 'Atualizando variaveis de ambiente...'
  Invoke-Render -Method PUT -Path "/services/$($service.id)/env-vars" -Body $envBody | Out-Null
  Write-Host 'Disparando deploy...'
  $deploy = Invoke-Render -Method POST -Path "/services/$($service.id)/deploys" -Body @{}
  if ($deploy.PSObject.Properties.Name -contains 'deploy') { $deploy = $deploy.deploy }
  $deployId = $deploy.id
}
Write-Host "Deploy: $deployId"

$serviceInfo = Invoke-Render -Method GET -Path "/services/$($service.id)"
if ($serviceInfo.PSObject.Properties.Name -contains 'service') { $serviceInfo = $serviceInfo.service }
$url = $serviceInfo.serviceDetails.url
Write-Host ""
Write-Host "Servico: $url" -ForegroundColor Green
Write-Host "Health:  $url/api/v1/health/live"
Write-Host "Swagger: $url/api/v1/docs"
Write-Host "Logs:    https://dashboard.render.com/web/$($service.id)/logs"

if ($Wait) {
  Write-Host ''
  if (-not $deployId) { throw 'Nao foi possivel identificar o deploy iniciado.' }
  Write-Host 'Acompanhando o deploy (Ctrl+C para parar)...'
  $deadline = (Get-Date).AddMinutes(25)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 15
    $d = Invoke-Render -Method GET -Path "/services/$($service.id)/deploys/$deployId"
    if ($d.PSObject.Properties.Name -contains 'deploy') { $d = $d.deploy }
    Write-Host "  status: $($d.status)"
    if ($d.status -eq 'live') {
      Write-Host 'Deploy no ar!' -ForegroundColor Green
      exit 0
    }
    if ($d.status -in @('build_failed', 'canceled', 'pre_deploy_failed', 'deactivated')) {
      throw "Deploy terminou como '$($d.status)'. Veja os logs: https://dashboard.render.com/web/$($service.id)/logs"
    }
  }
  throw 'Tempo esgotado aguardando o deploy.'
}
