#!/usr/bin/osascript

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Mute Meet
# @raycast.mode compact

# Optional parameters:
# @raycast.icon 🤖
# @raycast.packageName Communication

# Documentation:
# @raycast.description Mute Google Meet
# @raycast.author Guillaume Ongenae
# @raycast.authorURL https://github.com/g-ongenae

-- Source: https://github.com/aezell/mutemeet
tell application "Google Chrome"
  activate
  repeat with w in (windows) -- loop over each window
    set j to 1 -- tabs are not zeroeth
    repeat with t in (tabs of w) -- loop over each tab
      if title of t starts with "Meet " then
        set (active tab index of w) to j -- set Meet tab to active
        set index of w to 1 -- set window with Meet tab to active

        -- these two lines are hackery to actually activate the window
        delay 0.5
        do shell script "open -a \"Google Chrome\""

        -- do Cmd+D in Google Chrome - Meet Window
        -- FIXME: doesn't work
        tell application "System Events" to tell process "Google Chrome" to keystroke "d" using command down

        return
      end if
      set j to j + 1
    end repeat
  end repeat
end tell
