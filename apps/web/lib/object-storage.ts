import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketLifecycleConfigurationCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  BlobNotFoundError,
  del as blobDel,
  issueSignedToken,
  presignUrl,
  put as blobPut,
} from "@vercel/blob";
import { loadServerEnv } from "@mwezicare/validation";
import { lazy } from "./lazy";

// Vercel hosting has no generic S3-compatible endpoint to point at (see
// CLAUDE.md's AWS/Docker deployment, which uses Garage/MinIO/real S3 via
// static keys instead) — `process.env.VERCEL` is set by the platform on
// every deployment, so this picks the right backend without the caller
// needing to know which one is live.
const ON_VERCEL = !!process.env.VERCEL;

const SEVEN_DAY_LIFECYCLE_RULE_ID = "expire-after-7-days";

function buildClient(): S3Client {
  const env = loadServerEnv();
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
    // S3-compatible servers (Garage, MinIO) serve buckets at
    // <endpoint>/<bucket>, not <bucket>.<endpoint> — path-style is required.
    forcePathStyle: true,
  });
}

const s3Client: S3Client = lazy(buildClient);

let bucketEnsured = false;

/**
 * Idempotent: creates the bucket if missing and applies a 7-day expiry
 * lifecycle rule if not already present (docs/MweziCare_AI_Technical_Architecture.docx
 * "Object storage... with 7-day lifecycle expiry"). Safe to call on every
 * request — short-circuits after the first successful call in this process.
 *
 * No-op on Vercel: a Blob store always exists once created (`vercel blob
 * create-store`) and the SDK exposes no bucket-level lifecycle-rule
 * equivalent — the retention job's explicit `deleteObject` call (see
 * worker/jobs/retention.ts) is the only expiry mechanism there, not a
 * second line of defense like the S3 lifecycle rule below.
 */
export async function ensureBucket(): Promise<void> {
  if (ON_VERCEL) return;
  if (bucketEnsured) return;
  const env = loadServerEnv();

  await s3Client
    .send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }))
    .catch(() => {
      // Bucket provisioning for dev is the garage-init bootstrap
      // (infra/garage/bootstrap.sh, `pnpm storage:init`) — this just confirms
      // reachability rather than attempting to create it, since Garage's S3
      // API doesn't support CreateBucket without a pre-existing admin-granted
      // key, unlike real AWS S3.
      console.warn(
        `object-storage: bucket "${env.S3_BUCKET}" not reachable — has \`pnpm storage:init\` been run?`,
      );
    });

  await s3Client
    .send(
      new PutBucketLifecycleConfigurationCommand({
        Bucket: env.S3_BUCKET,
        LifecycleConfiguration: {
          Rules: [
            {
              ID: SEVEN_DAY_LIFECYCLE_RULE_ID,
              Status: "Enabled",
              Filter: {},
              Expiration: { Days: 7 },
            },
          ],
        },
      }),
    )
    .catch((error: unknown) => {
      console.warn(
        "object-storage: could not apply the 7-day lifecycle rule",
        error,
      );
    });

  bucketEnsured = true;
}

export async function putPdf(key: string, body: Buffer): Promise<void> {
  if (ON_VERCEL) {
    await blobPut(key, body, {
      access: "private",
      contentType: "application/pdf",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }

  await ensureBucket();
  const env = loadServerEnv();
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: "application/pdf",
    }),
  );
}

/**
 * Called by the retention job (worker/jobs/retention.ts) once a summary's
 * DB row is deleted, so the PDF doesn't just wait out the bucket's 7-day
 * lifecycle rule above — SHARE_LINK_RETENTION_DAYS is independently
 * configurable and shouldn't silently disagree with that hardcoded default.
 * Not-found is treated as success (already gone).
 */
export async function deleteObject(key: string): Promise<void> {
  if (ON_VERCEL) {
    await blobDel(key).catch((error: unknown) => {
      if (error instanceof BlobNotFoundError) return;
      throw error;
    });
    return;
  }

  const env = loadServerEnv();
  await s3Client.send(
    new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
  );
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds: number,
): Promise<string> {
  if (ON_VERCEL) {
    const validUntil = Date.now() + expiresInSeconds * 1000;
    const signedToken = await issueSignedToken({
      pathname: key,
      operations: ["get"],
      validUntil,
    });
    const { presignedUrl } = await presignUrl(signedToken, {
      operation: "get",
      pathname: key,
      access: "private",
      validUntil,
    });
    return presignedUrl;
  }

  const env = loadServerEnv();
  const command = new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}
