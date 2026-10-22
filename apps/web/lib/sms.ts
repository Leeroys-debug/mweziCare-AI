export interface SmsSender {
  sendOtp(phoneNumber: string, code: string): Promise<void>;
}

/**
 * Dev/test only — logs the OTP to the server console instead of sending a
 * real SMS. Never used in production (see createSmsSender below).
 */
export class ConsoleSmsSender implements SmsSender {
  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    console.log(`[dev-sms] OTP for ${phoneNumber}: ${code}`);
    const captureDir = process.env.OTP_TEST_CAPTURE_DIR;
    if (captureDir) {
      // Lets Playwright (or any e2e test) read the code without a network
      // round trip or a production-only backdoor endpoint.
      const { mkdir, writeFile } = await import("node:fs/promises");
      const path = await import("node:path");
      await mkdir(captureDir, { recursive: true });
      await writeFile(
        path.join(captureDir, `${encodeURIComponent(phoneNumber)}.txt`),
        code,
        "utf8",
      );
    }
  }
}

export class AfricasTalkingSmsSender implements SmsSender {
  constructor(
    private readonly username: string,
    private readonly apiKey: string,
    private readonly senderId?: string,
  ) {}

  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    const body = new URLSearchParams({
      username: this.username,
      to: phoneNumber,
      message: `Your MweziCare verification code is ${code}. It expires in 5 minutes.`,
      ...(this.senderId ? { from: this.senderId } : {}),
    });

    const response = await fetch(
      "https://api.africastalking.com/version1/messaging",
      {
        method: "POST",
        headers: {
          apiKey: this.apiKey,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
      },
    );

    if (!response.ok) {
      throw new Error(
        `Africa's Talking SMS request failed: ${response.status} ${await response.text()}`,
      );
    }
  }
}

export function createSmsSender(): SmsSender {
  // OTP_TEST_CAPTURE_DIR is never set in a real deployment — only by
  // Playwright (e2e/*.spec.ts) and the Lighthouse CI harness
  // (lighthouse/auth.cjs), both of which need a real production build
  // (`next start` always sets NODE_ENV=production) but still need the
  // OTP code written to disk instead of sent as a real SMS.
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.OTP_TEST_CAPTURE_DIR
  ) {
    const username = process.env.AFRICASTALKING_USERNAME;
    const apiKey = process.env.AFRICASTALKING_API_KEY;
    if (!username || !apiKey) {
      throw new Error(
        "AFRICASTALKING_USERNAME and AFRICASTALKING_API_KEY are required in production",
      );
    }
    return new AfricasTalkingSmsSender(
      username,
      apiKey,
      process.env.AFRICASTALKING_SENDER_ID,
    );
  }
  return new ConsoleSmsSender();
}
