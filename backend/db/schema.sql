-- UNITE database schema (MySQL 8+)
-- Report diagram names → tables here:
--   PROGRAMME → programme, STUDENT → user_account (role = 'student'),
--   COLLAB_GROUP → collab_group, GROUP_MEMBER → group_member, EVENT → event,
--   EVENT_TEAM → event_team, TEAM_GROUP → team_group, ACHIEVEMENT → achievement.
-- Everything else supports features the report diagram leaves out.

CREATE TABLE IF NOT EXISTS programme (
  id           SMALLINT UNSIGNED PRIMARY KEY,
  level        VARCHAR(20)  NOT NULL,           -- BE/BTech, BSc, ME/MTech, MSc, MCA, MBA
  name         VARCHAR(120) NOT NULL,
  institution  VARCHAR(120) NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_programme (level, name)        -- BE CSE and ME CSE are different rows
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_account (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email          VARCHAR(190) NOT NULL UNIQUE,
  roll_no        VARCHAR(20)  NULL UNIQUE,      -- students only
  name           VARCHAR(100) NOT NULL,
  role           ENUM('student','faculty','admin') NOT NULL DEFAULT 'student',
  programme_id   SMALLINT UNSIGNED NULL,        -- required for students (enforced in app)
  year           TINYINT UNSIGNED NULL,
  about          VARCHAR(600) NOT NULL DEFAULT '',
  password_hash  CHAR(60) NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_programme FOREIGN KEY (programme_id) REFERENCES programme(id),
  INDEX ix_user_programme (programme_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_otp (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email        VARCHAR(190) NOT NULL,
  purpose      ENUM('signup','reset') NOT NULL,
  code_hash    CHAR(64) NOT NULL,               -- HMAC-SHA256, never the plain code
  attempts     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at   DATETIME NOT NULL,
  consumed_at  DATETIME NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_otp_lookup (email, purpose, created_at)
) ENGINE=InnoDB;

-- Profile: About lives on user_account; Interests and Links below.
CREATE TABLE IF NOT EXISTS student_interest (
  user_id   INT UNSIGNED NOT NULL,
  interest  VARCHAR(40) NOT NULL,
  PRIMARY KEY (user_id, interest),
  INDEX ix_interest (interest),
  CONSTRAINT fk_interest_user FOREIGN KEY (user_id) REFERENCES user_account(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS profile_link (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  label      VARCHAR(40)  NOT NULL,
  url        VARCHAR(500) NOT NULL,
  position   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_link_user FOREIGN KEY (user_id) REFERENCES user_account(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Friendships are accepted requests. Same-programme friends are allowed.
CREATE TABLE IF NOT EXISTS friend_request (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sender_id     INT UNSIGNED NOT NULL,
  receiver_id   INT UNSIGNED NOT NULL,
  status        ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at  DATETIME NULL,
  -- one row per unordered pair of users (app sets LEAST / GREATEST of the two ids;
  -- MySQL forbids generated columns and CHECKs on cascading foreign-key columns)
  pair_low      INT UNSIGNED NOT NULL,
  pair_high     INT UNSIGNED NOT NULL,
  UNIQUE KEY uq_friend_pair (pair_low, pair_high),
  CONSTRAINT fk_fr_sender FOREIGN KEY (sender_id) REFERENCES user_account(id) ON DELETE CASCADE,
  CONSTRAINT fk_fr_receiver FOREIGN KEY (receiver_id) REFERENCES user_account(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_block (
  blocker_id  INT UNSIGNED NOT NULL,
  blocked_id  INT UNSIGNED NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT fk_block_blocker FOREIGN KEY (blocker_id) REFERENCES user_account(id) ON DELETE CASCADE,
  CONSTRAINT fk_block_blocked FOREIGN KEY (blocked_id) REFERENCES user_account(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_report (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reporter_id  INT UNSIGNED NOT NULL,
  reported_id  INT UNSIGNED NOT NULL,
  reason       VARCHAR(500) NOT NULL,
  status       ENUM('open','resolved') NOT NULL DEFAULT 'open',
  resolved_by  INT UNSIGNED NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at  DATETIME NULL,
  CONSTRAINT fk_report_reporter FOREIGN KEY (reporter_id) REFERENCES user_account(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_reported FOREIGN KEY (reported_id) REFERENCES user_account(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_resolver FOREIGN KEY (resolved_by) REFERENCES user_account(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Groups: at most 6 members, one per programme. Enforced in a locked transaction
-- (see src/services/groups.js) because a row count cannot be a table constraint.
CREATE TABLE IF NOT EXISTS collab_group (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(60) NOT NULL,
  description  VARCHAR(300) NOT NULL DEFAULT '',
  creator_id   INT UNSIGNED NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_group_creator FOREIGN KEY (creator_id) REFERENCES user_account(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS group_member (
  group_id   INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  role       ENUM('owner','member') NOT NULL DEFAULT 'member',
  joined_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id, user_id),
  INDEX ix_member_user (user_id),
  CONSTRAINT fk_gm_group FOREIGN KEY (group_id) REFERENCES collab_group(id) ON DELETE CASCADE,
  CONSTRAINT fk_gm_user FOREIGN KEY (user_id) REFERENCES user_account(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS group_join_request (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id    INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  message     VARCHAR(300) NOT NULL DEFAULT '',
  status      ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  decided_by  INT UNSIGNED NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at  DATETIME NULL,
  -- at most one pending request per (group, user): NULL for non-pending rows
  pending_key TINYINT AS (IF(status = 'pending', 1, NULL)) STORED,
  UNIQUE KEY uq_one_pending (group_id, user_id, pending_key),
  CONSTRAINT fk_gjr_group FOREIGN KEY (group_id) REFERENCES collab_group(id) ON DELETE CASCADE,
  CONSTRAINT fk_gjr_user FOREIGN KEY (user_id) REFERENCES user_account(id) ON DELETE CASCADE,
  CONSTRAINT fk_gjr_decider FOREIGN KEY (decided_by) REFERENCES user_account(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Polls (meetups are decided with polls)
CREATE TABLE IF NOT EXISTS poll (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_id    INT UNSIGNED NOT NULL,
  created_by  INT UNSIGNED NULL,
  question    VARCHAR(200) NOT NULL,
  closes_at   DATETIME NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_poll_group FOREIGN KEY (group_id) REFERENCES collab_group(id) ON DELETE CASCADE,
  CONSTRAINT fk_poll_creator FOREIGN KEY (created_by) REFERENCES user_account(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS poll_option (
  id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  poll_id  INT UNSIGNED NOT NULL,
  label    VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_option_in_poll (poll_id, id),
  CONSTRAINT fk_option_poll FOREIGN KEY (poll_id) REFERENCES poll(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS poll_vote (
  poll_id    INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  option_id  INT UNSIGNED NOT NULL,
  voted_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (poll_id, user_id),                                   -- one vote per student per poll
  CONSTRAINT fk_vote_option FOREIGN KEY (poll_id, option_id)
    REFERENCES poll_option(poll_id, id) ON DELETE CASCADE,          -- option must belong to this poll
  CONSTRAINT fk_vote_user FOREIGN KEY (user_id) REFERENCES user_account(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Events: category is decided by the HOST INSTITUTION
CREATE TABLE IF NOT EXISTS event (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title             VARCHAR(150) NOT NULL,
  host_institution  VARCHAR(150) NOT NULL,
  host_category     ENUM('college','state','national') NOT NULL,
  event_date        DATE NULL,
  created_by        INT UNSIGNED NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_event_creator FOREIGN KEY (created_by) REFERENCES user_account(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- An event team links one or more existing groups; groups are never merged.
CREATE TABLE IF NOT EXISTS event_team (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id    INT UNSIGNED NOT NULL,
  label       VARCHAR(80) NOT NULL,
  created_by  INT UNSIGNED NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_team_event FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE,
  CONSTRAINT fk_team_creator FOREIGN KEY (created_by) REFERENCES user_account(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS team_group (
  team_id   INT UNSIGNED NOT NULL,
  group_id  INT UNSIGNED NOT NULL,
  PRIMARY KEY (team_id, group_id),
  CONSTRAINT fk_tg_team FOREIGN KEY (team_id) REFERENCES event_team(id) ON DELETE CASCADE,
  CONSTRAINT fk_tg_group FOREIGN KEY (group_id) REFERENCES collab_group(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Achievement claims: pending until a faculty member / admin reviews them.
CREATE TABLE IF NOT EXISTS achievement (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  team_id       INT UNSIGNED NOT NULL,
  submitter_id  INT UNSIGNED NOT NULL,
  result        ENUM('1','2','3','4','5','6','7','8','9','10','participation') NOT NULL,
  description   VARCHAR(500) NOT NULL DEFAULT '',
  status        ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reviewer_id   INT UNSIGNED NULL,                 -- NULL until reviewed
  review_note   VARCHAR(500) NULL,
  base_points   SMALLINT UNSIGNED NULL,            -- filled on approval
  multiplier    DECIMAL(2,1) NULL,
  points        DECIMAL(6,1) NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at   DATETIME NULL,
  INDEX ix_ach_status (status),
  CONSTRAINT fk_ach_team FOREIGN KEY (team_id) REFERENCES event_team(id) ON DELETE CASCADE,
  CONSTRAINT fk_ach_submitter FOREIGN KEY (submitter_id) REFERENCES user_account(id) ON DELETE CASCADE,
  CONSTRAINT fk_ach_reviewer FOREIGN KEY (reviewer_id) REFERENCES user_account(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS evidence (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  achievement_id  INT UNSIGNED NOT NULL,
  stored_name     VARCHAR(80)  NOT NULL,          -- random name on disk
  original_name   VARCHAR(200) NOT NULL,
  mime_type       VARCHAR(40)  NOT NULL,
  size_bytes      INT UNSIGNED NOT NULL,
  uploaded_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_evidence_ach FOREIGN KEY (achievement_id) REFERENCES achievement(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Points ledger: one row per (approved achievement, group). Every group in the
-- event team receives the full verified points (agreed policy, Nov 2026).
CREATE TABLE IF NOT EXISTS points_award (
  achievement_id  INT UNSIGNED NOT NULL,
  group_id        INT UNSIGNED NOT NULL,
  points          DECIMAL(6,1) NOT NULL,
  awarded_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (achievement_id, group_id),
  INDEX ix_award_group (group_id),
  CONSTRAINT fk_award_ach FOREIGN KEY (achievement_id) REFERENCES achievement(id) ON DELETE CASCADE,
  CONSTRAINT fk_award_group FOREIGN KEY (group_id) REFERENCES collab_group(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notification (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  type        VARCHAR(40) NOT NULL,
  message     VARCHAR(300) NOT NULL,
  link        VARCHAR(200) NULL,
  read_at     DATETIME NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX ix_notif_user (user_id, read_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES user_account(id) ON DELETE CASCADE
) ENGINE=InnoDB;
