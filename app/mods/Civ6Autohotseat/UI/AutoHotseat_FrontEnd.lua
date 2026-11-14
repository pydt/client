-- ===========================================================================
--	AutoHotseat front-end driver
--
--  This is the core of the autostart mod, and it's the file that drives
--  automatically manipulating the main menu. This LUA code automatically enters
--  the hotseat load menu, searches for a saved game matching the PlayNowSave key
--  that we set in the PYDT client, and then loads it automatically while accepting
--  any dialogs needed.
-- ===========================================================================

local SESSION_SENTINEL			:string = "AUTOHOTSEAT_SESSION";

local MENU_SETTLE_DELAY		:number = 0.1;		-- seconds the main menu must be visible before we load
local MENU_WAIT_TIMEOUT		:number = 20;		-- give up if the main menu never appears
local STAGING_LAUNCH_DELAY	:number = 0.4;		-- seconds after the staging room appears before pressing Start

local STATE_WAIT_MENU		:string = "WAIT_MENU";
local STATE_LOADING			:string = "LOADING";
local STATE_LAUNCH_COUNTDOWN:string = "LAUNCH_COUNTDOWN";
local STATE_DONE			:string = "DONE";

local m_state			:string = STATE_DONE;		-- nothing to do until Initialize() arms us
local m_savePath		:string = nil;
local m_elapsed			:number = 0;
local m_menuVisibleFor	:number = 0;
local m_countdown		:number = 0;

local function Log( msg:string )
	print("AutoHotseat: " .. tostring(msg));
end

local function ReadAndClearSaveOption()
	local save = Options.GetAppOption("Debug", "PlayNowSave");
	if save == nil or save == "" then
		return nil;
	end

	Log("PlayNowSave = '" .. tostring(save) .. "'");
	Options.SetAppOption("Debug", "PlayNowSave", "");
	Options.SaveOptions();

	local after = Options.GetAppOption("Debug", "PlayNowSave");

	Log("PlayNowSave after clear = '" .. tostring(after) .. "'");

	if save == SESSION_SENTINEL then
		Log("That was a stale session marker, not a save; idle.");
		return nil;
	end

	return save;
end

-- The session sentinel is read by PlayerChange_AutoHoseat.lua to make
-- sure that this is session was launched from PYDT.
local function SetSessionMarker()
	Options.SetAppOption("Debug", "PlayNowSave", SESSION_SENTINEL);
	Options.SaveOptions();

	local readback = Options.GetAppOption("Debug", "PlayNowSave");
	Log("Session marker: PlayNowSave = '" .. tostring(readback) .. "'");

	return readback == SESSION_SENTINEL;
end

local function IsMainMenuVisible()
	local menu = ContextPtr:LookUpControl("/FrontEnd/MainMenu");
	if menu == nil then
		return false;
	end
	return not menu:IsHidden();
end

-- ===========================================================================
--	Save lookup. Network.LoadGame needs the entry that UI.QuerySaveGameList
--	returns for the file so instead we query through the UI to find a listing
--  for a save file that matches our expected path. This is a bit round-about,
--  but it's how the game expects to find save games.
-- ===========================================================================
local QUERY_TIMEOUT			:number = 8;
local m_queryID				:number = nil;
local m_queryElapsed		:number = 0;

local function NormalizePath( p:string )
	if p == nil then return ""; end
	p = string.gsub(p, "/", "\\");
	return string.lower(p);
end

local function DirNameFromPath( path:string )
	return string.match(path, "^(.*)[\\/][^\\/]+$") or "";
end

local function GiveUp( reason:string )
	Log("ERROR: " .. reason .. " Could not load '" .. m_savePath .. "'; normal main menu stays up.");
	m_queryID = nil;
	m_state = STATE_DONE;
	ContextPtr:ClearUpdate();
end

