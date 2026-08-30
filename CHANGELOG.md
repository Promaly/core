## [0.7.4](https://github.com/Promaly/core/compare/v0.7.3...v0.7.4) (2026-08-30)


### Bug Fixes

* **deps:** clear the image vulnerability scan ([c2782f1](https://github.com/Promaly/core/commit/c2782f1cd64607cfafabd64247d2c1d77f630d38))

## [0.7.3](https://github.com/Promaly/core/compare/v0.7.2...v0.7.3) (2026-08-29)


### Bug Fixes

* **db:** create the promaly_app role from the migrate step, not initdb.d ([bf51c76](https://github.com/Promaly/core/commit/bf51c76a56e6607fddc67c0aefa83aabde83248f))

## [0.7.2](https://github.com/Promaly/core/compare/v0.7.1...v0.7.2) (2026-08-29)


### Bug Fixes

* **api:** allow inline styles in the production CSP ([3f1f14a](https://github.com/Promaly/core/commit/3f1f14a0da8a5033e72b4d4b126b8933c7506fe0))

## [0.7.1](https://github.com/Promaly/core/compare/v0.7.0...v0.7.1) (2026-08-29)


### Bug Fixes

* **compose:** stop postgres/minio choking on an injected password var ([8e46cbc](https://github.com/Promaly/core/commit/8e46cbcb0d057ec6d5940e703dcb9007fe49f235))

# [0.7.0](https://github.com/Promaly/core/compare/v0.6.0...v0.7.0) (2026-08-29)


### Features

* **web:** wire the issue surface to the S3/S4 API [S6] ([266319f](https://github.com/Promaly/core/commit/266319fa1e4c1067c5d5800544a4631cb7bd08e1))

# [0.6.0](https://github.com/Promaly/core/compare/v0.5.0...v0.6.0) (2026-08-29)


### Bug Fixes

* **ci:** unblock the container build and e2e job for the web foundation ([9be21b0](https://github.com/Promaly/core/commit/9be21b03b399fc5a359d15c7a0a3c8673de1da8e))


### Features

* **phase-1:** add web foundation [S5] ([a9ebcd8](https://github.com/Promaly/core/commit/a9ebcd89b1f031e49c1ca79d8aa4ac3483d2a51d))
* **phase-1:** complete S5 auth bootstrap ([b9903ad](https://github.com/Promaly/core/commit/b9903ad8cbcfeafe7ff515b94a2576e5aa147fb1))
* **web:** rebuild the UI foundation on shadcn/ui + Tailwind v4 [S5] ([d99b482](https://github.com/Promaly/core/commit/d99b48225ac9dd7fb4115e5cf62d4fe9cb44f054))

# [0.5.0](https://github.com/Promaly/core/compare/v0.4.1...v0.5.0) (2026-08-29)


### Bug Fixes

* **phase-1:** address S3/S4 review findings [S3][S4] ([e6376ec](https://github.com/Promaly/core/commit/e6376ec0f23678011d1dead578ff8a793065744b))


### Features

* **phase-1:** add issues API [S4] ([5bfb838](https://github.com/Promaly/core/commit/5bfb83851dec13173cccf35b9caa1ed5357ac5bf))
* **phase-1:** add project management core [S3] ([658ca16](https://github.com/Promaly/core/commit/658ca162d1f3e3434ba59dac0940ae5129442dc8))

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
