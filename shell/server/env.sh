# Never invoke GUI editors/browsers from an SSH-only server profile.
export EDITOR=vim VISUAL=vim
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# Leave sandboxing enabled. Run Chromium/Puppeteer as a non-root user.
:
