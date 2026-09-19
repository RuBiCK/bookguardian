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

/** Every aggregate carries the id of the user that owns it. */
export const ownedSchema = z.object({
  ownerId: idSchema,
});
