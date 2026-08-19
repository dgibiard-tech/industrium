CREATE TYPE "VehicleListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED');
ALTER TABLE "Vehicle" ADD COLUMN "lastMaintenanceAt" TIMESTAMP(3), ADD COLUMN "maintenanceCount" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "VehicleMarketListing" (
  "id" TEXT NOT NULL,
  "askingPriceCents" BIGINT NOT NULL,
  "status" "VehicleListingStatus" NOT NULL DEFAULT 'ACTIVE',
  "vehicleId" TEXT NOT NULL,
  "sellerId" TEXT NOT NULL,
  "buyerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "soldAt" TIMESTAMP(3),
  CONSTRAINT "VehicleMarketListing_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VehicleMarketListing_status_createdAt_idx" ON "VehicleMarketListing"("status", "createdAt");
ALTER TABLE "VehicleMarketListing" ADD CONSTRAINT "VehicleMarketListing_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleMarketListing" ADD CONSTRAINT "VehicleMarketListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleMarketListing" ADD CONSTRAINT "VehicleMarketListing_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
