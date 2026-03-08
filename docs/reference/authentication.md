# Authentication

Mission Control authentication is controlled by two inputs:
`AUTH_PROFILE` and `AUTH_MODE`. You use `AUTH_PROFILE` to define deployment
strictness, and you use `AUTH_MODE` to select the auth provider.

## Auth profile and mode matrix

Use this matrix to choose a safe configuration:

- `AUTH_PROFILE=dev`: contributor workflow profile. You can run `AUTH_MODE=local`
  or `AUTH_MODE=clerk`.
- `AUTH_PROFILE=self_hosted`: self-managed deployment profile. You can run
  `AUTH_MODE=local` or `AUTH_MODE=clerk`.
- `AUTH_PROFILE=saas`: internet-facing SaaS profile. You must run
  `AUTH_MODE=clerk`. Local fallback is disabled.

## Local mode

Use local mode when you operate self-hosted or development environments with a
shared bearer token.

Backend:

- `AUTH_MODE=local`
- `AUTH_PROFILE=dev` or `AUTH_PROFILE=self_hosted`
- `LOCAL_AUTH_TOKEN=<strong-random-token>`

Frontend:

- `NEXT_PUBLIC_AUTH_MODE=local`
- `NEXT_PUBLIC_AUTH_PROFILE=dev` or `NEXT_PUBLIC_AUTH_PROFILE=self_hosted`
- Users enter the local token in the local auth login form.

## Clerk mode

Use Clerk mode when you need user-scoped JWT authentication.

Backend:

- `AUTH_MODE=clerk`
- `AUTH_PROFILE=dev`, `self_hosted`, or `saas`
- `CLERK_SECRET_KEY=<secret>`

Frontend:

- `NEXT_PUBLIC_AUTH_MODE=clerk`
- `NEXT_PUBLIC_AUTH_PROFILE=dev`, `self_hosted`, or `saas`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<key>`
