-- Adds CrmCard.number (short sequential id used in /crm/deal/details/<number>).
-- `prisma db push` can't add an autoincrement column to a table that already
-- has rows, so it is created here; MySQL/MariaDB numbers the existing deals.
-- Run once per database, then `prisma db push` reports the schema in sync.
ALTER TABLE `CrmCard`
  ADD COLUMN `number` INTEGER NOT NULL AUTO_INCREMENT,
  ADD UNIQUE INDEX `CrmCard_number_key` (`number`);
