export default {
  branches: ['main', { name: 'beta', prerelease: true }],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        // Stay on the 0.x line while the API is still unstable: a breaking
        // change bumps the minor, not the major. Promote to 1.0.0 by hand
        // (a manual tag + release) once Core is declared stable.
        releaseRules: [{ breaking: true, release: 'minor' }],
      },
    ],
    '@semantic-release/release-notes-generator',
    [
      // Expose the version to the release workflow so it can invoke the image
      // publish — a GITHUB_TOKEN-pushed tag does not trigger `on: push`. This
      // step runs only when a release is happening.
      '@semantic-release/exec',
      {
        verifyReleaseCmd: './scripts/emit-release-version.sh "${nextRelease.version}"',
      },
    ],
    '@semantic-release/changelog',
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json'],
        message: 'chore(release): ${nextRelease.version} [skip ci]',
      },
    ],
    '@semantic-release/github',
  ],
};
