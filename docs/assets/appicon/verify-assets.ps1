[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$androidNamespace = 'http://schemas.android.com/apk/res/android'

function Assert-Equal {
    param(
        [Parameter(Mandatory)] $Actual,
        [Parameter(Mandatory)] $Expected,
        [Parameter(Mandatory)] [string] $Label
    )

    if ($Actual -ne $Expected) {
        throw "$Label expected '$Expected' but found '$Actual'."
    }
}

function Read-XmlFile {
    param([Parameter(Mandatory)] [string] $Path)

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Missing required asset: $Path"
    }

    return [xml](Get-Content -LiteralPath $Path -Raw)
}

function Get-AndroidAttribute {
    param(
        [Parameter(Mandatory)] [System.Xml.XmlElement] $Element,
        [Parameter(Mandatory)] [string] $Name
    )

    return $Element.GetAttribute($Name, $androidNamespace)
}

function Normalize-PathData {
    param([Parameter(Mandatory)] [string] $PathData)

    return [regex]::Replace($PathData, '[,\s]+', '').ToUpperInvariant()
}

function Get-SvgPathData {
    param([Parameter(Mandatory)] [xml] $Document)

    return @($Document.SelectNodes("//*[local-name()='path']") | ForEach-Object {
        Normalize-PathData -PathData $_.GetAttribute('d')
    })
}

function Get-AndroidPathData {
    param([Parameter(Mandatory)] [xml] $Document)

    return @($Document.SelectNodes("//*[local-name()='path']") | ForEach-Object {
        Normalize-PathData -PathData (Get-AndroidAttribute -Element $_ -Name 'pathData')
    })
}

function Assert-PathParity {
    param(
        [Parameter(Mandatory)] [xml] $Svg,
        [Parameter(Mandatory)] [xml] $Android,
        [Parameter(Mandatory)] [string] $Label
    )

    $svgPaths = Get-SvgPathData -Document $Svg
    $androidPaths = Get-AndroidPathData -Document $Android
    Assert-Equal -Actual $androidPaths.Count -Expected $svgPaths.Count -Label "$Label path count"

    for ($index = 0; $index -lt $svgPaths.Count; $index++) {
        Assert-Equal -Actual $androidPaths[$index] -Expected $svgPaths[$index] -Label "$Label path $($index + 1)"
    }
}

function Assert-SvgCanvas {
    param(
        [Parameter(Mandatory)] [xml] $Document,
        [Parameter(Mandatory)] [string] $Label
    )

    Assert-Equal -Actual $Document.DocumentElement.GetAttribute('width') -Expected '108' -Label "$Label width"
    Assert-Equal -Actual $Document.DocumentElement.GetAttribute('height') -Expected '108' -Label "$Label height"
    Assert-Equal -Actual $Document.DocumentElement.GetAttribute('viewBox') -Expected '0 0 512 512' -Label "$Label viewBox"
}

function Assert-AndroidCanvas {
    param(
        [Parameter(Mandatory)] [xml] $Document,
        [Parameter(Mandatory)] [string] $Label
    )

    $root = $Document.DocumentElement
    Assert-Equal -Actual (Get-AndroidAttribute -Element $root -Name 'width') -Expected '108dp' -Label "$Label width"
    Assert-Equal -Actual (Get-AndroidAttribute -Element $root -Name 'height') -Expected '108dp' -Label "$Label height"
    Assert-Equal -Actual (Get-AndroidAttribute -Element $root -Name 'viewportWidth') -Expected '512' -Label "$Label viewport width"
    Assert-Equal -Actual (Get-AndroidAttribute -Element $root -Name 'viewportHeight') -Expected '512' -Label "$Label viewport height"
}

$backgroundSvgPath = Join-Path $PSScriptRoot 'appicon-background.svg'
$foregroundSvgPath = Join-Path $PSScriptRoot 'appicon-foreground.svg'
$monochromeSvgPath = Join-Path $PSScriptRoot 'appicon-monochrome.svg'
$backgroundAndroidPath = Join-Path $PSScriptRoot 'android/drawable/ic_launcher_background.xml'
$foregroundAndroidPath = Join-Path $PSScriptRoot 'android/drawable/ic_launcher_foreground.xml'
$monochromeAndroidPath = Join-Path $PSScriptRoot 'android/drawable/ic_launcher_monochrome.xml'
$adaptiveV26Path = Join-Path $PSScriptRoot 'android/mipmap-anydpi-v26/ic_launcher.xml'
$adaptiveV33Path = Join-Path $PSScriptRoot 'android/mipmap-anydpi-v33/ic_launcher.xml'

$backgroundSvg = Read-XmlFile -Path $backgroundSvgPath
$foregroundSvg = Read-XmlFile -Path $foregroundSvgPath
$monochromeSvg = Read-XmlFile -Path $monochromeSvgPath
$backgroundAndroid = Read-XmlFile -Path $backgroundAndroidPath
$foregroundAndroid = Read-XmlFile -Path $foregroundAndroidPath
$monochromeAndroid = Read-XmlFile -Path $monochromeAndroidPath
$adaptiveV26 = Read-XmlFile -Path $adaptiveV26Path
$adaptiveV33 = Read-XmlFile -Path $adaptiveV33Path

