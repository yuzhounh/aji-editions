# AJI core

Version 0.1.0 contains the pure ISSN and JCR release-year rules used by both AJI applications. It has no browser, Firebase, or dataset dependencies.

The canonical copy is maintained in `aji-editions/vendor/aji-core/`. Each application vendors the same version so standalone clones and CI do not depend on another checkout or an unpublished registry package.

To update a consumer from a reviewed source directory:

```bash
npm run sync:core -- ../aji-editions/vendor/aji-core
npm install --package-lock-only
npm run check
```

Keep both copies and their contract tests aligned when changing a rule. Do not change persisted favorites IDs without an explicit migration. `getLegacyFavoriteId` intentionally preserves the single-edition application's first-part IDs, including whitespace; `getPrimaryIssn` uses the normalized print ISSN with an electronic fallback.
