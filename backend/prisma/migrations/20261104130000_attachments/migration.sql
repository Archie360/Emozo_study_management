-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "study_id" TEXT NOT NULL,
    "task_id" TEXT,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attachments_study_id_idx" ON "attachments"("study_id");

-- CreateIndex
CREATE INDEX "attachments_task_id_idx" ON "attachments"("task_id");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_study_id_fkey" FOREIGN KEY ("study_id") REFERENCES "studies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- New table starts RLS-enabled, same as every other table (see the
-- 20261027100000_enable_row_level_security migration for why).
ALTER TABLE "attachments" ENABLE ROW LEVEL SECURITY;
