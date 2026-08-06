# 从高清 PNG 生成多尺寸 ICO（16/32/48/64/128/256），供 electron-builder 嵌入 exe
# 用法：powershell -ExecutionPolicy Bypass -File scripts\gen-icon.ps1
# 输入：resources/icon.png（建议 512x512 透明 PNG）
# 输出：resources/icon.ico

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$pngPath = Join-Path $root 'resources\icon.png'
$icoPath = Join-Path $root 'resources\icon.ico'

if (-not (Test-Path $pngPath)) {
  Write-Error "未找到源图：$pngPath"
  exit 1
}

$src = [System.Drawing.Image]::FromFile($pngPath)
# 从大到小排列（Windows 会挑最合适的尺寸显示）
$sizes = @(256, 128, 64, 48, 32, 16)
$images = @() # 每个尺寸的 PNG 字节

foreach ($s in $sizes) {
  $bmp = New-Object System.Drawing.Bitmap($s, $s)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.DrawImage($src, 0, 0, $s, $s)
  $g.Dispose()
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $images += , $ms.ToArray()
  $ms.Dispose()
  $bmp.Dispose()
}
$src.Dispose()

# 组装 ICO（ICONDIR + N 个 ICONDIRENTRY + PNG 数据）
$out = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($out)
$bw.Write([UInt16]0)             # reserved
$bw.Write([UInt16]1)             # type = icon
$bw.Write([UInt16]$sizes.Count)  # 图片数量
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $s = $sizes[$i]
  $w = 0
  if ($s -lt 256) { $w = $s }
  $bw.Write([Byte]$w)      # width（256 用 0 表示）
  $bw.Write([Byte]$w)      # height
  $bw.Write([Byte]0)       # color count
  $bw.Write([Byte]0)       # reserved
  $bw.Write([UInt16]1)     # planes
  $bw.Write([UInt16]32)    # bit count
  $bw.Write([UInt32]$images[$i].Length) # bytes in res
  $bw.Write([UInt32]$offset)            # offset
  $offset += $images[$i].Length
}
foreach ($img in $images) { $bw.Write($img) }
$bw.Flush()
[System.IO.File]::WriteAllBytes($icoPath, $out.ToArray())
$bw.Dispose()
$out.Dispose()

Write-Output "已生成 $icoPath ($((Get-Item $icoPath).Length) bytes, 尺寸 $($sizes -join '/'))"
