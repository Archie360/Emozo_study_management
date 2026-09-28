-- Named phase/group a task belongs to (e.g. "Qual Phase", "Quant Testing").
ALTER TABLE "study_type_tasks" ADD COLUMN "group_name" TEXT;
ALTER TABLE "tasks" ADD COLUMN "group_name" TEXT;
