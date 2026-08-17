/**
 * Direct messages between two real accounts.
 *
 * Every rule in here is a server-side rule. The UI will hide what a user may
 * not do, but hiding is a courtesy: the checks that matter run before a row is
 * written, on identities taken from the JWT rather than from the request body.
 */

/** A connection is only usable once the other person has agreed to it. */
export type ConnectionStatus = 'pending' | 'accepted';

export interface UserConnection {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: ConnectionStatus;
  createdAt: Date;
  respondedAt: Date | null;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: Date;
}

/**
 * Why a send was refused.
 *
 * Named rather than boolean so the service can answer with the right status
 * and the tests can assert the reason instead of merely the failure — "it was
 * rejected" passes just as well when the rejection came from a typo in a user
 * id as when it came from the rule being enforced.
 */
export type SendRefusal =
  | 'not-connected'
  | 'blocked'
  | 'self'
  | 'rate-limited';

/**
 * The two people in a conversation, in a fixed order.
 *
 * A conversation is a property of an unordered pair, but every query needs a
 * deterministic key for it. Sorting the two ids means A→B and B→A produce the
 * same pair, so a lookup cannot miss half a thread depending on who asked.
 */
export function pairKey(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
