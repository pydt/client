-- ===========================================================================
--	AutoHotseat shim.
--
--	On game launch, Civ6 looks for Test.lua, which is seemingly a debug shim.
--  By loading our own Test.lua, we can load our own Lua payload earlier, which
--  we need in order to change the behavior of the main menu.
-- ===========================================================================
include("AutoHotseat_FrontEnd");
