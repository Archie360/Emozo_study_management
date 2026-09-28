-- CreateEnum
CREATE TYPE "TaskCreationMethod" AS ENUM ('STUDY_TYPE_AS_IS', 'MODIFIED_TEMPLATE', 'FROM_SCRATCH');

-- AlterTable
ALTER TABLE "studies" ADD COLUMN "task_creation_method" "TaskCreationMethod";
