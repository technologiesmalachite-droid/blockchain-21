# Local Email OTP Testing (PowerShell)

Use a known valid email string in every command. Do not rely on an unset `$email` variable.

## 1) Send OTP

```powershell
$email = "step1.12345@example.com"
$tmp = Join-Path $env:TEMP "mx-otp-send.json"
("{""email"":""$email""}") | Set-Content -Path $tmp -NoNewline
curl.exe -i -s -X POST http://localhost:5000/api/auth/email-otp/send -H "Content-Type: application/json" --data-binary "@$tmp"
Remove-Item $tmp -Force
```

## 2) Verify OTP

```powershell
$email = "step1.12345@example.com"
$otp = "123456"
$tmp = Join-Path $env:TEMP "mx-otp-verify.json"
("{""email"":""$email"",""otp"":""$otp""}") | Set-Content -Path $tmp -NoNewline
curl.exe -i -s -X POST http://localhost:5000/api/auth/email-otp/verify -H "Content-Type: application/json" --data-binary "@$tmp"
Remove-Item $tmp -Force
```
