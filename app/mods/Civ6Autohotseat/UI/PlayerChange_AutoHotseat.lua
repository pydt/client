-- ===========================================================================
--	When the Hotseat game is loaded, a UI element is shown to the user, prompting
--  them to either start their turn, or save the game. Since their turn has just 
--  started, there is no reason to show them this dialog. This LUA file detects
--  this case, and automatically presses "start turn".
-- ===========================================================================
include("PlayerChange");

local SESSION_SENTINEL	:string = "AUTOHOTSEAT_SESSION";
-- Delay before pressing Start Turn. You need to wait this long since the underlying engine
-- actually has the game in "paused" mode before this. If you click it instantly, the user will be
-- stuck. This race condition is maybe possible with a human clicking the button too fast as well.
local AUTO_START_DELAY	:number = 1.0;
local m_countdown		:number = 0;
local m_ticking			:boolean = false;

local function Log( msg:string )
	print("AutoHotseat: " .. tostring(msg));
end

-- ===========================================================================
local function StartTurnAvailable()
	if Controls.PopupAlphaIn:IsHidden() then
		return false;
	end
	if Controls.OkButton:IsHidden() or Controls.OkButton:IsDisabled() then
		return false;		-- disabled = hotseat password required
	end
	return true;
end

-- ===========================================================================
local function AutoHotseat_OnUpdate( fDeltaTime:number )
	if not m_ticking then
		return;
	end
	m_countdown = m_countdown - fDeltaTime;
	if m_countdown > 0 then
		return;
	end
	m_ticking = false;
	ContextPtr:ClearUpdate();

	if StartTurnAvailable() then
		Log("Auto-pressing Start Turn.");
		OnOk();		-- stock global: SetPause(false), LuaEvents.PlayerChange_Close, dequeue popup
	else
		Log("Start Turn not available (waiting or password); leaving the prompt up.");
	end
end

-- ===========================================================================
local function IsAutoHotseatSession()
	if not GameConfiguration.IsHotseat() then
		return false;
	end
	local marker = Options.GetAppOption("Debug", "PlayNowSave");
	if marker ~= SESSION_SENTINEL then
		return false;
	end

	-- Clear the sentinel so that the next launch of the game doesn't
	-- accidentally opt-in to this behavior
	pcall(function()
		Options.SetAppOption("Debug", "PlayNowSave", "");
		Options.SaveOptions();
	end);
	return true;
end

-- ===========================================================================
--	Hook: ShowTurnControls (stock code calls it by global name from both
--	OnShow and BuildTurnControls, so redefining the global covers both paths)
-- ===========================================================================
if not IsAutoHotseatSession() then
	Log("Not an auto-loaded session (no session marker); PlayerChange wrapper inactive.");
else
	local BASE_ShowTurnControls = ShowTurnControls;
	function ShowTurnControls()
		BASE_ShowTurnControls();

		if not StartTurnAvailable() then
			return;
		end
		Log("Player-change prompt shown with Start Turn enabled; pressing in " .. tostring(AUTO_START_DELAY) .. "s.");
		m_countdown = AUTO_START_DELAY;
		m_ticking = true;
		ContextPtr:SetUpdate( AutoHotseat_OnUpdate );
	end

	Log("PlayerChange wrapper active.");
end
