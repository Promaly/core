## [0.4.1](https://github.com/Promaly/core/compare/v0.4.0...v0.4.1) (2026-08-29)


### Bug Fixes

* **db:** detect unique violations through Drizzle's error wrapper ([e014816](https://github.com/Promaly/core/commit/e0148161c920a3316fa267c9590e63181270b980))

# [0.4.0](https://github.com/Promaly/core/compare/v0.3.0...v0.4.0) (2026-08-29)


### Bug Fixes

* **phase-1:** close S2 auth gaps, fix rate limiting, add route tests [S2] ([f2abbed](https://github.com/Promaly/core/commit/f2abbed462f6291109fd9a11cc24c21f2297aab2))


### Features

* **phase-1:** implement identity and tenancy [S2] ([7f09cdf](https://github.com/Promaly/core/commit/7f09cdf141b28b2c87b6adad07922ca40be27008))

# [0.3.0](https://github.com/Promaly/core/compare/v0.2.0...v0.3.0) (2026-08-29)


### Bug Fixes

* **phase-1:** wire the authz spine into the API and harden scoping [S1] ([0656484](https://github.com/Promaly/core/commit/06564847031e423e82d4e7d60ac06893b6a29e20))


### Features

* **phase-1:** add authorization spine [S1] ([5e49b4c](https://github.com/Promaly/core/commit/5e49b4c4e386c0a3f4e7d3829df99e2c6373484e))

# [0.2.0](https://github.com/Promaly/core/compare/v0.1.0...v0.2.0) (2026-08-29)


### Bug Fixes

* **phase-1:** resolve S0 review findings and add integration tests [S0] ([76f6514](https://github.com/Promaly/core/commit/76f6514dd3fcbf02610dff7365fd0ea980c8cf3d))


### Features

* **phase-1:** add domain schema and outbox runtime [S0] ([9467e26](https://github.com/Promaly/core/commit/9467e26d1f806b7970e82ca29dfdd17440c097af))

# 0.1.0 (2026-08-29)


### Bug Fixes

* address Phase 0 hardening review findings ([7f1ac41](https://github.com/Promaly/core/commit/7f1ac41206970414323cdd289795cbe9a159a6df))
* **api:** redact metrics authorization logs ([b2b789c](https://github.com/Promaly/core/commit/b2b789c06a24ded947778795429808447cd879b8))
* **deploy:** escape subshell in worker healthcheck ([4bb2f6d](https://github.com/Promaly/core/commit/4bb2f6ddde2974e1d00a7546ad39732b462903de))
* **docker:** move image tag hint off the FROM line ([391e334](https://github.com/Promaly/core/commit/391e334c76c44cead278c514bf06e879c72f23b3))
* **release:** attach SBOM to the semantic release ([96ab43e](https://github.com/Promaly/core/commit/96ab43e59ec9471c54a4d81028d1e6a5fa4a5e99))


### Features

* **api:** harden security and observability defaults ([fea8d7a](https://github.com/Promaly/core/commit/fea8d7aa20fc4639fa54b8278bd0f4d542abd25c))
