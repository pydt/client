-- ===========================================================================
--	AutoHotseat override of UI/FrontEnd/IntroScreen.lua
--
--	This file exists only to skip the copyright notices splashscreen on game launch.
--  Normally this takes 5 seconds, but with this LUA file we can get it down to
--  1 second in practice.
-- ===========================================================================
local m_delay :number = 0.1;

function OnUpdate( fDTime:number )
	m_delay = m_delay - fDTime;
	if m_delay < 0 then
		ContextPtr:ClearUpdate();
		Events.UserAcceptsEULA();
	end
end

Controls.CopyrightAccept:SetHide( true );
ContextPtr:SetUpdate( OnUpdate );
Events.UserRequestClose.Add( function() Events.UserConfirmedClose(); end );
