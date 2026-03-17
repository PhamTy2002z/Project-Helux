# Code Standards

## File Naming Conventions

### Backend (Python)
- **snake_case** for all Python files
- Descriptive names indicating module purpose
- Examples: `activity_log.py`, `board_lifecycle.py`, `gateway_rpc.py`

### Frontend (TypeScript/React)
- **kebab-case** for directories: `board-groups/`, `custom-fields/`
- **PascalCase** for React components: `AuthProvider.tsx`, `BoardCard.tsx`
- **camelCase** for utilities and hooks: `useAuth.ts`, `apiClient.ts`
- Descriptive names that indicate component/module purpose

### Configuration Files
- Follow ecosystem conventions: `package.json`, `pyproject.toml`, `compose.yml`
- Use kebab-case for custom configs: `vitest.config.ts`, `orval.config.ts`

## Code Organization

### Backend Structure

#### Layered Architecture
```
API Layer (app/api/)
    ↓
Service Layer (app/services/)
    ↓
Model Layer (app/models/)
    ↓
Database
```

#### Module Responsibilities
- **API Routes** (`app/api/`): HTTP request/response handling, validation, auth
- **Services** (`app/services/`): Business logic, orchestration, external integrations
- **Models** (`app/models/`): Database schema definitions with SQLModel
- **Schemas** (`app/schemas/`): Pydantic request/response schemas
- **Core** (`app/core/`): Configuration, security, logging utilities

#### File Size Guidelines
- Target: < 200 lines per file for optimal maintainability
- Split large modules into logical sub-modules
- Extract reusable logic into utility functions
- Current exceptions: `agent.py` (69KB), `tasks.py` (86KB) - candidates for refactoring

### Frontend Structure

#### Route Groups Pattern
```
(app)/          # Protected routes requiring authentication
    ↓ Applied layout.tsx + middleware checks
(public)/       # Public routes without auth requirement
    ↓ Separate layout.tsx for unauthenticated UI
```

#### Atomic Design Pattern
```
atoms/          # Basic UI elements (buttons, inputs, labels)
    ↓
molecules/      # Simple component combinations (form fields, cards)
    ↓
organisms/      # Complex components (forms, tables, navigation)
    ↓
templates/      # Page layouts and structures
    ↓
pages/          # Full pages (app/ directory with Next.js App Router)
```

#### Component Organization
- **Domain Components**: Organized by feature (`components/agents/`, `components/boards/`)
- **UI Components**: Reusable primitives (`components/ui/`)
- **Shared Components**: Cross-cutting concerns (`components/providers/`, `components/tables/`)
- **Board overlay modules**: Keep scalable board-view logic in
  `src/lib/boards/*` and keep render primitives in focused organism components
  (`task-board-filter-bar.tsx`, `task-group-column-section.tsx`).
- **Board chat**: Multi-session CRUD in `src/lib/api/boards` + SSE streaming via `useSSEStream` hook
  with session-scoped filtering (`is_chat=true&chat_session_id=...`).

#### File Size Guidelines
- Target: < 200 lines per component file
- Extract complex logic into custom hooks
- Split large components into smaller sub-components
- Use composition over inheritance

## Coding Conventions

### Backend (Python)

#### Code Formatting
```python
# Use Black formatter with 100 character line length
# Configuration in pyproject.toml
[tool.black]
line-length = 100
target-version = ["py312"]
```

#### Import Organization
```python
# Standard library imports
import os
from typing import Optional

# Third-party imports
from fastapi import APIRouter, Depends
from sqlmodel import select

# Local imports
from app.core.config import settings
from app.models.boards import Board
from app.schemas.boards import BoardCreate, BoardResponse
```

#### Type Hints
```python
# Always use type hints for function signatures
async def get_board(
    board_id: int,
    session: AsyncSession = Depends(get_session)
) -> Board | None:
    result = await session.get(Board, board_id)
    return result
```

#### Async/Await
```python
# Use async/await for all database operations
async def create_board(board: BoardCreate, session: AsyncSession) -> Board:
    db_board = Board.model_validate(board)
    session.add(db_board)
    await session.commit()
    await session.refresh(db_board)
    return db_board
```

#### Error Handling
```python
# Use specific exceptions with meaningful messages
from fastapi import HTTPException, status

if not board:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Board with id {board_id} not found"
    )
```

#### Dependency Injection
```python
# Use FastAPI's Depends for database sessions and auth
from app.api.deps import get_session, get_current_user

@router.get("/boards/{board_id}")
async def get_board(
    board_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> BoardResponse:
    # Implementation
```

### Frontend (TypeScript/React)

#### Code Formatting
```typescript
// Use Prettier with default settings
// Configuration in .prettierrc or package.json
```

