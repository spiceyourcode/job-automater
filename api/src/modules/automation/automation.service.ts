import {
  activateEmergencyStop,
  clearEmergencyStop,
  drainUserSubmitQueue,
  isEmergencyStopped,
  SUBMIT_LIMITS,
} from "../../lib/submit-limits.js";

export class AutomationError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 429 | 503,
  ) {
    super(message);
    this.name = "AutomationError";
  }
}

export async function emergencyStop(userId: string, active: boolean) {
  if (active) {
    await activateEmergencyStop(userId);
    const drained = await drainUserSubmitQueue(userId);
    return {
      active: true as const,
      drained,
      message: "Submit automation stopped; pending submits drained",
      limits: SUBMIT_LIMITS,
    };
  }
  await clearEmergencyStop(userId);
  return {
    active: false as const,
    drained: 0,
    message: "Submit automation resumed",
    limits: SUBMIT_LIMITS,
  };
}

export async function getAutomationStatus(userId: string) {
  const stopped = await isEmergencyStopped(userId);
  return {
    emergencyStop: stopped,
    limits: SUBMIT_LIMITS,
  };
}
