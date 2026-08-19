ALTER TABLE "Company" ADD COLUMN "gems" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "Shipment" ADD COLUMN "arrivesAt" TIMESTAMP(3);
UPDATE "Shipment" SET "acceptedAt" = COALESCE("acceptedAt", NOW()), "arrivesAt" = NOW() + INTERVAL '5 minutes', "status" = 'IN_TRANSIT' WHERE "status" IN ('ASSIGNED', 'IN_TRANSIT');
