; Clean uninstall: stop the app, remove the start-at-login entry, then say goodbye.
; An update runs the old uninstaller too, so all of this is skipped then: start at login stays on.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    nsExec::Exec 'taskkill /IM "Commit Notch.exe" /F'
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "electron.app.Commit Notch"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Commit Notch"
    IfSilent +2
      MessageBox MB_OK|MB_ICONINFORMATION "Sorry to see you go.$\r$\n$\r$\nCommit Notch is gone, and so is everything it kept on this PC. Your work isn't. Every commit you pushed is still out there, quietly adding up, whether anyone is watching or not.$\r$\n$\r$\nThe top of your screen will always have room for it again.$\r$\n$\r$\nHave a great day, and let's meet again soon ;)$\r$\n$\r$\nRitesh Roshan$\r$\nLead engineer, Commit Notch"
  ${endIf}
!macroend
