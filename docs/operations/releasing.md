# Releasing Promaly

Promaly uses Conventional Commits. Pull requests are rejected when their commits do not conform to the configured convention. On `main` and `beta`, semantic-release determines the next semantic version from those commits, publishes GitHub release notes and creates the corresponding release tag. Published container images are signed with Cosign. The publish workflow attaches an SPDX SBOM attestation and blocks releases when Trivy finds HIGH or CRITICAL vulnerabilities (except documented `.trivyignore` entries).

## Release channels

- Stable: signed tags such as `v0.1.0`.
- Beta: signed prerelease tags such as `v0.1.0-beta.1`.
- Nightly: CI-generated immutable commit-SHA images; they are never documented as production defaults.

Allow semantic-release to create a version tag only after CI and a backup-restore verification have passed. The publish workflow creates one Promaly image for ARM64 and AMD64 at `ghcr.io/promaly/promaly:<version>`; Docker selects the correct architecture at deployment time.

Production Compose configuration must reference a release tag or image digest, never `latest`.

## Verification

Verify a published image with keyless Sigstore identity and its SBOM attestation:

```sh
cosign verify --certificate-identity-regexp='https://github.com/promaly/core/.github/workflows/publish-image.yml@refs/tags/.*' --certificate-oidc-issuer=https://token.actions.githubusercontent.com ghcr.io/promaly/promaly:v0.1.0
cosign verify-attestation --type spdxjson --certificate-identity-regexp='https://github.com/promaly/core/.github/workflows/publish-image.yml@refs/tags/.*' --certificate-oidc-issuer=https://token.actions.githubusercontent.com ghcr.io/promaly/promaly:v0.1.0
```
