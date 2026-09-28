# Refresh the small CC0 source snapshot used by refresh-next-1000-candidates.mjs.
# Run from the repository root. The catalog generator itself works offline.
$ErrorActionPreference = 'Stop'
$groups = [ordered]@{
  bridge = @('Q12280', 235)
  skyscraper = @('Q11303', 200)
  castle = @('Q23413', 190)
  cathedral = @('Q2977', 185)
  mosque = @('Q32815', 175)
  temple = @('Q44539', 175)
  tower = @('Q12518', 175)
  lighthouse = @('Q39715', 145)
  stadium = @('Q483110', 155)
  museum = @('Q33506', 155)
  railway_station = @('Q55488', 150)
  dam = @('Q12323', 150)
  palace = @('Q16560', 155)
  monument = @('Q4989906', 155)
}
$path = Join-Path $PSScriptRoot '../../../content/worldgen/source/next-1000/wikidata-snapshot.json'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $path) | Out-Null
$out = [ordered]@{ source = 'Wikidata SPARQL'; capturedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd'); groups = [ordered]@{} }
foreach ($entry in $groups.GetEnumerator()) {
  $category = $entry.Key
  $classId = $entry.Value[0]
  $limit = $entry.Value[1]
  $query = @"
SELECT ?item ?itemLabel ?links ?coord WHERE {
  ?item wdt:P31 wd:$classId; wdt:P625 ?coord; wikibase:sitelinks ?links.
  FILTER(?links >= 3)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) ?item LIMIT $limit
"@
  $response = Invoke-RestMethod -Method Post -Uri 'https://query.wikidata.org/sparql' `
    -Body @{ query = $query } `
    -Headers @{ Accept = 'application/sparql-results+json'; 'User-Agent' = 'MolenModelCandidateCatalog/1.0' } `
    -TimeoutSec 90
  $rows = @($response.results.bindings | ForEach-Object {
    [ordered]@{
      id = $_.item.value.Split('/')[-1]
      title = $_.itemLabel.value
      links = [int]$_.links.value
      coord = $_.coord.value
    }
  })
  $out.groups[$category] = [ordered]@{ classId = $classId; rows = $rows }
  Write-Output "$category`: $($rows.Count) records"
  $out | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $path -Encoding utf8
  Start-Sleep -Milliseconds 300
}
Write-Output "Wrote $path"
