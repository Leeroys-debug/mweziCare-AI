import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketLifecycleConfigurationCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { loadServerEnv } from "@mwezicare/validation";
import { lazy } from "./lazy";

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
 */
export async function ensureBucket(): Promise<void> {
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
  const env = loadServerEnv();
  await s3Client.send(
    new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
  );
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds: number,
): Promise<string> {
  const env = loadServerEnv();
  const command = new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}
