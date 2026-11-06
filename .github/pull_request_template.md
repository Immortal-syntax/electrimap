## Description

<!-- Provide a concise explanation of the changes made and the motivation behind them. -->

## Type of Change

- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Refactoring (code improvements without behavioral changes)
- [ ] Documentation update
- [ ] Test addition or enhancement

## Engineering Principles Compliance

- [ ] **Epistemic Honesty**: No proxy estimation is labeled as ground-truth verified without field survey validation.
- [ ] **Four Electrification Dimensions**: Strict separation maintained between connection coverage, availability, supply quality, and infrastructure adequacy.
- [ ] **No Fabricated Infrastructure or Unit Rates**: No phantom lines, transformers, or costs are introduced.
- [ ] **Domain Purity**: Pure mathematical algorithms in `backend/app/domain/` have zero DB/HTTP/storage dependencies.
- [ ] **Explicit Units**: Physical quantities explicitly include unit suffixes (`_m`, `_kva`, `_v`, `_inr`).

## Verification Checklist

### Backend Quality Gates
- [ ] `ruff check app tests` passed
- [ ] `mypy app tests` passed (0 errors)
- [ ] `pytest -v` passed

### Frontend Quality Gates
- [ ] `npm run lint` passed (0 warnings)
- [ ] `npm run typecheck` passed (0 errors)
- [ ] `npm run test` passed
- [ ] `npm run build` passed

## Related Issues

<!-- Link any related issues: e.g. Fixes #12 -->
