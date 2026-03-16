---
title: Code Review - Onboarding Wizard Redesign
date: 2026-03-16
reviewer: code-reviewer
scope: onboarding-wizard.tsx, onboarding/page.tsx
---

## Code Review Summary

### Scope
- Files: `onboarding-wizard.tsx` (407 LOC), `onboarding/page.tsx` (118 LOC)
- Supporting: `lib/onboarding.ts`, `use-onboarding-guard.ts`, `getting-started-checklist.tsx`
- Focus: Full rewrite review (stepper wizard replacing 2x2 grid)

### Overall Assessment

Solid redesign. Clean component decomposition, good TypeScript usage, proper error handling. The stepper pattern is a clear UX improvement over the 2x2 grid. A few medium-priority issues around accessibility, edge cases, and a potential race condition.

---

### Critical Issues

None found.

---

### High Priority

#### 1. Accessibility: Card selection missing ARIA semantics

`UseCaseStepContent` (line 158-207) uses plain `<button>` elements for single-select card behavior. Screen readers won't announce selection state.

**Fix:** Add `role="radiogroup"` on container, `role="radio"` + `aria-checked` on each card.

```tsx
<div className="mt-5 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Select use case">
  {USE_CASE_OPTIONS.map((option) => {
    const selected = value === option.value;
    return (
      <button
        role="radio"
        aria-checked={selected}
        // ... rest
      >
```

#### 2. Accessibility: Progress bar has no accessible label

`StepProgressBar` (line 84-108) is purely visual. Screen readers get no information about progress.

**Fix:** Add `role="progressbar"` or use `aria-label` on the container.

```tsx
<div
  className="flex items-center gap-1.5"
  role="group"
  aria-label={`Onboarding progress: step ${currentIndex + 1} of ${steps.length}`}
>
```

#### 3. `trackViewedMutation` in useEffect dependency array causes infinite re-renders risk

Line 268: `trackViewedMutation` is a new object every render (from `useMutation`). The `lastViewedStepRef` guard prevents duplicate API calls, but the effect re-runs on every render unnecessarily.

**Fix:** Remove `trackViewedMutation` from deps, use a ref to hold the mutate function, or wrap in useCallback. The ref guard makes this safe in practice, but it's wasteful.

```tsx
const trackViewedRef = useRef(trackViewedMutation.mutate);
trackViewedRef.current = trackViewedMutation.mutate;

useEffect(() => {
  if (!currentStep || progress?.completed) return;
  if (lastViewedStepRef.current === currentStep.key) return;
  lastViewedStepRef.current = currentStep.key;
  trackViewedRef.current({ step: currentStep.key });
}, [currentStep, progress?.completed]);
```

---

### Medium Priority

#### 4. Skip-all: sequential loop fails silently on partial completion

`handleConfirmSkip` in `page.tsx` (line 37-41) loops through pending steps sequentially. If step 2 of 3 fails, steps 1 is already skipped but the user sees an error. The onboarding state is now inconsistent (partially skipped).

**Fix:** Consider a batch skip API endpoint, or at minimum, re-fetch progress after partial failure so the wizard reflects actual state.

#### 5. `completedCount` counts non-pending as completed (includes skipped)

Line 274: `progress?.steps.filter((s) => s.status !== "pending").length` counts both "completed" and "skipped" steps. The "X/4 done" label in the header may mislead users -- showing "3/4 done" when 2 were skipped and 1 was completed.

**Suggestion:** Either rename label to "3/4 finished" or differentiate: "1 done, 2 skipped".

#### 6. Mobile layout: 2-column card grid may be cramped on small screens

`UseCaseStepContent` uses `grid-cols-2` unconditionally (line 168). On narrow viewports (< 375px), 4-character labels like "Ops Management" fit, but the touch target may be tight.

**Fix:** Add responsive breakpoint: `grid-cols-1 sm:grid-cols-2`.

#### 7. `Link` wrapping `Button` in `ActionStepContent` -- nested interactive elements

Line 218-224: `<Link>` wraps `<Button>`. Both are interactive. This produces nested `<a>` > `<button>` in the DOM, which is invalid HTML and causes accessibility issues.

