-- DropForeignKey
ALTER TABLE "public"."Document" DROP CONSTRAINT "Document_createdById_fkey";

-- AlterTable
ALTER TABLE "DocumentContent" ADD COLUMN     "seqAtSnapshot" INTEGER;

-- AlterTable
CREATE SEQUENCE operation_seq_seq;
ALTER TABLE "Operation" ALTER COLUMN "seq" SET DEFAULT nextval('operation_seq_seq');
ALTER SEQUENCE operation_seq_seq OWNED BY "Operation"."seq";

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