#### Import Organization
```typescript
// React imports
import { useState, useEffect } from 'react';

// Third-party imports
import { useQuery } from '@tanstack/react-query';
import { Button } from '@radix-ui/react-button';

// Local imports
import { getBoard } from '@/lib/api/boards';
import { BoardCard } from '@/components/boards/BoardCard';
import type { Board } from '@/types/board';
```

#### Component Structure
```typescript
// Use functional components with TypeScript
interface BoardCardProps {
  board: Board;
  onEdit?: (board: Board) => void;
  className?: string;
}

export function BoardCard({ board, onEdit, className }: BoardCardProps) {
  // Hooks at the top
  const [isEditing, setIsEditing] = useState(false);

  // Event handlers
  const handleEdit = () => {
    setIsEditing(true);
    onEdit?.(board);
  };

  // Render
  return (
    <div className={className}>
      {/* Component JSX */}
    </div>
  );
}
```

#### Custom Hooks
```typescript
// Extract reusable logic into custom hooks
export function useBoard(boardId: string) {
  return useQuery({
    queryKey: ['board', boardId],
    queryFn: () => getBoard({ boardId }),
    enabled: !!boardId,
  });
}

// SSE streaming hook with exponential backoff
export function useSSEStream(
  url: string,
  onMessage: (data: any) => void,
  enabled: boolean = true
) {
  // Consolidates stream connection, retry logic, and cleanup
  // Handles buffer parsing via parseSSEBuffer utility
  useEffect(() => {
    if (!enabled) return;
    // Connection and event handling logic
  }, [url, enabled]);
}
```

#### React Query Configuration
```typescript
// Use query-policy.ts for consistent React Query defaults
// Centralized configuration for staleTime, gcTime, retry behavior
import { getQueryPolicy } from '@/lib/query-policy';

export function useBoardChatMessages(boardId: string) {
  return useQuery({
    queryKey: ['board', boardId, 'chat-messages'],
    queryFn: () => getBoardChatMessages(boardId),
    ...getQueryPolicy('chat-messages'),  // Apply default policy
  });
}
```

#### Type Safety
```typescript
// Use strict TypeScript configuration
// Define types for all props and state
// Avoid 'any' type - use 'unknown' if type is truly unknown
```

## Testing Standards

### Backend Testing

#### Test Structure
```python
# tests/ mirrors app/ structure
# tests/api/test_boards.py tests app/api/boards.py

import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_create_board(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/api/boards",
        json={"name": "Test Board"},
        headers=auth_headers
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Test Board"
```

#### Coverage Requirements
- Target: 80% code coverage for backend
- Focus on business logic in services
- Test error cases and edge conditions
- Use fixtures for common test data

#### Test Naming
```python
# test_<function_name>_<scenario>_<expected_result>
def test_create_board_with_valid_data_returns_201():
    pass

def test_create_board_without_auth_returns_401():
    pass
```

### Frontend Testing

#### Unit Tests (Vitest)
```typescript
// tests/ directory for unit tests
import { render, screen } from '@testing-library/react';
import { BoardCard } from '@/components/boards/BoardCard';

describe('BoardCard', () => {
  it('renders board name', () => {
    const board = { id: '1', name: 'Test Board' };
    render(<BoardCard board={board} />);
    expect(screen.getByText('Test Board')).toBeInTheDocument();
  });
});
```

#### E2E Tests (Cypress)
```typescript
// cypress/e2e/ directory for E2E tests
describe('Board Management', () => {
  it('creates a new board', () => {
    cy.visit('/boards/new');
    cy.get('[data-testid="board-name"]').type('New Board');
    cy.get('[data-testid="submit"]').click();
    cy.url().should('include', '/boards/');
  });
});
```

#### Coverage Requirements
- Target: 70% code coverage for frontend
- Focus on component logic and user interactions
- Test accessibility with screen reader queries
- Use data-testid for stable selectors

## Documentation Standards

### Code Comments

#### When to Comment
- Complex algorithms or business logic
- Non-obvious workarounds or hacks
- Public API functions and classes
- Configuration and environment dependencies

#### When NOT to Comment
- Self-explanatory code
- Obvious variable names or function calls
- Redundant descriptions of what code does

#### Comment Style
```python
# Python: Use docstrings for functions and classes
def calculate_approval_chain(
    approval: Approval,
    task: Task
) -> list[ApprovalStep]:
    """
    Calculate the approval chain for a task based on approval policy.

    Args:
        approval: The approval policy to apply
        task: The task requiring approval

    Returns:
        List of approval steps in execution order

    Raises:
        ValueError: If approval policy is invalid
    """
    pass
```