Assert-SvgCanvas -Document $backgroundSvg -Label 'Background SVG'
Assert-SvgCanvas -Document $foregroundSvg -Label 'Foreground SVG'
Assert-SvgCanvas -Document $monochromeSvg -Label 'Monochrome SVG'
Assert-AndroidCanvas -Document $backgroundAndroid -Label 'Background Android vector'
Assert-AndroidCanvas -Document $foregroundAndroid -Label 'Foreground Android vector'
Assert-AndroidCanvas -Document $monochromeAndroid -Label 'Monochrome Android vector'

Assert-PathParity -Svg $backgroundSvg -Android $backgroundAndroid -Label 'Background'
Assert-PathParity -Svg $foregroundSvg -Android $foregroundAndroid -Label 'Foreground'
Assert-PathParity -Svg $monochromeSvg -Android $monochromeAndroid -Label 'Monochrome'

$expectedSvgTransform = 'translate(256 256) scale(0.6) translate(-256 -256)'
foreach ($entry in @(
    @{ Document = $foregroundSvg; Label = 'Foreground SVG' },
    @{ Document = $monochromeSvg; Label = 'Monochrome SVG' }
)) {
    $group = $entry.Document.SelectSingleNode("//*[local-name()='g' and @transform]")
    Assert-Equal -Actual $group.GetAttribute('transform') -Expected $expectedSvgTransform -Label "$($entry.Label) transform"
}

foreach ($entry in @(
    @{ Document = $foregroundAndroid; Label = 'Foreground Android vector' },
    @{ Document = $monochromeAndroid; Label = 'Monochrome Android vector' }
)) {
    $group = $entry.Document.SelectSingleNode("//*[local-name()='group']")
    Assert-Equal -Actual (Get-AndroidAttribute -Element $group -Name 'pivotX') -Expected '256' -Label "$($entry.Label) pivot X"
    Assert-Equal -Actual (Get-AndroidAttribute -Element $group -Name 'pivotY') -Expected '256' -Label "$($entry.Label) pivot Y"
    Assert-Equal -Actual (Get-AndroidAttribute -Element $group -Name 'scaleX') -Expected '0.6' -Label "$($entry.Label) scale X"
    Assert-Equal -Actual (Get-AndroidAttribute -Element $group -Name 'scaleY') -Expected '0.6' -Label "$($entry.Label) scale Y"
}

$v26Monochrome = $adaptiveV26.SelectNodes("//*[local-name()='monochrome']")
$v33Monochrome = $adaptiveV33.SelectNodes("//*[local-name()='monochrome']")
Assert-Equal -Actual $v26Monochrome.Count -Expected 0 -Label 'API 26 monochrome element count'
Assert-Equal -Actual $v33Monochrome.Count -Expected 1 -Label 'API 33 monochrome element count'

foreach ($entry in @(
    @{ Document = $adaptiveV26; Label = 'API 26 adaptive icon'; Monochrome = $false },
    @{ Document = $adaptiveV33; Label = 'API 33 adaptive icon'; Monochrome = $true }
)) {
    $background = $entry.Document.SelectSingleNode("//*[local-name()='background']")
    $foreground = $entry.Document.SelectSingleNode("//*[local-name()='foreground']")
    Assert-Equal -Actual (Get-AndroidAttribute -Element $background -Name 'drawable') -Expected '@drawable/ic_launcher_background' -Label "$($entry.Label) background"
    Assert-Equal -Actual (Get-AndroidAttribute -Element $foreground -Name 'drawable') -Expected '@drawable/ic_launcher_foreground' -Label "$($entry.Label) foreground"

    if ($entry.Monochrome) {
        $monochrome = $entry.Document.SelectSingleNode("//*[local-name()='monochrome']")
        Assert-Equal -Actual (Get-AndroidAttribute -Element $monochrome -Name 'drawable') -Expected '@drawable/ic_launcher_monochrome' -Label "$($entry.Label) monochrome"
    }
}

$backgroundSvgText = Get-Content -LiteralPath $backgroundSvgPath -Raw
$backgroundAndroidText = Get-Content -LiteralPath $backgroundAndroidPath -Raw
foreach ($color in '#231133', '#0B0911', '#0C2118', '#B86CFF', '#45FF63') {
    if (-not $backgroundSvgText.Contains($color, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Background SVG is missing palette color $color."
    }
}
foreach ($color in '#FF231133', '#FF0B0911', '#FF0C2118', '#1AB86CFF', '#1645FF63') {
    if (-not $backgroundAndroidText.Contains($color, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Background Android vector is missing palette color $color."
    }
}

Write-Output 'Adaptive icon assets are consistent: three SVG layers, three Android vector drawables, and API 26/API 33 adaptive-icon definitions.'
