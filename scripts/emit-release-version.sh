#!/bin/sh
# Called by @semantic-release/exec (verifyReleaseCmd) with the next version, and
# only when there is a release. Records it as a GitHub Actions step output so
# release.yml can gate the image publish on "a version was actually cut".
set -eu

version="${1:?usage: emit-release-version.sh <version>}"

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  printf 'version=%s\n' "$version" >> "$GITHUB_OUTPUT"
fi