```typescript
// TypeScript: Use JSDoc for exported functions
/**
 * Fetches a board by ID with related data
 * @param boardId - The board identifier
 * @param options - Query options for related data
 * @returns Promise resolving to board data
 * @throws {ApiError} If board not found or request fails
 */
export async function getBoard(
  boardId: string,
  options?: BoardQueryOptions
): Promise<Board> {
  // Implementation
}
```

### API Documentation

#### OpenAPI/Swagger
- All API endpoints documented in OpenAPI spec
- Include request/response schemas
- Document error responses
- Provide example requests

#### Endpoint Documentation
```python
@router.post("/boards", response_model=BoardResponse, status_code=201)
async def create_board(
    board: BoardCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
) -> Board:
    """
    Create a new board.

    Requires authentication. User must have permission to create boards
    in the specified organization.
    """
    pass
```

## Git Commit Standards

### Commit Message Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Commit Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **refactor**: Code refactoring without behavior change
- **test**: Adding or updating tests
- **chore**: Maintenance tasks, dependency updates
- **perf**: Performance improvements
- **style**: Code style changes (formatting, missing semicolons)

### Examples
```
feat(boards): add board cloning functionality

Implement board cloning with task duplication and member copying.
Includes API endpoint, service logic, and UI components.

Closes #123

---

fix(auth): resolve token refresh race condition

Add mutex lock to prevent concurrent token refresh requests
that were causing authentication failures.

Fixes #456

---

docs(api): update authentication flow documentation

Add diagrams for Clerk and local auth modes.
Clarify environment variable requirements.
```

### Commit Guidelines
- Keep subject line under 72 characters
- Use imperative mood ("add" not "added")
- Reference issue numbers in footer
- Include breaking changes in footer with "BREAKING CHANGE:"
- One logical change per commit

## Code Review Standards

### Review Checklist

#### Functionality
- [ ] Code implements requirements correctly
- [ ] Edge cases and error scenarios handled
- [ ] No obvious bugs or logic errors
- [ ] Performance considerations addressed

#### Code Quality
- [ ] Follows project coding conventions
- [ ] Appropriate use of abstractions
- [ ] No code duplication (DRY principle)
- [ ] Clear and descriptive naming

#### Testing
- [ ] Unit tests included for new functionality
- [ ] Tests cover edge cases and error scenarios
- [ ] Existing tests still pass
- [ ] Test coverage meets requirements

#### Security
- [ ] No hardcoded secrets or credentials
- [ ] Input validation implemented
- [ ] Authentication/authorization checked
- [ ] SQL injection and XSS prevention

#### Documentation
- [ ] Code comments for complex logic
- [ ] API documentation updated
- [ ] README updated if needed
- [ ] Migration guide for breaking changes

### Review Process
1. Automated checks pass (linting, tests, build)
2. Self-review by author before requesting review
3. At least one approval from team member
4. Address all review comments or provide rationale
5. Squash commits before merge if needed

## Security Standards

### Authentication
- Use environment variables for secrets
- Never commit `.env` files or credentials
- Rotate tokens and keys regularly
- Implement proper session management

### Input Validation
- Validate all user inputs on backend
- Use Pydantic schemas for request validation
- Sanitize inputs to prevent injection attacks
- Implement rate limiting for API endpoints

### Database Security
- Use parameterized queries (SQLModel handles this)
- Implement row-level security where needed
- Encrypt sensitive data at rest
- Regular database backups

### API Security
- Require authentication for protected endpoints
- Implement proper CORS configuration
- Use HTTPS in production
- Rate limit API requests

## Performance Standards

### Backend Performance
- Database queries optimized with indexes
- Use async operations for I/O-bound tasks
- Implement caching for frequently accessed data
- Pagination for large result sets

### Frontend Performance
- Code splitting with Next.js dynamic imports
- Keep heavy markdown parsing behind lazy boundaries (`LazyMarkdown`)
- Image optimization with Next.js Image component
- Lazy loading for below-the-fold content
- Minimize bundle size with tree shaking
- Keep list ordering invariants at data/hook layer, not in render loops
- Use `content-visibility` for long scroll regions where safe

#### Performance Budgets and Guardrails
- Route bundle metrics must be generated from Next build artifacts:
  - `cd frontend && pnpm build && pnpm perf:collect`
- Budget checks must pass before merge:
  - `cd frontend && pnpm perf:check`
- Query anti-pattern guard for high-traffic routes must pass:
  - `cd frontend && pnpm query-policy:check`
- Budget report artifacts are generated on each run:
  - `frontend/plans/performance/route-bundle-metrics.json`
  - `frontend/plans/performance/route-bundle-metrics.md`
- Initial hard thresholds (set on March 8, 2026):
  - Shared root main JS: `<= 430 KB`
  - `/`: `<= 1000 KB` initial JS
  - `/dashboard`: `<= 1250 KB` initial JS
  - `/boards`: `<= 1150 KB` initial JS
  - `/activity`: `<= 1250 KB` initial JS
