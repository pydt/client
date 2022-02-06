!macro customInit
  ${ifNot} ${isUpdated}
    ; Create uninstall marker if Squirrel app exists
    ${if} ${FileExists} "$LOCALAPPDATA\playyourdamnturn"
      FileOpen $9 "$LOCALAPPDATA\playyourdamnturn\.shouldUninstall" w
      FileClose $9
    ${endIf}

    ; Delete the start menu shortcut
    Delete "$APPDATA\Microsoft\Windows\Start Menu\Programs\playyourdamnturn.com\Play Your Damn Turn Client.lnk"
    ; Delete the parent directory if it's not empty (because there's no /r)
    RMDir "$APPDATA\Microsoft\Windows\Start Menu\Programs\playyourdamnturn.com"
  ${endIf}
!macroend