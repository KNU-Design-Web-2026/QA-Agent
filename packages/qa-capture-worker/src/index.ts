import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

type CaptureJob = {
  id: string;
  qa_comment_id: string;
  deployment_url: string;
  pathname: string;
  query_string: string;
  viewport_width: number;
  viewport_height: number;
  device_scale_factor: number;
  scroll_x: number;
  scroll_y: number;
  attempt_count: number;
};

const pollIntervalMs = Number.parseInt(process.env.CAPTURE_POLL_INTERVAL_MS ?? "3000", 10);
const maxAttempts = Number.parseInt(process.env.CAPTURE_MAX_ATTEMPTS ?? "3", 10);
const required = (key: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} must be configured for the capture worker`);
  return value;
};

const supabase = createClient(required("SUPABASE_URL"), required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function claimJob(): Promise<CaptureJob | null> {
  const { data, error } = await supabase.rpc("claim_capture_job");
  if (error) throw new Error(`Could not claim capture job: ${error.message}`);
  return data?.[0] ?? null;
}

function captureUrl(job: CaptureJob) {
  const url = new URL(job.pathname, job.deployment_url);
  url.search = job.query_string.startsWith("?") ? job.query_string.slice(1) : job.query_string;
  return url.toString();
}

async function processJob(job: CaptureJob) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: job.viewport_width, height: job.viewport_height },
      deviceScaleFactor: job.device_scale_factor,
    });
    const page = await context.newPage();
    const url = captureUrl(job);
    await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
    await page.evaluate(({ x, y }) => window.scrollTo(x, y), { x: job.scroll_x, y: job.scroll_y });
    await page.waitForTimeout(250);

    const image = await page.screenshot({ type: "png", animations: "disabled" });
    const objectKey = `qa-comments/${job.qa_comment_id}/replayed/${job.id}.png`;
    const { error: uploadError } = await supabase.storage.from("qa-assets").upload(objectKey, image, {
      contentType: "image/png",
      upsert: false,
    });
    if (uploadError) throw new Error(`Could not upload screenshot: ${uploadError.message}`);

    const { error: assetError } = await supabase.from("assets").insert({
      qa_comment_id: job.qa_comment_id,
      kind: "screenshot_replayed",
      object_key: objectKey,
      mime_type: "image/png",
      width: job.viewport_width,
      height: job.viewport_height,
      capture_metadata_json: {
        source: "render-playwright-worker",
        replay_url: url,
        scroll_x: job.scroll_x,
        scroll_y: job.scroll_y,
        viewport_width: job.viewport_width,
        viewport_height: job.viewport_height,
        device_scale_factor: job.device_scale_factor,
      },
    });
    if (assetError) throw new Error(`Could not record screenshot asset: ${assetError.message}`);

    const { error: completeError } = await supabase
      .from("capture_jobs")
      .update({ status: "completed", completed_at: new Date().toISOString(), screenshot_object_key: objectKey, error_message: null })
      .eq("id", job.id);
    if (completeError) throw new Error(`Could not complete capture job: ${completeError.message}`);
    console.info(JSON.stringify({ event: "capture.completed", jobId: job.id, url }));
  } finally {
    await browser.close();
  }
}

async function failJob(job: CaptureJob, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const terminal = job.attempt_count >= maxAttempts;
  const { error: updateError } = await supabase
    .from("capture_jobs")
    .update({ status: terminal ? "failed" : "pending", error_message: message, completed_at: terminal ? new Date().toISOString() : null })
    .eq("id", job.id);
  if (updateError) console.error(JSON.stringify({ event: "capture.failure-record-failed", jobId: job.id, error: updateError.message }));
  console.error(JSON.stringify({ event: "capture.failed", jobId: job.id, terminal, error: message }));
}

async function run() {
  console.info(JSON.stringify({ event: "capture.worker-started", pollIntervalMs, maxAttempts }));
  while (true) {
    try {
      const job = await claimJob();
      if (!job) {
        await sleep(pollIntervalMs);
        continue;
      }
      try {
        await processJob(job);
      } catch (error) {
        await failJob(job, error);
      }
    } catch (error) {
      console.error(JSON.stringify({ event: "capture.poll-failed", error: error instanceof Error ? error.message : String(error) }));
      await sleep(pollIntervalMs);
    }
  }
}

void run();
