#!/usr/bin/env bash

# Copy the contents of the last modified folder in ../mod/ to the default location for local Stellaris mods,
# excluding the cwtools rules cache (.cwtools/), which is not part of the published mod
rsync -a --exclude='.cwtools' mod/$(ls -tr $(dirname $0)/../mod/ | tail -1)/ ~/Documents/Paradox\ Interactive/Stellaris/mod/$(ls -tr $(dirname $0)/../mod/ | tail -1)/

echo "$(ls -tr $(dirname $0)/../mod/ | tail -1)/ copied to \"~/Documents/Paradox Interactive/Stellaris/mod/\""