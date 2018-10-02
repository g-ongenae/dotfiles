# Alias

# This is only to use github/hub functionnalities over Git
# Website => https://hub.github.com/
# Source => https://github.com/github/hub
if ! [ "$(hub --version)" == "" ]; then
  alias git="hub"
fi

## What a pain
alias g="git"
