; Clean uninstall: stop the app and remove the start-at-login entry it registered.
!macro customUnInstall
  nsExec::Exec 'taskkill /IM "Commit Notch.exe" /F'
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.Commit Notch"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Commit Notch"
!macroend
