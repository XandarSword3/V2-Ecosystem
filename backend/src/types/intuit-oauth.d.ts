declare module 'intuit-oauth' {
  namespace OAuthClient {
    const scopes: Record<string, string>;
  }
  class OAuthClient {
    constructor(config: Record<string, any>);
    authorizeUri(params: Record<string, any>): string;
    createToken(url: string): Promise<{ getJson(): Record<string, any> }>;
    refresh(): Promise<{ getJson(): Record<string, any> }>;
    setToken(token: Record<string, any>): void;
    getToken(): Record<string, any>;
    [key: string]: any;
  }
  export default OAuthClient;
}
