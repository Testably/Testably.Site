<#
.SYNOPSIS
    Populates Docs/pages/docs from local sibling repositories.

.DESCRIPTION
    Mirrors what Pipeline/Build.Pages.cs does, but reads each docs slice from a
    sibling clone instead of the GitHub Contents API. Use this to preview the
    site locally without a GitHub token (and without rate limits).

    The script assumes every source repo is checked out as a sibling of
    Testably.Site (same parent folder) and is on the latest main branch.
    No git operations are performed.

.PARAMETER Root
    Parent directory that contains all sibling repos. Defaults to the parent
    of this repository.

.EXAMPLE
    pwsh ./Docs/mirror-local-docs.ps1
    pwsh ./Docs/mirror-local-docs.ps1 -Root C:\Work\src\GitHub
#>
[CmdletBinding()]
param(
    [string]$Root
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$RepoRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrEmpty($Root)) {
    $Root = Split-Path -Parent $RepoRoot
}

$DocsRoot = Join-Path $RepoRoot "Docs/pages/docs"

# Mirrors AggregatedSources in Pipeline/Build.Pages.cs.
$Sources = @(
    [pscustomobject]@{ Repo="Testably.Abstractions";           SourcePath="Docs/pages/docs"; Target="Abstractions";           InlineReadme=$false; ExtraReadmes=@() }
    [pscustomobject]@{ Repo="Testably.Abstractions.Migration"; SourcePath="Docs/pages";      Target="Abstractions/migration-from-testableio/Migration"; InlineReadme=$true;  ExtraReadmes=@() }
    [pscustomobject]@{ Repo="aweXpect";                        SourcePath="Docs/pages";      Target="aweXpect";               InlineReadme=$false; ExtraReadmes=@(
        [pscustomobject]@{ Repo="aweXpect.Migration"; TargetFile="10-migration.md" }
    ) }
    [pscustomobject]@{ Repo="aweXpect.Json";         SourcePath="Docs/pages";      Target="Extensions/aweXpect.Json";       InlineReadme=$true;  ExtraReadmes=@() }
    [pscustomobject]@{ Repo="aweXpect.Mockolate";    SourcePath="Docs/pages";      Target="Extensions/aweXpect.Mockolate";  InlineReadme=$true;  ExtraReadmes=@() }
    [pscustomobject]@{ Repo="aweXpect.Reflection";   SourcePath="Docs/pages";      Target="Extensions/aweXpect.Reflection"; InlineReadme=$true;  ExtraReadmes=@() }
    [pscustomobject]@{ Repo="aweXpect.Testably";     SourcePath="Docs/pages";      Target="Extensions/aweXpect.Testably";   InlineReadme=$true;  ExtraReadmes=@() }
    [pscustomobject]@{ Repo="aweXpect.Web";          SourcePath="Docs/pages";      Target="Extensions/aweXpect.Web";        InlineReadme=$true;  ExtraReadmes=@() }
    [pscustomobject]@{ Repo="aweXpect.Chronology";   SourcePath="Docs/pages";      Target="Chronology";                     InlineReadme=$true;  ExtraReadmes=@() }
    [pscustomobject]@{ Repo="Mockolate";             SourcePath="Docs/pages";      Target="Mockolate";                      InlineReadme=$false; ExtraReadmes=@(
        [pscustomobject]@{ Repo="Mockolate.Migration"; TargetFile="11-migration.md" }
    ) }
    [pscustomobject]@{ Repo="Awaiten";               SourcePath="Docs/pages";      Target="Awaiten";                        InlineReadme=$false; ExtraReadmes=@() }
)

# Local clones often contain build output that the GitHub-API path would not
# see, so filter it out.
$ExcludeDirs = @("node_modules", ".docusaurus", "build", ".git")
$IndexRegex = [regex]'^(\d+)-index(\.mdx?)$'
$TextExt = @(".md", ".mdx", ".json", ".yml", ".yaml", ".txt", ".css", ".js", ".tsx", ".ts", ".svg")
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Strip-ReadmeFront([string]$readme) {
    $lines = ($readme -replace "`r`n", "`n") -split "`n"
    $i = 0
    while ($i -lt $lines.Length -and [string]::IsNullOrWhiteSpace($lines[$i])) { $i++ }
    if ($i -lt $lines.Length -and $lines[$i].TrimStart().StartsWith("# ")) { $i++ }
    while ($i -lt $lines.Length -and [string]::IsNullOrWhiteSpace($lines[$i])) { $i++ }
    while ($i -lt $lines.Length -and $lines[$i].TrimStart().StartsWith("[!")) { $i++ }
    while ($i -lt $lines.Length -and [string]::IsNullOrWhiteSpace($lines[$i])) { $i++ }
    if ($i -ge $lines.Length) { return "" }
    return ($lines[$i..($lines.Length - 1)] -join "`n")
}

function Get-ReadmeIntro([string]$readmePath) {
    if (-not (Test-Path -LiteralPath $readmePath)) { return "" }
    $content = Get-Content -Raw -LiteralPath $readmePath -Encoding UTF8
    $idx = $content.IndexOf("`n##")
    if ($idx -gt 0) { return $content.Substring($idx) }
    return ""
}

function Get-ReadmeBody([string]$readmePath) {
    if (-not (Test-Path -LiteralPath $readmePath)) { return "" }
    $content = Get-Content -Raw -LiteralPath $readmePath -Encoding UTF8
    return Strip-ReadmeFront $content
}

