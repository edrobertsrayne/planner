ALTER TABLE `lesson` ADD `status` text NOT NULL DEFAULT 'draft' CHECK (`status` in ('draft','planned'));
