#! /bin/bash

# shellcheck disable=SC2155,SC2002

USAGE="$(cat <<EOF
Little script to automatize release creation

Options:
     | --minor      Create a minor release
  -m | --major      Create a major release
  -h | --help       Ourput this help message
  -i | --install    Check/Install needed dependencies
EOF
)"

function get_new_version
{
  # Get current version
  local CURRENT_VERSION="$(cat package.json | jq '.version' | tr -d '"')"

  if [[ "${CURRENT_VERSION}" =~ ^([0-9]+)\.[0-9]+\..*$ ]] ; then
    local MAJOR_VERSION="${BASH_REMATCH[1]}"
  fi

  if [[ "${CURRENT_VERSION}" =~ ^[0-9]+\.([0-9]+)\..*$ ]] ; then
    local MINOR_VERSION="${BASH_REMATCH[1]}"
  fi

  if [[ -z "${MAJOR}" ]] ; then
    # Update to a new minor version
    BUMPED_VERSION="${MAJOR_VERSION}.$((MINOR_VERSION + 1)).0"
  else
    # Update to a new major version
    BUMPED_VERSION="$((MAJOR_VERSION + 1)).${MINOR_VERSION}.0"
  fi
}

function bump_app_version
{
  local FILENAME="${1}"
  local TMP_DIR="$(mktemp)"
  jq ".version = \"${BUMPED_VERSION}\"" "${FILENAME}" > "${TMP_DIR}" && mv "${TMP_DIR}" "${FILENAME}"

  if [ -f "./sonar-project.properties" ] ; then
    # Replace version in sonar project
    sed -i '' -E "s/sonar.projectVersion=.*/sonar.projectVersion=${BUMPED_VERSION}/" sonar-project.properties
  fi
}

function open_release
{
  # Go to develop
  git checkout develop

  # Update
  git pull origin develop

  # Get new version
  get_new_version

  # Create the release branch
  git checkout -b "release/${BUMPED_VERSION}"

  # Bump app version
  bump_app_version package.json
  bump_app_version package-lock.json

  # Commit
  git add package*
  git commit --message "Bump to version ${BUMPED_VERSION}"

  # Publish branch
  git push origin "release/${BUMPED_VERSION}"

  # Open PR on master and develop
  hub pull-request --base master --message "Release v${BUMPED_VERSION} - master"
  hub pull-request --base develop --message "Release v${BUMPED_VERSION} - develop"
}

function check_or_install_deps
{
  # Check needed dependencies are installed
  if [ -z "$(git --version 2>/dev/zero)" ] ; then git ; fi
  if [ -z "$(hub --version 2>/dev/zero)" ] ; then brew install hub ; fi
  if [ -z "$(jq --version 2>/dev/zero)" ] ; then brew install jq ; fi
}

function main
{
  if [ "$#" -eq "0" ] ; then
    open_release
  fi

  for OPT in "$@" ; do
    case "$OPT" in
      -i|--install) check_or_install_deps ;;
      -h|--help) echo "${USAGE}" ;;
      -m|--major) MAJOR=true ; open_release ;;
      --minor) open_release ;;
    esac
  done
}

main "$@"
