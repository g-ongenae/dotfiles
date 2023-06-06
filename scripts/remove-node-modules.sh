#! /bin/bash

for BASE_PATH in '.' './*' ; do
  for FOLDER in ${BASE_PATH}/*/ ; do
    if [[ -d "${FOLDER}/node_modules" ]] ; then
      echo "Removing node modules of ${FOLDER}"
      rm -fr "${FOLDER}/node_modules"
    else
      echo "No node modules in ${FOLDER}, skipping."
    fi
  done
done
