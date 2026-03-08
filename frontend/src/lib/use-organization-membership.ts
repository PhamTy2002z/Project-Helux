import { ApiError } from "@/api/mutator";
import {
  type getMyMembershipApiV1OrganizationsMeMemberGetResponse,
  useGetMyMembershipApiV1OrganizationsMeMemberGet,
} from "@/api/generated/organizations/organizations";
import { withQueryPolicy } from "@/lib/query-policy";

export const isOrganizationAdminRole = (
  role: string | null | undefined,
): boolean => role === "owner" || role === "admin";

export function useOrganizationMembership(
  isSignedIn: boolean | null | undefined,
) {
  const membershipQuery = useGetMyMembershipApiV1OrganizationsMeMemberGet<
    getMyMembershipApiV1OrganizationsMeMemberGetResponse,
    ApiError
  >({
    query: {
      ...withQueryPolicy("interactive"),
      enabled: Boolean(isSignedIn),
      retry: false,
    },
  });

  const member =
    membershipQuery.data?.status === 200 ? membershipQuery.data.data : null;

  return {
    membershipQuery,
    member,
    isAdmin: isOrganizationAdminRole(member?.role),
  };
}
