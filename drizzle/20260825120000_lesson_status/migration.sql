ALTER TABLE `lesson` ADD `status` text NOT NULL DEFAULT 'draft' CONSTRAINT `lesson_status` CHECK (`status` in ('draft','planned'));
