-- Fills CrmCard.closedAt for deals that were already WON/LOST before the column
-- existed: the date of the latest STATUS_CHANGED history entry to the current
-- status, falling back to updatedAt. Safe to re-run (only touches NULLs).
-- Run after `prisma db push`: npx prisma db execute --file scripts/backfill-closed-at.sql
UPDATE `CrmCard` c
SET c.`closedAt` = COALESCE(
  (SELECT MAX(h.`createdAt`) FROM `CrmHistory` h
    WHERE h.`cardId` = c.`id`
      AND h.`type` = 'STATUS_CHANGED'
      AND JSON_UNQUOTE(JSON_EXTRACT(h.`data`, '$.to')) = c.`status`),
  c.`updatedAt`)
WHERE c.`status` IN ('WON', 'LOST') AND c.`closedAt` IS NULL;
