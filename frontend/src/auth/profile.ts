export enum AuthProfile {
  Dev = "dev",
  SelfHosted = "self_hosted",
  Saas = "saas",
}

export function isSaasAuthProfile(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_PROFILE === AuthProfile.Saas;
}
