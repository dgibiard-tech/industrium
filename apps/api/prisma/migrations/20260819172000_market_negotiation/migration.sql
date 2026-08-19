CREATE TYPE "ProposalStatus" AS ENUM ('PENDING','ACCEPTED','REJECTED');
CREATE TABLE "MarketProposal" ("id" TEXT NOT NULL,"quantity" DECIMAL(20,3) NOT NULL,"proposedUnitPriceCents" BIGINT NOT NULL,"status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',"listingId" TEXT NOT NULL,"buyerId" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"resolvedAt" TIMESTAMP(3),CONSTRAINT "MarketProposal_pkey" PRIMARY KEY ("id"));
CREATE INDEX "MarketProposal_status_createdAt_idx" ON "MarketProposal"("status","createdAt");
ALTER TABLE "MarketProposal" ADD CONSTRAINT "MarketProposal_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketProposal" ADD CONSTRAINT "MarketProposal_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
