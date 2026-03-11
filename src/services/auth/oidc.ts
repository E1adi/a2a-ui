/**
 * OIDC utilities.
 * Discovery is now handled by the proxy server during start-auth.
 * This module is kept minimal for any client-side OIDC needs.
 */

import { OidcError } from '../../utils/errors.ts';

interface OidcDiscoveryResponse {
  authorization_endpoint: string;
  token_endpoint: string;
  [key: string]: unknown;
}

export class OidcTokenService {
  static async discover(issuerUrl: string): Promise<OidcDiscoveryResponse> {
    const url = issuerUrl.replace(/\/+$/, '') + '/.well-known/openid-configuration';
    const res = await fetch(url);
    if (!res.ok) {
      throw new OidcError(`OIDC discovery failed for ${issuerUrl}: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as OidcDiscoveryResponse;
    if (!data.authorization_endpoint || !data.token_endpoint) {
      throw new OidcError('Missing authorization_endpoint or token_endpoint in OIDC discovery response');
    }
    return data;
  }
}
