$ErrorActionPreference = "Stop"

# 获取当前分支
$branch = git branch --show-current
if ([string]::IsNullOrWhiteSpace($branch)) {
    Write-Host "无法获取当前分支，请确保在 git 仓库内。" -ForegroundColor Red
    exit 1
}

# 处理版本号
$versionFile = ".version"
if (-Not (Test-Path $versionFile)) {
    $currentVersion = "2.0.0"
} else {
    $currentVersion = (Get-Content $versionFile -Raw).Trim()
    $parts = $currentVersion.Split('.')
    if ($parts.Length -ne 3) {
        Write-Host "无效的版本号格式: $currentVersion，期望 x.y.z" -ForegroundColor Red
        exit 1
    }
    $parts[2] = [int]$parts[2] + 1
    $currentVersion = $parts -join "."
}

Write-Host "将版本升级到: $currentVersion" -ForegroundColor Cyan

# 更新文件
Set-Content -Path $versionFile -Value $currentVersion

# 提交与标签
git add .
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "没有任何修改需要提交。" -ForegroundColor Yellow
}

git commit -m "chore: release v$currentVersion"

# 删除本地可能已存在的同名 tag（防误操作）
if (git tag -l "v$currentVersion") {
    Write-Host "标签 v$currentVersion 已存在，将被覆盖" -ForegroundColor Yellow
    git tag -d "v$currentVersion"
}

git tag "v$currentVersion"

Write-Host "正在推送到 GitHub..." -ForegroundColor Cyan
git push origin $branch
git push origin "v$currentVersion"

Write-Host "发布成功！版本号 v$currentVersion 已经推送到 $branch 分支并触发 Action。" -ForegroundColor Green