- Latest validated run (March 15, 2026):
  - Shared root main JS: `400.8 KB`
  - `/`: `951.4 KB`
  - `/dashboard`: `1072.2 KB`
  - `/boards`: `1111.3 KB`
  - `/activity`: `1075.6 KB`

### Database Performance
- Add indexes for frequently queried columns
- Use database connection pooling
- Avoid N+1 queries with eager loading
- Monitor slow query log

## Service Integration Patterns

### Polar Billing Integration

**Webhook Pattern (Store-Then-Process)**:
- Webhook receiver validates Polar signature and stores raw event in `polar_webhook_events` table immediately (idempotent by `event_id`)
- Returns 200 to Polar without processing
- Worker (RQ job) loads stored event and routes to type-specific handler
- Handlers update `organization_plans` with Polar state (tier, effective_until, metadata)
- Concurrency safety via `SELECT FOR UPDATE` row-level lock on plan row

**Event Handlers**:
- `subscription.active` → tier=pro, effective_until=None, create billing history (idempotent by polar_subscription_id)
- `subscription.canceled` → effective_until=current_period_end
- `subscription.uncanceled` → tier=pro, effective_until=None
- `subscription.updated` → sync status and period end
- `subscription.past_due` → warn user, keep pro (payment failed)
- `subscription.revoked` → tier=trial_7d (immediate block)

**Plan Expiry Check (Critical Fix)**:
- `_plan_expired()` checks `plan.effective_until != null` for ALL tiers (pro/trial)
- Returns 402 `blocked_for_payment` when expired (metric: `saas.plan.expired.blocked`)
- Prevents pro tier orgs with expired period from using system

**Polar Client Config**:
- Pass `server="production"` for prod, `server="sandbox"` for dev
- Timeout: 10 seconds for API calls
- Idempotency: Polar customer_id reused for repeat checkouts (portal return_url support)

**Email Notifications**:
- Enqueue `billing_email_send` job on webhook confirmation (non-blocking)
- Types: upgrade_confirmed, payment_failed, trial_warning
- Use Resend provider with deterministic idempotency key per send attempt

### Email Service (Resend Provider)
- Use `email_sender.py` abstract interface with provider adapters
- `ResendSender` adapter: builds `resend.emails.send(...)` with deterministic idempotency key
- Queue pattern: Enqueue `organization_invite_email_send` job (non-blocking, best-effort)
- Retry policy: Existing RQ retry/backoff applies to retryable failures (network, transient provider errors)
- Admin resend endpoint: `POST /api/v1/organizations/me/invites/{invite_id}/resend` for manual retry

### Async Job Queue (RQ + Redis)
- Service layer enqueues jobs asynchronously
- Worker handler in `queue_worker.py` processes jobs with retry/backoff
- Use deterministic keys for idempotency (example: `f"{org_id}:{invite_id}:{attempt}"`)
- Return job ID immediately to API caller; job execution is eventual
- Use `SELECT FOR UPDATE` on rows being modified concurrently to prevent race conditions

## Compatibility Standards (OpenClaw Board Workflows)

- Follow `docs/reference/board-planning-overlay-contract-matrix.md` for non-negotiable runtime contracts.
- Treat compatibility-sensitive API/schema work as additive-first:
  - Keep existing route paths and default semantics stable.
  - Add optional fields/filters/endpoints, do not replace existing defaults.
- Preserve these locked contracts unless a formal breaking-change process is approved:
  - `TaskStatus`: `inbox`, `in_progress`, `review`, `done`
  - Agent task discovery route: `GET /api/v1/agent/boards/{board_id}/tasks`
  - Task event types: `task.created`, `task.updated`, `task.status_changed`, `task.comment`
- Any PR touching these contracts must include/update regression tests.

## Accessibility Standards

### Frontend Accessibility
- Semantic HTML elements
- ARIA labels for interactive elements
- Keyboard navigation support
- Color contrast meets WCAG AA standards
- Screen reader testing

### Component Accessibility
```typescript
// Use Radix UI primitives for built-in accessibility
import { Button } from '@radix-ui/react-button';

// Add ARIA labels for context
<Button aria-label="Delete board">
  <TrashIcon />
</Button>

// Ensure keyboard navigation
<div role="button" tabIndex={0} onKeyDown={handleKeyDown}>
  {/* Content */}
</div>
```

## Unresolved Questions

1. Should we enforce stricter line length limits (80 vs 100 characters)?
2. What is the policy for deprecating old API endpoints?
3. Should we require integration tests in addition to unit tests?
4. What is the process for introducing new dependencies?
5. Should we adopt conventional commits enforcement with git hooks?
