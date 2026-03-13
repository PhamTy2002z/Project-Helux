/// <reference types="cypress" />

const APP_LOAD_TIMEOUT_MS = 30_000;
const DEFAULT_LOCAL_AUTH_TOKEN =
  "cypress-local-auth-token-0123456789-0123456789-0123456789x";

Cypress.Commands.add("waitForAppLoaded", () => {
  cy.get("[data-cy='route-loader']", {
    timeout: APP_LOAD_TIMEOUT_MS,
  }).should("not.exist");

  cy.get("[data-cy='global-loader']", {
    timeout: APP_LOAD_TIMEOUT_MS,
  }).should("have.attr", "aria-hidden", "true");
});

Cypress.Commands.add("loginWithLocalAuth", (token = DEFAULT_LOCAL_AUTH_TOKEN) => {
  cy.request({
    method: "POST",
    url: "/api/local-auth/session",
    body: { token },
    headers: { "Content-Type": "application/json" },
  });
});

Cypress.Commands.add("logoutLocalAuth", () => {
  cy.request({ method: "DELETE", url: "/api/local-auth/session" });
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Waits for route-level and global app loaders to disappear.
       */
      waitForAppLoaded(): Chainable<void>;

      /**
       * Establishes a local auth session via the session API (sets auth cookies).
       */
      loginWithLocalAuth(token?: string): Chainable<void>;

      /**
       * Destroys the local auth session via the session API (clears auth cookies).
       */
      logoutLocalAuth(): Chainable<void>;
    }
  }
}

export {};
