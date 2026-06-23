-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'CALL';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "callDurationSec" INTEGER,
ADD COLUMN     "callStatus" "CallStatus",
ADD COLUMN     "callType" "CallType";
