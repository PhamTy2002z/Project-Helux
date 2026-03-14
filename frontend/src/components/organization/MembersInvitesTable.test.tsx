import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  OrganizationInviteRead,
  OrganizationMemberRead,
} from "@/api/generated/model";
import { MembersInvitesTable } from "@/components/organization/MembersInvitesTable";

const invite: OrganizationInviteRead = {
  id: "invite-1",
  organization_id: "org-1",
  invited_email: "invitee@example.com",
  role: "member",
  all_boards_read: true,
  all_boards_write: false,
  token: "token-1",
  created_at: "2026-03-15T00:00:00Z",
  updated_at: "2026-03-15T00:00:00Z",
};

const member: OrganizationMemberRead = {
  id: "member-1",
  organization_id: "org-1",
  user_id: "user-1",
  role: "admin",
  all_boards_read: true,
  all_boards_write: true,
  created_at: "2026-03-15T00:00:00Z",
  updated_at: "2026-03-15T00:00:00Z",
  user: { id: "user-1", email: "admin@example.com", name: "Admin User" },
  board_access: [],
};

describe("MembersInvitesTable", () => {
  it("calls resend handler when clicking resend button", () => {
    const onResendInvite = vi.fn();

    render(
      <MembersInvitesTable
        members={[member]}
        invites={[invite]}
        isLoading={false}
        isAdmin={true}
        copiedInviteId={null}
        onManageAccess={vi.fn()}
        onCopyInvite={vi.fn()}
        onResendInvite={onResendInvite}
        onRevokeInvite={vi.fn()}
        isResending={false}
        isRevoking={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Resend email" }));

    expect(onResendInvite.mock.calls.length).toBe(1);
    expect(onResendInvite.mock.calls[0][0]).toBe("invite-1");
  });
});
