# [0.16.0](https://github.com/Promaly/core/compare/v0.15.0...v0.16.0) (2026-09-03)


### Bug Fixes

* **worker:** move drizzle-orm to production dependencies ([d15073e](https://github.com/Promaly/core/commit/d15073ee2c4639c3005bec37ea165221987ad617))


### Features

* **issues:** wave h — due dates ([#34](https://github.com/Promaly/core/issues/34)) ([a2ac53e](https://github.com/Promaly/core/commit/a2ac53e319e0fd91845facba0bcf4fc396af144a))
* **web:** wave g — add notification preference hooks to admin data ([2a5dc70](https://github.com/Promaly/core/commit/2a5dc701dd54040e437bf2503637bf33a9e244d7))

# [0.15.0](https://github.com/Promaly/core/compare/v0.14.0...v0.15.0) (2026-09-02)


### Bug Fixes

* **api:** add broadcaster to buildTestApp fixture ([61bc824](https://github.com/Promaly/core/commit/61bc824d4ad4dbfd2ceb499f365200f0c8c3fe2a))


### Features

* **web,api:** wave f — sse live updates, keyboard shortcuts, onboarding polish ([4e1be7c](https://github.com/Promaly/core/commit/4e1be7c85a6c3908ee7f724b9f9ad668a14ab126))

# [0.14.0](https://github.com/Promaly/core/compare/v0.13.0...v0.14.0) (2026-09-02)


### Features

* **web:** wave e — filter bar, group-by selector, saved views ([3262678](https://github.com/Promaly/core/commit/3262678cd52a04c053c6484e6c6d606ae0c390c8))

# [0.13.0](https://github.com/Promaly/core/compare/v0.12.0...v0.13.0) (2026-09-02)


### Bug Fixes

* **api:** use top-level import type for notificationpreferences ([c5bceea](https://github.com/Promaly/core/commit/c5bceea2b8b85cf94b889f664539348b15c919ce))
* **web:** apply prettier formatting to admin screens ([b112f09](https://github.com/Promaly/core/commit/b112f09071ff31f1e43bf6da3a7f7589c1ce0483))
* **web:** apply prettier formatting to wave c screens ([0215949](https://github.com/Promaly/core/commit/0215949940970a9aa22c5a2ca5e73aeb3ff62d15))
* **web:** restore command palette placeholder to match e2e test expectation ([4ed363a](https://github.com/Promaly/core/commit/4ed363a8790cadcf0383844affd14f0b916bc7eb))
* **web:** restore command palette placeholder to match e2e test expectation ([27807e6](https://github.com/Promaly/core/commit/27807e6260690cbef117e5143f9bb51963022753))


### Features

* **api:** wave a — comments, timeline, notifications, saved views ([592e475](https://github.com/Promaly/core/commit/592e475ee035d265273297ff0ff51dff6adc66e7))
* **web:** implement wave b admin screens ([9393a73](https://github.com/Promaly/core/commit/9393a733481fd24deb2151bf2f15883cc219a199))
* **web:** wave c — activity feed, comments, notifications, relations ([03c1136](https://github.com/Promaly/core/commit/03c1136632f6ae1257e4ea781cbd12c55f830bac))
* **web:** wave d — full new-issue dialog, inline title edit, sub-issue create, add relation ([b3bc92f](https://github.com/Promaly/core/commit/b3bc92f5f2746c63153c04ed4a61d6e02d91ddd5))

# [0.12.0](https://github.com/Promaly/core/compare/v0.11.0...v0.12.0) (2026-09-01)


### Features

* **web:** add admin shell with RequireAdmin guard and AdminLayout ([#23](https://github.com/Promaly/core/issues/23)) ([f8c9c91](https://github.com/Promaly/core/commit/f8c9c9123fc53f46cece5039b2df40270594401c))
* **web:** expand workspaceApi with full client surface ([#22](https://github.com/Promaly/core/issues/22)) ([984bf12](https://github.com/Promaly/core/commit/984bf123facd253f4bf83634addaabe8e42b28b9))

# [0.11.0](https://github.com/Promaly/core/compare/v0.10.0...v0.11.0) (2026-08-31)


### Features

* **ui:** add table, switch, radio-group, and combobox components ([#21](https://github.com/Promaly/core/issues/21)) ([c173be6](https://github.com/Promaly/core/commit/c173be606e8ee640055a353b1d46aa8bf4c475ff))

# [0.10.0](https://github.com/Promaly/core/compare/v0.9.0...v0.10.0) (2026-08-31)


### Features

* **worker:** notification.fanout handler + domain computeRecipients/shouldNotify ([#20](https://github.com/Promaly/core/issues/20)) ([1967ae9](https://github.com/Promaly/core/commit/1967ae9bf0c9336197fc12c2948e547a60996624))

# [0.9.0](https://github.com/Promaly/core/compare/v0.8.0...v0.9.0) (2026-08-31)


### Features

* **storage:** S3 client + config + MinIO svcacct ([#19](https://github.com/Promaly/core/issues/19)) ([cd9d4c0](https://github.com/Promaly/core/commit/cd9d4c0be83af4e9df022f67c353bbf12bc3b585))

# [0.8.0](https://github.com/Promaly/core/compare/v0.7.4...v0.8.0) (2026-08-30)


### Features

* **contracts:** schemas + capabilities for comments, notifications, saved views ([7e60053](https://github.com/Promaly/core/commit/7e600539fd50dd88b1b1f94ea1dae0639e8335b8))

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
