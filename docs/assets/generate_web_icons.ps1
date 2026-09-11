param(
    [string] $SourceSvg = (Join-Path $PSScriptRoot 'mecha_todo_helmet.svg'),
    [string] $PublicDir = (Join-Path $PSScriptRoot '..\..\public')
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command magick -ErrorAction SilentlyContinue)) {
    throw 'ImageMagick (magick) is required to generate the web icons.'
}

$sourcePath = (Resolve-Path -LiteralPath $SourceSvg).Path
$publicPath = [System.IO.Path]::GetFullPath($PublicDir)
$iconsPath = Join-Path $publicPath 'icons'

New-Item -ItemType Directory -Force -Path $iconsPath | Out-Null
Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $publicPath 'favicon.svg') -Force

function Invoke-Magick {
    param([Parameter(Mandatory)][string[]] $Arguments)

    & magick @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "ImageMagick exited with code $LASTEXITCODE."
    }
}

function New-TransparentIcon {
    param(
        [Parameter(Mandatory)][int] $Size,
        [Parameter(Mandatory)][string] $OutputPath
    )

    Invoke-Magick @(
        '-background', 'none',
        $sourcePath,
        '-alpha', 'on',
        '-resize', "${Size}x${Size}",
        '-colorspace', 'sRGB',
        '-strip',
        "PNG32:$OutputPath"
    )
}

function New-BackgroundIcon {
    param(
        [Parameter(Mandatory)][int] $Size,
        [Parameter(Mandatory)][int] $LogoSize,
        [Parameter(Mandatory)][string] $OutputPath
    )

    Invoke-Magick @(
        '-size', "${Size}x${Size}",
        'xc:#000000',
        '(',
        '-background', 'none',
        $sourcePath,
        '-alpha', 'on',
        '-resize', "${LogoSize}x${LogoSize}",
        ')',
        '-gravity', 'center',
        '-compose', 'over',
        '-composite',
        '-colorspace', 'sRGB',
        '-strip',
        "PNG24:$OutputPath"
    )
}

foreach ($size in 16, 32, 48) {
    New-TransparentIcon -Size $size -OutputPath (Join-Path $publicPath "favicon-${size}x${size}.png")
}

Invoke-Magick @(
    '-background', 'none',
    $sourcePath,
    '-alpha', 'on',
    '-define', 'icon:auto-resize=48,32,16',
    (Join-Path $publicPath 'favicon.ico')
)

New-BackgroundIcon -Size 180 -LogoSize 148 -OutputPath (Join-Path $publicPath 'apple-touch-icon.png')

foreach ($size in 192, 512) {
    New-TransparentIcon -Size $size -OutputPath (Join-Path $iconsPath "pwa-${size}x${size}.png")
    $safeLogoSize = [Math]::Floor($size * 0.64)
    New-BackgroundIcon -Size $size -LogoSize $safeLogoSize -OutputPath (Join-Path $iconsPath "pwa-maskable-${size}x${size}.png")
}

Write-Host "Generated web icons in $publicPath"
