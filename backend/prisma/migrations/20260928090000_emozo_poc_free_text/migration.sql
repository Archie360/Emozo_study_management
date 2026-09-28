-- Emozo PoC becomes a free-text field instead of a User reference.
-- No existing Study has this set yet, so this is a plain drop + add.
ALTER TABLE "studies" DROP CONSTRAINT "studies_emozo_poc_user_id_fkey";
ALTER TABLE "studies" DROP COLUMN "emozo_poc_user_id";
ALTER TABLE "studies" ADD COLUMN "emozo_poc" TEXT;
