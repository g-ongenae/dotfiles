# shellcheck shell=sh
# Debian server environment, sourced from shell/common/init.sh.

# Never invoke GUI editors/browsers from an SSH-only server profile.
export EDITOR=vim VISUAL=vim

# Headless automation uses the distro Chromium, not a Puppeteer download.
# Puppeteer Core needs this path passed explicitly as `executablePath`.
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# Leave sandboxing enabled. Run Chromium/Puppeteer as a non-root user.

# Succeed unconditionally, so sourcing this file never looks like a failure.
:
