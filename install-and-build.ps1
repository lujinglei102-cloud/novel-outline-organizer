$ErrorActionPreference = "Stop"

$ProjectPath = "D:\app\小说大纲辅助器"
$NpmRegistry = "https://registry.npmmirror.com/"

function Write-Step($msg) {
  Write-Host ""
  Write-Host "==== $msg ====" -ForegroundColor Cyan
}

function Run-Step($cmd) {
  Write-Host $cmd -ForegroundColor Yellow
  cmd /c $cmd
  return $LASTEXITCODE
}

Set-Location $ProjectPath

Write-Step "1. 修正 npm 配置"
Run-Step "npm config set registry $NpmRegistry" | Out-Null
Run-Step "npm config delete proxy" | Out-Null
Run-Step "npm config delete https-proxy" | Out-Null
Run-Step "npm config get registry" | Out-Null

Write-Step "2. 尝试 npm install"
$code = Run-Step "npm install --registry=$NpmRegistry --fetch-timeout=60000 --fetch-retries=3 --loglevel=verbose"
if ($code -eq 0) {
  Write-Host "npm install 成功" -ForegroundColor Green
} else {
  Write-Host "npm install 失败，尝试 pnpm" -ForegroundColor Red

  Write-Step "3. 安装并尝试 pnpm"
  $code = Run-Step "npm install -g pnpm --registry=$NpmRegistry"
  if ($code -eq 0) {
    $code = Run-Step "pnpm config set registry $NpmRegistry"
    $code = Run-Step "pnpm install"
  }

  if ($code -eq 0) {
    Write-Host "pnpm install 成功" -ForegroundColor Green
  } else {
    Write-Host "pnpm 失败，尝试 yarn" -ForegroundColor Red

    Write-Step "4. 安装并尝试 yarn"
    $code = Run-Step "npm install -g yarn --registry=$NpmRegistry"
    if ($code -eq 0) {
      $code = Run-Step "yarn config set registry $NpmRegistry"
      $code = Run-Step "yarn install"
    }

    if ($code -eq 0) {
      Write-Host "yarn install 成功" -ForegroundColor Green
    } else {
      throw "npm / pnpm / yarn 全部安装失败，未能完成依赖安装。"
    }
  }
}

Write-Step "5. 执行构建"
$code = Run-Step "npm run build"
if ($code -ne 0) {
  $code = Run-Step "pnpm build"
}
if ($code -ne 0) {
  $code = Run-Step "yarn build"
}
if ($code -ne 0) {
  throw "依赖已安装，但构建失败，请检查项目本身编译错误。"
}

Write-Step "6. 完成"
Write-Host "依赖安装和构建已完成，请查看 dist 目录。" -ForegroundColor Green
