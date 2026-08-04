import type { WorkspaceRole } from "../db/schema/workspaces.js";

export const canManageSources = (role: WorkspaceRole): boolean =>
  role === "owner";

export const canReadSources = (role: WorkspaceRole): boolean =>
  role === "owner" || role === "member";

export const canWriteApplications = (role: WorkspaceRole): boolean =>
  role === "owner" || role === "member";

export const canReadApplications = (role: WorkspaceRole): boolean =>
  role === "owner" || role === "member" || role === "viewer";

export const canManageTeam = (role: WorkspaceRole): boolean =>
  role === "owner";

export const canWriteProfile = (role: WorkspaceRole): boolean =>
  role === "owner" || role === "member";
