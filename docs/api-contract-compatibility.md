# API Contract Compatibility

The backend-owned `contracts/openapi.json` file is the canonical consumer API
contract. Pull-request CI regenerates it from the NestJS application and fails
when the committed artifact is stale.

## Local checks

Install the pinned compatibility checker and add it to the current shell path:

```bash
OASDIFF_INSTALL_DIR="$PWD/.tools/oasdiff" bash scripts/openapi/install-oasdiff.sh
export PATH="$PWD/.tools/oasdiff:$PATH"
```

Then run:

```bash
npm run contract:generate
npm run contract:check
npm run contract:validate
npm run contract:compatibility:test
```

The installer accepts only the reviewed Linux x86_64 release archive and
verifies its pinned SHA-256 checksum before installing the binary. External
OpenAPI references remain disabled during validation and comparison.

## Pull-request policy

CI compares the pull-request contract with the exact target-branch commit and
writes an API compatibility report to the GitHub job summary. Additive changes
are reported but do not block the pull request. Removed operations or response
fields, narrowed request enums, and newly required request fields are treated
as breaking changes.

A breaking change is blocked unless both conditions are satisfied:

1. A maintainer applies the `api-breaking-change-approved` label.
2. A reviewer approves the latest pull-request commit and the pull request's
   current overall review decision remains approved.

Pushing another commit makes an older approval stale. The author must request a
new review. A later changes-requested review also invalidates an earlier
approval. The label documents the explicit compatibility decision in the pull
request timeline. The override does not weaken backend authorization and must
not be used to bypass consumer migration or deprecation planning.

## Release discipline

Backward-compatible additions can ship in a minor client release. Breaking
changes require a major client release and a migration/deprecation plan that
keeps deployed web and mobile clients operational during rollout. Contract
validation and compatibility checks run without production credentials or npm
dependency lifecycle scripts.
