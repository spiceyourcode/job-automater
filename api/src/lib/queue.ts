import { createClient } from "redis";
import { env } from "../env.js";
export type CollectSourcePayload = {
    source_id: string;
    user_id: string;
    source_type: string;
};
export type GenerateDocsPayload = {
    application_id: string;
    user_id: string;
    job_id: string;
    accepted_traces?: Array<{
        text: string;
        chunk_id: string;
        section: string;
        status?: string;
    }>;
    regenerate_sections?: string[];
};
export type SubmitApplicationPayload = {
    application_id: string;
    user_id: string;
    approved_at: string;
};
export type MonitorEmailPayload = {
    user_id: string;
    provider?: "gmail" | "imap";
    messages: Array<{
        external_id: string;
        from_email: string;
        from_name?: string;
        subject?: string;
        snippet?: string;
        body_text?: string;
        received_at?: string;
    }>;
};
export async function enqueueCollectSource(payload: CollectSourcePayload): Promise<void> {
    const client = createClient({ url: env.redisUrl });
    try {
        await client.connect();
        await client.lPush("jobautomater:collect_source", JSON.stringify(payload));
    }
    finally {
        await client.quit().catch(() => { });
    }
}
export async function enqueueGenerateDocs(payload: GenerateDocsPayload): Promise<void> {
    const client = createClient({ url: env.redisUrl });
    try {
        await client.connect();
        await client.lPush("jobautomater:generate_docs", JSON.stringify(payload));
    }
    finally {
        await client.quit().catch(() => { });
    }
}
export async function enqueueSubmitApplication(payload: SubmitApplicationPayload & {
    site?: string;
}): Promise<void> {
    if (!payload.approved_at) {
        throw new Error("SubmitApplicationJob requires approved_at (HG-4)");
    }
    const site = payload.site ?? "unknown";
    const { assertCanEnqueueSubmit, recordSubmitEnqueue, } = await import("./submit-limits.js");
    await assertCanEnqueueSubmit(payload.user_id, site);
    const body: SubmitApplicationPayload = {
        application_id: payload.application_id,
        user_id: payload.user_id,
        approved_at: payload.approved_at,
    };
    const client = createClient({ url: env.redisUrl });
    try {
        await client.connect();
        await client.lPush("jobautomater:submit_application", JSON.stringify(body));
    }
    finally {
        await client.quit().catch(() => { });
    }
    await recordSubmitEnqueue(payload.user_id, site);
}
export async function enqueueMonitorEmail(payload: MonitorEmailPayload): Promise<void> {
    const client = createClient({ url: env.redisUrl });
    try {
        await client.connect();
        await client.lPush("jobautomater:monitor_email", JSON.stringify(payload));
    }
    finally {
        await client.quit().catch(() => { });
    }
}
export type ReindexCvPayload = {
    task_id: string;
    user_id: string;
    cv_document_id: string;
};
export async function enqueueReindexCv(payload: ReindexCvPayload): Promise<void> {
    const client = createClient({ url: env.redisUrl });
    try {
        await client.connect();
        await client.lPush("jobautomater:reindex_cv", JSON.stringify(payload));
    }
    finally {
        await client.quit().catch(() => { });
    }
}
export async function enqueueParseCv(payload: ReindexCvPayload): Promise<void> {
    const client = createClient({ url: env.redisUrl });
    try {
        await client.connect();
        await client.lPush("jobautomater:parse_cv", JSON.stringify(payload));
    }
    finally {
        await client.quit().catch(() => { });
    }
}
export type MatchScorePayload = {
    job_ids: string[];
    user_id: string;
};
export async function enqueueMatchScore(payload: MatchScorePayload): Promise<void> {
    const client = createClient({ url: env.redisUrl });
    try {
        await client.connect();
        await client.lPush("jobautomater:match_score", JSON.stringify(payload));
    }
    finally {
        await client.quit().catch(() => { });
    }
}
export type EnrichCompanyPayload = {
    user_id: string;
    job_ids: string[];
};
export async function enqueueEnrichCompany(payload: EnrichCompanyPayload): Promise<void> {
    const client = createClient({ url: env.redisUrl });
    try {
        await client.connect();
        await client.lPush("jobautomater:enrich_company", JSON.stringify(payload));
    }
    finally {
        await client.quit().catch(() => { });
    }
}
export type InterviewPrepPayload = {
    application_id: string;
    user_id: string;
    job_id: string;
};
export async function enqueueInterviewPrep(payload: InterviewPrepPayload): Promise<void> {
    const client = createClient({ url: env.redisUrl });
    try {
        await client.connect();
        await client.lPush("jobautomater:interview_prep", JSON.stringify(payload));
    }
    finally {
        await client.quit().catch(() => { });
    }
}
export type VideoCoverPayload = {
    application_id: string;
    user_id: string;
    job_id: string;
};
export async function enqueueVideoCover(payload: VideoCoverPayload): Promise<void> {
    const client = createClient({ url: env.redisUrl });
    try {
        await client.connect();
        await client.lPush("jobautomater:video_cover", JSON.stringify(payload));
    }
    finally {
        await client.quit().catch(() => { });
    }
}
