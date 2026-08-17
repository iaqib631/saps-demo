"use client";

/**
 * Session store for delegations created and revoked inside the HQ portal.
 *
 * WHY IT EXISTS. Without it the demo has a hole in exactly the place it can
 * least afford one: the console flags that a node has no administrator, you go
 * and delegate one, you come back, and the console still says nobody
 * administers it — because each screen would be reading the fixture through its
 * own local `useState`. The finding and the fix have to be the same fact.
 *
 * It is a provider on app/(hq)/layout.tsx rather than a global store because
 * that is exactly its lifetime: the HQ portal's five screens, this browser
 * session. Nothing is persisted. There is no backend, and pretending otherwise
 * — writing to localStorage so it survives a reload — would make a record look
 * durable when nothing behind it is. `airvault.site-scope` is persisted because
 * it is a UI preference; a grant is not.
 *
 * REVOCATION IS AN OVERLAY, NOT A DELETE. Withdrawing a delegation sets
 * IsActive false and stamps UpdatedBy / UpdatedDate, keeping the row. That is
 * the whole point of carrying the six CMTS audit columns: an authority that
 * disappears without trace cannot be audited, and "who used to be able to do
 * this" is a question an auditor asks more often than "who can".
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { DEMO_NOW, SITES, type SiteScope } from "@/lib/domain";
import {
  SITE_ADMIN_DELEGATIONS,
  siteAdminCoverage,
  type DelegationDepth,
  type RoleSlug,
  type SiteAdminCoverage,
  type SiteAdminDelegation,
  type SiteAdminSurface,
} from "@/lib/domain/access";

export interface NewDelegation {
  scope: SiteScope;
  userId: string;
  username: string;
  name: string;
  email: string;
  mobile: string;
  roles: RoleSlug[];
  surfaces: Partial<Record<SiteAdminSurface, DelegationDepth>>;
  justification: string;
}

interface DelegationStoreValue {
  /** Fixture plus session grants, with session revocations applied. */
  delegations: SiteAdminDelegation[];
  coverage: SiteAdminCoverage[];
  /** Returns the created row so the caller can name it in a toast. */
  create: (draft: NewDelegation) => SiteAdminDelegation;
  revoke: (delegationId: string, reason: string) => void;
  /** The next free USR- id, so the form does not collide with the directory. */
  nextUserId: string;
}

const Ctx = createContext<DelegationStoreValue | null>(null);

export function DelegationStoreProvider({ children }: { children: React.ReactNode }) {
  const [created, setCreated] = useState<SiteAdminDelegation[]>([]);
  const [revocations, setRevocations] = useState<Record<string, string>>({});

  const delegations = useMemo<SiteAdminDelegation[]>(
    () =>
      [...SITE_ADMIN_DELEGATIONS, ...created].map((d) =>
        revocations[d.delegationId]
          ? {
              ...d,
              IsActive: false,
              UpdatedBy: "hq.oversight",
              UpdatedDate: DEMO_NOW,
              revokedReason: revocations[d.delegationId],
            }
          : d,
      ),
    [created, revocations],
  );

  /**
   * USR-100 is the cross-site principal; the site directories run USR-001
   * upward. New delegations continue the 1xx series so a session-created
   * principal is visibly an HQ-issued one and cannot collide with the twelve
   * ids /admin/users already holds.
   */
  const nextUserId = `USR-${100 + created.length + 1}`;

  const create = useCallback(
    (draft: NewDelegation) => {
      const site = draft.scope === "HQ" ? null : SITES.find((s) => s.code === draft.scope) ?? null;
      const row: SiteAdminDelegation = {
        delegationId: `DLG-${draft.scope}-${String(
          SITE_ADMIN_DELEGATIONS.length + created.length + 1,
        ).padStart(4, "0")}`,
        userId: draft.userId.trim(),
        username: draft.username.trim(),
        name: draft.name.trim(),
        email: draft.email.trim(),
        mobile: draft.mobile.trim(),
        scope: draft.scope,
        keys: site
          ? { CityId: site.CityId, Comp_Code: site.Comp_Code, Off_Code: site.Off_Code }
          : null,
        roles: draft.roles,
        surfaces: draft.surfaces,
        justification: draft.justification.trim(),
        revokedReason: null,
        CreatedBy: "hq.oversight",
        UpdatedBy: null,
        CreatedDate: DEMO_NOW,
        UpdatedDate: null,
        IsActive: true,
        IsDeleted: false,
      };
      setCreated((prev) => [...prev, row]);
      return row;
    },
    [created.length],
  );

  const revoke = useCallback((delegationId: string, reason: string) => {
    setRevocations((prev) => ({ ...prev, [delegationId]: reason }));
  }, []);

  const value = useMemo<DelegationStoreValue>(
    () => ({
      delegations,
      coverage: siteAdminCoverage(delegations),
      create,
      revoke,
      nextUserId,
    }),
    [delegations, create, revoke, nextUserId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDelegations(): DelegationStoreValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDelegations must be used inside <DelegationStoreProvider>");
  return ctx;
}
