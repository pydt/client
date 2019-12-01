!macro customInit
  ${ifNot} ${isUpdated}
    nsExec::Exec '"$LOCALAPPDATA\playyourdamnturn\Update.exe" --uninstall -s'
    delete "$LOCALAPPDATA\playyourdamnturn\Update.exe"
    delete "$LOCALAPPDATA\playyourdamnturn\.dead"
    rmDir "$LOCALAPPDATA\playyourdamnturn"
  ${endIf}
!macroend