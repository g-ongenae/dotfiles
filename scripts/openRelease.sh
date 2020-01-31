#! /bin/bash

# shellcheck disable=SC2155,SC2002,SC2162

USAGE="\
Little script to automatize release creation

Options:
     |              Open a release with a prompt for the version
  -p | --patch      Create a patch release
  -m | --minor      Create a minor release
  -M | --major      Create a major release
  -h | --help       Ourput this help message
  -i | --install    Check/Install needed dependencies\
";

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

  if [[ "${CURRENT_VERSION}" =~ ^[0-9]+\.[0-9]+\.([0-9]+).*$ ]] ; then
    local PATCH_VERSION="${BASH_REMATCH[1]}"
  fi

  # Get the updated version
  if [[ -n "${MAJOR}" ]] ; then
    # Update to a new major version
    BUMPED_VERSION="$((MAJOR_VERSION + 1)).${MINOR_VERSION}.0"
  elif [[ -n "${MINOR}" ]] ; then
    # Update to a new minor version
    BUMPED_VERSION="${MAJOR_VERSION}.$((MINOR_VERSION + 1)).0"
  elif [[ -n "${PATCH}" ]] ; then
    # Update to a new major version
    BUMPED_VERSION="${MAJOR_VERSION}.${MINOR_VERSION}.$((PATCH_VERSION + 1))"
  else
    read -p "What version would you like to bump your app? (should be a valid format) " BUMPED_VERSION
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

  # Replace version in OpenAPI
  OPEN_API_FILE="$(find . -name openapi.yaml -not -path "./node_modules/*")"
  if [ -f "${OPEN_API_FILE}" ] ; then
    sed -i '' -E "s/version:.*/version: ${BUMPED_VERSION}/" "${OPEN_API_FILE}"
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
  git add sonar-project.properties
  git add "${OPEN_API_FILE}"
  git commit --message "Bump to version ${BUMPED_VERSION}"

  local REMOTE_URL="$(git remote get-url origin)"
  read -p "Do you want to push to ${REMOTE_URL} and open PRs? Press ^C to escape. "

  # Publish branch
  git push origin "release/${BUMPED_VERSION}"

  # Open PR on master and develop
  local MASTER_PR_ID="$(hub pull-request --base master --message "Release v${BUMPED_VERSION} - master")"
  local PR_MESSAGE="$(echo -e "Release v${BUMPED_VERSION} - develop\n\nFollowing ${MASTER_PR_ID}")"
  hub pull-request --base develop --message "${PR_MESSAGE}"
  echo "Do not forget to update the CHANGELOG and PR description of master (${MASTER_PR_ID})"
}

function check_or_install_deps
{
  # Check needed dependencies are installed
  if [ -z "$(command -v git)" ] ; then git ; fi
  if [ -z "$(command -v hub)" ] ; then brew install hub ; fi
  if [ -z "$(command -v jq)" ] ; then brew install jq ; fi
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
      -M|--major) MAJOR=true open_release ;;
      -m|--minor) MINOR=true open_release ;;
      -p|--patch) PATCH=true open_release ;;
    esac
  done
}

main "$@"
