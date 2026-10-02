ALTER TABLE "Plan" ADD COLUMN "hasWhatsApp" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Organization" ADD COLUMN "whatsappUserId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "whatsappLinkedByUserId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "whatsappLinkedAt" TIMESTAMP(3);

CREATE INDEX "Organization_whatsappUserId_idx" ON "Organization"("whatsappUserId");

CREATE TABLE "WhatsAppLinkCode" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppLinkCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppLinkCode_codeHash_key" ON "WhatsAppLinkCode"("codeHash");
CREATE INDEX "WhatsAppLinkCode_organizationId_idx" ON "WhatsAppLinkCode"("organizationId");
CREATE INDEX "WhatsAppLinkCode_expiresAt_idx" ON "WhatsAppLinkCode"("expiresAt");
ALTER TABLE "WhatsAppLinkCode" ADD CONSTRAINT "WhatsAppLinkCode_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WhatsAppProcessedMessage" (
    "idHash" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppProcessedMessage_pkey" PRIMARY KEY ("idHash")
);

CREATE INDEX "WhatsAppProcessedMessage_receivedAt_idx" ON "WhatsAppProcessedMessage"("receivedAt");