function Ensure-SidebarPosition([string]$content, [int]$position) {
    $startsWithFm = $content.StartsWith("---`n") -or $content.StartsWith("---`r`n")
    if ($startsWithFm) {
        $fmStart = $content.IndexOf("`n") + 1
        $fmEnd = $content.IndexOf("`n---", $fmStart)
        if ($fmEnd -gt 0) {
            $fm = $content.Substring($fmStart, $fmEnd - $fmStart)
            if ($fm -match "(?m)^sidebar_position\s*:") {
                return $content
            }
            return $content.Insert($fmEnd, "`nsidebar_position: $position")
        }
    }
    return "---`nsidebar_position: $position`n---`n`n$content"
}

New-Item -ItemType Directory -Path $DocsRoot -Force | Out-Null

# Clean each target subdirectory rather than the whole DocsRoot so that
# site-owned overlays committed under docs/ (e.g. Extensions/index.mdx)
# survive the mirror.
foreach ($source in $Sources) {
    $sourceDir = Join-Path $Root (Join-Path $source.Repo $source.SourcePath)
    $targetDir = Join-Path $DocsRoot $source.Target

    Write-Host ""
    Write-Host "== $($source.Repo) -> docs/$($source.Target)"

    if (-not (Test-Path -LiteralPath $sourceDir)) {
        Write-Warning "  Source not found: $sourceDir - skipping"
        continue
    }

    if (Test-Path -LiteralPath $targetDir) {
        Remove-Item -LiteralPath $targetDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

    $readmeIntro = ""
    if ($source.InlineReadme) {
        $readmePath = Join-Path $Root (Join-Path $source.Repo "README.md")
        $intro = Get-ReadmeIntro $readmePath
        if (-not [string]::IsNullOrEmpty($intro)) {
            $readmeIntro = $intro.Replace("Docs/pages/", "./")
        }
    }
    $readmeIntroDone = [string]::IsNullOrEmpty($readmeIntro)

    $extraReadmes = New-Object System.Collections.ArrayList
    foreach ($extra in $source.ExtraReadmes) {
        $extraPath = Join-Path $Root (Join-Path $extra.Repo "README.md")
        $body = Get-ReadmeBody $extraPath
        if ([string]::IsNullOrEmpty($body)) {
            Write-Warning "  ExtraReadme not found or empty: $extraPath"
        }
        [void]$extraReadmes.Add([pscustomobject]@{
            TargetFile = $extra.TargetFile
            Body = $body
            Done = [string]::IsNullOrEmpty($body)
        })
    }

    $sourceDirFull = (Resolve-Path -LiteralPath $sourceDir).ProviderPath.TrimEnd('\')
    $files = Get-ChildItem -LiteralPath $sourceDirFull -Recurse -File | Where-Object {
        $rel = $_.FullName.Substring($sourceDirFull.Length).TrimStart('\','/')
        $segments = $rel -split '[\\/]'
        $excluded = $false
        foreach ($seg in $segments) {
            if ($ExcludeDirs -contains $seg) { $excluded = $true; break }
        }
        -not $excluded
    }

    foreach ($file in $files) {
        $name = $file.Name
        $rel = $file.FullName.Substring($sourceDirFull.Length).TrimStart('\','/')
        $relDir = Split-Path -Path $rel -Parent
        $destDir = if ([string]::IsNullOrEmpty($relDir)) { $targetDir } else { Join-Path $targetDir $relDir }

        $idxMatch = $IndexRegex.Match($name)
        $sidebarPosition = $null
        $targetName = $name
        if ($idxMatch.Success) {
            $targetName = "index" + $idxMatch.Groups[2].Value
            $sidebarPosition = [int]$idxMatch.Groups[1].Value
        }

        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        $destPath = Join-Path $destDir $targetName

        $ext = [System.IO.Path]::GetExtension($name).ToLower()
        $isText = $TextExt -contains $ext

        if ($isText) {
            $content = Get-Content -Raw -LiteralPath $file.FullName -Encoding UTF8
            if ($null -eq $content) { $content = "" }

            if ($source.InlineReadme -and -not $readmeIntroDone -and $name.StartsWith("00-") -and $content.Contains("{README}")) {
                $content = $content.Replace("{README}", $readmeIntro)
                $readmeIntroDone = $true
                Write-Host "  Inlined README into $rel"
            }

            for ($i = 0; $i -lt $extraReadmes.Count; $i++) {
                $cur = $extraReadmes[$i]
                if ($cur.Done) { continue }
                if ($name -eq $cur.TargetFile -and $content.Contains("{README}")) {
                    $content = $content.Replace("{README}", $cur.Body)
                    $cur.Done = $true
                    Write-Host "  Inlined extra README from $($source.ExtraReadmes[$i].Repo) into $rel"
                }
            }

            if ($null -ne $sidebarPosition) {
                $content = Ensure-SidebarPosition $content $sidebarPosition
            }

            [System.IO.File]::WriteAllText($destPath, $content, $Utf8NoBom)
        } else {
            Copy-Item -LiteralPath $file.FullName -Destination $destPath -Force
        }
    }

    foreach ($cur in $extraReadmes) {
        if (-not $cur.Done) {
            Write-Warning "  ExtraReadme '$($cur.TargetFile)' was never substituted (no matching file with {README} placeholder)"
        }
    }
}

Write-Host ""
Write-Host "Done. Output at: $DocsRoot"
