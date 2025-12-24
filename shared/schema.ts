import { z } from "zod";

// No database schema needed - using .env for configuration
// All Spotify token management is done in-memory

export const insertUserSchema = z.object({
  username: z.string(),
  password: z.string(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
