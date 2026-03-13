describe("/activity page", () => {
  it("signed-out user sees an auth prompt", () => {
    cy.visit("/activity");
    cy.contains(/local authentication|sign in to flowgrid/i, {
      timeout: 20_000,
    }).should("be.visible");
  });
});