local function OnFileListQueryResults( fileList:table, id:number )
	if m_queryID == nil or id ~= m_queryID then
		Log("Something went wrong, OnFileListQueryResults() did not recognize the queryID")
		return;
	end

	UI.CloseFileListQuery( id );
	m_queryID = nil;

	local wantPath = NormalizePath(m_savePath);
	Log("Query returned " .. tostring(#fileList) .. " entries.");

	for _, entry in ipairs(fileList) do
		if not entry.IsDirectory and NormalizePath(entry.Path) == wantPath then
			Log("Matched save entry: Name='" .. tostring(entry.Name) .. "' Path='" .. tostring(entry.Path) .. "'");

			Network.LeaveGame();
			if Network.LoadGame(entry, ServerType.SERVER_TYPE_HOTSEAT) ~= false then
				Log("Network.LoadGame(entry) accepted; waiting for staging room.");
			else
				GiveUp("Network.LoadGame(entry) returned false.");
			end
			return;
		end
	end

	GiveUp("No save-list entry matched.");
end

local function StartHotseatLoad()
	m_state = STATE_LOADING;
	Log("Starting hotseat load of '" .. m_savePath .. "'");

	LuaEvents.ChangeMPLobbyMode("HOTSEAT");
	GameConfiguration.SetToDefaults(GameModeTypes.HOTSEAT);

	local options = SaveLocationOptions.NORMAL + SaveLocationOptions.AUTOSAVE + SaveLocationOptions.QUICKSAVE + SaveLocationOptions.LOAD_METADATA;
	m_queryElapsed = 0;
	m_queryID = UI.QuerySaveGameList( SaveLocations.LOCAL_STORAGE, Network.GetGameConfigurationSaveType(), options, SaveFileTypes.GAME_STATE, DirNameFromPath(m_savePath) );
end

local function LaunchFromStagingRoom()
	m_state = STATE_DONE;
	ContextPtr:ClearUpdate();

	if not GameConfiguration.IsHotseat() then
		Log("Session is not hotseat; leaving the staging room for the player.");
		return;
	end

	local localPlayerID :number = Network.GetLocalPlayerID();
	local localPlayerConfig = PlayerConfigurations[localPlayerID];
	if localPlayerConfig ~= nil then
		localPlayerConfig:SetReady(true);
		Network.BroadcastPlayerInfo();
	end

	-- Mark this session as auto-loaded so the in-game PlayerChange wrapper activates.
	local ok, stored = pcall(SetSessionMarker);
	if not ok then
		Log("Could not set session marker: " .. tostring(stored));
	elseif not stored then
		Log("Session marker did not stick; in-game auto Start Turn will stay inactive.");
	end

	Log("Launching hotseat game (Network.LaunchGame).");
	Network.LaunchGame();
end

local function OnStagingRoomShown()
	if m_state == STATE_LOADING then
		Log("Staging room raised; launching in " .. tostring(STAGING_LAUNCH_DELAY) .. "s.");
		m_countdown = STAGING_LAUNCH_DELAY;
		m_state = STATE_LAUNCH_COUNTDOWN;
	end
end

local function OnUpdate( fDeltaTime:number )
	if m_state == STATE_WAIT_MENU then
		m_elapsed = m_elapsed + fDeltaTime;
		if IsMainMenuVisible() then
			m_menuVisibleFor = m_menuVisibleFor + fDeltaTime;
		else
			m_menuVisibleFor = 0;
		end
		if m_menuVisibleFor >= MENU_SETTLE_DELAY then
			StartHotseatLoad();
		elseif m_elapsed >= MENU_WAIT_TIMEOUT then
			GiveUp("Main menu not detected after " .. tostring(MENU_WAIT_TIMEOUT) .. "s.");
		end

	elseif m_state == STATE_LOADING and m_queryID ~= nil then
		m_queryElapsed = m_queryElapsed + fDeltaTime;
		if m_queryElapsed >= QUERY_TIMEOUT then
			UI.CloseFileListQuery( m_queryID );
			GiveUp("Save list query timed out.");
		end

	elseif m_state == STATE_LAUNCH_COUNTDOWN then
		m_countdown = m_countdown - fDeltaTime;
		if m_countdown <= 0 then
			LaunchFromStagingRoom();
		end
	end
end

function Initialize()
	m_savePath = ReadAndClearSaveOption();
	if m_savePath == nil then
		Log("No PlayNowSave set; idle.");
		return;
	end

	LuaEvents.JoiningRoom_ShowStagingRoom.Add( OnStagingRoomShown );
	LuaEvents.HostGame_ShowStagingRoom.Add( OnStagingRoomShown );
	LuaEvents.FileListQueryResults.Add( OnFileListQueryResults );

	m_state = STATE_WAIT_MENU;
	m_elapsed = 0;
	m_menuVisibleFor = 0;
	ContextPtr:SetUpdate( OnUpdate );
	Log("Armed; waiting for the main menu.");
end

Initialize();
