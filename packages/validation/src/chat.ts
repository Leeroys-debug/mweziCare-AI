import { z } from "zod";

/** POST /api/v1/chat body — shared by the chat form and the route handler. */
export const chatMessageSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

/** POST /api/v1/chat/feedback body. */
export const chatFeedbackSchema = z.object({
  messageId: z.string().uuid(),
  feedback: z.enum(["up", "down"]),
});

export type ChatFeedbackInput = z.infer<typeof chatFeedbackSchema>;
