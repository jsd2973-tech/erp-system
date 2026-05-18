$appPath = ".\src\App.tsx"

if (!(Test-Path $appPath)) {
  Write-Error "src\App.tsx 파일을 찾지 못했습니다."
  exit 1
}

$text = Get-Content $appPath -Raw -Encoding UTF8

$receiptState = '  const [receiptPhotoFiles, setReceiptPhotoFiles] = useState<File[]>([]);'
$receiptPreviewState = '  const [receiptUploadPreviewUrls, setReceiptUploadPreviewUrls] = useState<string[]>([]);'

if ($text -notlike "*const [receiptUploadPreviewUrls, setReceiptUploadPreviewUrls]*") {
  if ($text -notlike "*$receiptState*") {
    Write-Error "receiptPhotoFiles state 위치를 찾지 못했습니다."
    exit 1
  }

  $text = $text.Replace($receiptState, "$receiptState`r`n$receiptPreviewState")
}

$maintenanceState = '  const [maintenancePhotoFiles, setMaintenancePhotoFiles] = useState<File[]>([]);'
$maintenancePreviewState = '  const [maintenanceUploadPreviewUrls, setMaintenanceUploadPreviewUrls] = useState<string[]>([]);'

if ($text -notlike "*const [maintenanceUploadPreviewUrls, setMaintenanceUploadPreviewUrls]*") {
  if ($text -notlike "*$maintenanceState*") {
    Write-Error "maintenancePhotoFiles state 위치를 찾지 못했습니다."
    exit 1
  }

  $text = $text.Replace($maintenanceState, "$maintenanceState`r`n$maintenancePreviewState")
}

Set-Content $appPath $text -Encoding UTF8

Write-Host "사진 미리보기 state 보정 완료"
Write-Host "receiptUploadPreviewUrls / maintenanceUploadPreviewUrls 확인 완료"
