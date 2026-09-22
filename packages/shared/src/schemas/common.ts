import { z } from 'zod';

/** Every aggregate is identified by a UUID string. */
export const idSchema = z.uuid();

/** ISO-8601 timestamp as stored in the database and sent over the wire. */
export const isoDateTimeSchema = z.iso.datetime({ offset: true });

/** Calendar date (YYYY-MM-DD) used for "read at" / "due at" style fields. */
export const isoDateSchema = z.iso.date();

export const timestampsSchema = z.object({
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

/**
 * A URL the app may load or hand to the server: `http`/`https` only. Every
 * other scheme is either meaningless here (`ftp:`) or a way to make something
 * fetch a local file or a `javascript:` payload.
 */
export const httpUrlSchema = z.url({ protocol: /^https?$/ });

/** Every aggregate carries the id of the user that owns it. */
export const ownedSchema = z.object({
  ownerId: idSchema,
});
