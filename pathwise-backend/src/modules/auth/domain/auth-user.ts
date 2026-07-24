/**
 * The authenticated principal attached to a request by the JWT guard.
 * Deliberately minimal — just what downstream handlers need to identify the
 * caller. The full user record is loaded on demand via UsersService.
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
}
