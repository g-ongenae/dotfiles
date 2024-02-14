#! /bin/bash

BASEDIR="$(PWD)"

echo "{" >> "${BASEDIR}/tags.json"

SUM=0
START_YEAR=2024
END_YEAR="$((START_YEAR + 1))"
echo "Counting tags from ${START_YEAR} to ${END_YEAR}..."

for DIR in ./* ; do
  if [ -d "${BASEDIR}/${DIR:2}" ]; then
    cd "${BASEDIR}/${DIR:2}" || exit 1

    RESULT=$(git logs --tags --simplify-by-decoration --pretty="format:%ai %d" --after="${START_YEAR}-01-01" --before="${END_YEAR}-01-01" \
        | grep -o "tag: [^,)]*" \
        | wc -l)

    # Trim leading whitespace
    RESULT="$(echo -e "${RESULT}" | sed -e 's/^[[:space:]]*//')"
    echo "  \"${DIR:2}\": ${RESULT}," >> "${BASEDIR}/tags.json"
    SUM=$((SUM + RESULT))

    cd .. || exit 1
  fi
done

echo "  \"SUM\": ${SUM}" >> "${BASEDIR}/tags.json"
echo "}" >> "${BASEDIR}/tags.json"