**Fix:** Use `Button` as `asChild` with Link, or use `router.push` on button click instead.

```tsx
<Link href={step.href}>
  <Button variant="outline" asChild>
    ...
  </Button>
</Link>
// Better:
<Button variant="outline" asChild>
  <Link href={step.href}>
    {step.actionLabel}
    <ArrowRight className="ml-2 h-4 w-4" />
  </Link>
</Button>
```

Same issue in `OnboardingComplete` (line 130-135).

#### 8. `localError` not cleared when user selects a use case

If user triggers "Pick a use case to continue" error (line 298-299), then selects a card, the error stays visible until they click Continue again.

**Fix:** Clear error in `onChange`:
```tsx
const handleUseCaseChange = (v: string) => {
  setUseCase(v);
  setLocalError(null);
};
```

---

### Low Priority

#### 9. `onGoToDashboard` prop on `OnboardingComplete` never passed

Line 308: `<OnboardingComplete />` is rendered without `onGoToDashboard`, so the Link fallback always fires. The prop exists but is unused in practice. Consider removing the callback branch or wiring it up.

#### 10. Hardcoded color values instead of theme tokens

Colors like `bg-emerald-500`, `bg-blue-500`, `bg-slate-200` are Tailwind defaults. If the project uses a custom theme (primary/accent tokens), these should use theme classes for consistency.

#### 11. `STEPS` config duplicates link info from `getting-started-checklist.tsx`

`STEP_LINKS` in `getting-started-checklist.tsx` and `STEPS[].href` in the wizard define the same URL mapping independently. If a route changes, both must update.

**Suggestion:** Extract shared step config to `lib/onboarding.ts` or a shared constants file.

---

### Edge Cases Found by Scout

1. **Server returns step key not in STEPS array**: `currentStepIndex` falls to `idx >= 0 ? idx : 0` (line 250), which resets to step 0. If server adds a 5th step the client doesn't know, user gets stuck on step 1 forever.
2. **Empty `progress.steps` array**: `completedCount` = 0, `first_pending_step` = null, `find` returns undefined -> `currentStepIndex` = `STEPS.length` -> shows completion screen even though nothing was completed. Guard needed.
3. **Double-click on Continue**: `isBusy` flag prevents UI interaction, but `handleContinue` doesn't early-return on `isBusy`. If mutation is slow, rapid clicks could fire multiple mutations before `isPending` flips.
4. **Browser back after completion**: User completes onboarding, goes to dashboard, presses back. They see the completion screen with "Go to dashboard" again. Not harmful but slightly confusing.

---

### Positive Observations

- Clean component decomposition (StepProgressBar, UseCaseStepContent, ActionStepContent, OnboardingComplete)
- Good separation of concerns: page handles dialog/routing, wizard handles step logic
- Proper optimistic cache update via `onSuccess` in mutation
- Error handling covers both `Error` instances and unknown throws
- `lastViewedStepRef` prevents duplicate tracking calls -- good pattern
- Skip confirmation dialog prevents accidental skip-all
- File is 407 lines -- close to 200-line guideline but acceptable for a self-contained wizard

---

### Recommended Actions (prioritized)

1. Add ARIA roles to card selection (`role="radiogroup"`, `role="radio"`, `aria-checked`)
2. Fix nested interactive elements (`Link` > `Button`)
3. Clear validation error when use case is selected
4. Add responsive `grid-cols-1 sm:grid-cols-2` for mobile
5. Add double-click guard in `handleContinue`
6. Add accessible label to progress bar
7. Extract shared step URL config to avoid duplication
8. Handle empty steps array edge case

### Metrics

- Type Coverage: 100% (no `any`, all props typed)
- Test Coverage: No component tests found for wizard (only `onboarding.test.ts` for lib)
- Linting Issues: 0
- TypeScript Errors: 0

### Unresolved Questions

- Is there a plan to add component tests for the wizard?
- Should the wizard support going back to a previous step?
- Is the completion screen intended to show permanently on revisit, or should it redirect to dashboard?
