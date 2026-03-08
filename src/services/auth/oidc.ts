import { OidcError } from '../../utils/errors.ts';

interface OidcDiscoveryResponse {
  token_endpoint: string;
  [key: string]: unknown;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export class OidcTokenService {
  static async discoverTokenEndpoint(issuerUrl: string): Promise<string> {
    const url = issuerUrl.replace(/\/+$/, '') + '/.well-known/openid-configuration';
    const res = await fetch(url);
    if (!res.ok) {
      throw new OidcError(`OIDC discovery failed for ${issuerUrl}: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as OidcDiscoveryResponse;
    if (!data.token_endpoint) {
      throw new OidcError('No token_endpoint found in OIDC discovery response');
    }
    return data.token_endpoint;
  }

  static async fetchToken(
    tokenEndpoint: string,
    clientId: string,
    clientSecret: string,
    scopes: string,
  ): Promise<{ accessToken: string; expiresAt: number }> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: scopes,
    });

    const res = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      throw new OidcError(`Token fetch failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as TokenResponse;
    const expiresAt = Date.now() + data.expires_in * 1000;

    return { accessToken: data.access_token, expiresAt };
  }
}
